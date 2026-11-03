import { quota } from '../billing/quotas';
import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma, Workflow, WorkflowRun } from '@prisma/client';
import { Queue, Worker } from 'bullmq';
import { createHash, randomBytes } from 'node:crypto';
import { Db } from '../../platform/persistence/db';
import { Principal, requireRole } from '../../security';
import { validateGraph, Graph } from './graph';
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
const json = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
const visible = ({ webhookHash: _secret, ...workflow }: Workflow) => workflow;
@Injectable()
export class WorkflowsService implements OnModuleInit, OnModuleDestroy {
  constructor(private db: Db) {}
  private queue?: Queue;
  private worker?: Worker;
  private timer?: ReturnType<typeof setInterval>;
  private scanning = false;
  private logger = new Logger(WorkflowsService.name);
  onModuleInit() {
    if (!process.env.REDIS_URL) {
      this.logger.warn('Workflows: Redis não configurado. Execuções indisponíveis.');
      return;
    }
    const url = new URL(process.env.REDIS_URL);
    const connection = {
      host: url.hostname,
      port: Number(url.port || 6379),
      username: url.username || undefined,
      password: url.password || undefined,
      db: Number(url.pathname.slice(1) || 0),
      ...(url.protocol === 'rediss:' ? { tls: {} } : {}),
      maxRetriesPerRequest: null,
    };
    const database = new URL(process.env.DATABASE_URL!);
    const namespace = hash(
      database.host +
        database.pathname +
        '?schema=' +
        (database.searchParams.get('schema') || 'public'),
    ).slice(0, 12);
    const name = (process.env.WORKFLOW_QUEUE_NAME || 'colmeia-workflows') + '-' + namespace;
    this.queue = new Queue(name, { connection });
    this.worker = new Worker(
      name,
      async (job) => {
        for (let i = 0; i < 50; i++) if (!(await this.step(job.data.id))) break;
      },
      { connection, concurrency: 4 },
    );
    this.queue.on('error', () =>
      this.logger.error('Fila de workflows indisponível. Estado preservado no banco.'),
    );
    this.worker.on('error', () => this.logger.error('Worker de workflows indisponível.'));
    this.timer = setInterval(() => {
      void this.scan().catch(() =>
        this.logger.error('Reconciliação de workflows falhou; será repetida.'),
      );
    }, 1000);
    this.timer.unref();
  }
  async onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    await this.worker?.close();
    await this.queue?.close();
  }
  async list(p: Principal) {
    return (
      await this.db.workflow.findMany({
        where: { organizationId: p.organizationId },
        orderBy: { createdAt: 'desc' },
      })
    ).map(visible);
  }
  async get(p: Principal, id: string) {
    const w = await this.db.workflow.findFirst({ where: { id, organizationId: p.organizationId } });
    if (!w) throw new NotFoundException();
    return visible(w);
  }
  async create(p: Principal, name: string, draft: unknown) {
    requireRole(p, 'OWNER', 'ADMIN', 'MEMBER');
    if (name.trim().length < 2) throw new BadRequestException('Informe um nome.');
    const webhookSecret = randomBytes(32).toString('hex');
    const w = await this.db.$transaction(async (tx) => {
      await quota(tx, p.organizationId, 'workflows');
      return tx.workflow.create({
        data: {
          organizationId: p.organizationId,
          name: name.trim(),
          draft: json(draft),
          webhookHash: hash(webhookSecret),
          createdBy: p.sub,
        },
      });
    });
    return { ...visible(w), webhookSecret };
  }
  async save(p: Principal, id: string, name: string, draft: unknown, revision: number) {
    requireRole(p, 'OWNER', 'ADMIN', 'MEMBER');
    if (name.trim().length < 2) throw new BadRequestException('Informe um nome.');
    const changed = await this.db.workflow.updateMany({
      where: { id, organizationId: p.organizationId, revision },
      data: { name: name.trim(), draft: json(draft), revision: { increment: 1 } },
    });
    if (!changed.count) throw new ConflictException('Workflow alterado ou não encontrado.');
    return this.get(p, id);
  }
  async refs(tx: Prisma.TransactionClient, org: string, graph: Graph) {
    for (const n of graph.nodes) {
      for (const userId of [n.config.assignedTo, n.config.approverId, n.config.recipientId])
        if (userId) {
          const rows = await tx.$queryRaw<
            Array<{ role: string }>
          >`SELECT role FROM "Membership" WHERE "userId" = ${userId} AND "organizationId" = ${org} FOR SHARE`;
          const m = rows[0];
          if (!m || (userId === n.config.approverId && m.role === 'VIEWER'))
            throw new BadRequestException('Membro inválido na etapa ' + n.id);
        }
      if (
        n.config.boardId &&
        !(await tx.taskBoard.findFirst({ where: { id: n.config.boardId, organizationId: org } }))
      )
        throw new BadRequestException('Quadro inválido.');
      if (
        n.config.columnId &&
        !(await tx.taskColumn.findFirst({
          where: {
            id: n.config.columnId,
            organizationId: org,
            ...(n.config.boardId ? { boardId: n.config.boardId } : {}),
          },
        }))
      )
        throw new BadRequestException('Coluna inválida.');
    }
  }
  async publish(p: Principal, id: string, revision: number) {
    requireRole(p, 'OWNER', 'ADMIN', 'MEMBER');
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Workflow" WHERE id = ${id} AND "organizationId" = ${p.organizationId} FOR UPDATE`;
      const w = await tx.workflow.findFirst({ where: { id, organizationId: p.organizationId } });
      if (!w || w.revision !== revision)
        throw new ConflictException('Workflow alterado ou não encontrado.');
      const graph = validateGraph(w.draft);
      await this.refs(tx, p.organizationId, graph);
      const version = await tx.workflowVersion.create({
        data: {
          workflowId: id,
          organizationId: p.organizationId,
          version: w.publishedVersion + 1,
          graph: json(graph),
        },
      });
      await tx.workflow.update({
        where: { id },
        data: {
          publishedVersion: version.version,
          revision: { increment: 1 },
          nextRunAt:
            graph.nodes[0].type === 'schedule'
              ? new Date(Date.now() + graph.nodes[0].config.seconds! * 1000)
              : null,
        },
      });
      await tx.auditEvent.create({
        data: {
          organizationId: p.organizationId,
          actorSubject: p.sub,
          action: 'workflow.published',
          resourceId: id,
          metadata: { version: version.version },
        },
      });
      return version;
    });
  }
  async active(p: Principal, id: string, active: boolean) {
    requireRole(p, 'OWNER', 'ADMIN', 'MEMBER');
    const updated = await this.db.workflow.updateMany({
      where: { id, organizationId: p.organizationId, publishedVersion: { gt: 0 } },
      data: { active },
    });
    if (!updated.count) throw new ConflictException('Publique uma versão antes de ativar.');
    return this.get(p, id);
  }
  async start(
    p: Principal,
    id: string,
    key: string,
    input: Record<string, unknown>,
    trigger = 'manual',
  ) {
    requireRole(p, 'OWNER', 'ADMIN', 'MEMBER');
    if (!this.queue)
      throw new ServiceUnavailableException('Redis é necessário para executar workflows.');
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Workflow" WHERE id = ${id} AND "organizationId" = ${p.organizationId} FOR UPDATE`;
      const w = await tx.workflow.findFirst({ where: { id, organizationId: p.organizationId } });
      if (!w) throw new NotFoundException();
      const existing = await tx.workflowRun.findUnique({
        where: { workflowId_idempotencyKey: { workflowId: id, idempotencyKey: key } },
      });
      if (existing) return existing;
      if (!w.active || !w.publishedVersion)
        throw new ConflictException('Workflow inativo ou não publicado.');
      return this.newRun(tx, w, key, input, trigger, p.sub);
    });
  }
  private async newRun(
    tx: Prisma.TransactionClient,
    w: Workflow,
    key: string,
    input: Record<string, unknown>,
    trigger: string,
    requestedBy: string,
  ) {
    const version = await tx.workflowVersion.findUniqueOrThrow({
      where: { workflowId_version: { workflowId: w.id, version: w.publishedVersion } },
    });
    const graph = validateGraph(version.graph);
    if (trigger !== 'manual' && graph.nodes[0].type !== trigger)
      throw new BadRequestException('Trigger incompatível.');
    await quota(tx, w.organizationId, 'executions');
    return tx.workflowRun.create({
      data: {
        workflowId: w.id,
        organizationId: w.organizationId,
        versionId: version.id,
        idempotencyKey: key,
        trigger,
        requestedBy,
        currentNode: graph.nodes[0].id,
        context: json({ input }),
      },
    });
  }
  async webhook(id: string, secret: string, key: string, input: Record<string, unknown>) {
    if (!secret || !key || key.length > 128) throw new UnauthorizedException();
    const w = await this.db.workflow.findUnique({ where: { id } });
    if (!w || hash(secret) !== w.webhookHash) throw new UnauthorizedException();
    return this.start(
      { sub: w.createdBy, organizationId: w.organizationId, role: 'OWNER', sessionId: '' },
      id,
      'webhook:' + key,
      input,
      'webhook',
    );
  }
  async runs(p: Principal, id: string) {
    await this.get(p, id);
    return this.db.workflowRun.findMany({
      where: { workflowId: id, organizationId: p.organizationId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { steps: { orderBy: { createdAt: 'asc' } } },
    });
  }
  async cancel(p: Principal, id: string) {
    requireRole(p, 'OWNER', 'ADMIN', 'MEMBER');
    return this.db.$transaction(async (tx) => {
      const r = await tx.workflowRun.updateMany({
        where: {
          id,
          organizationId: p.organizationId,
          status: { in: ['queued', 'waiting', 'approval'] },
        },
        data: { status: 'cancelled', finishedAt: new Date(), revision: { increment: 1 } },
      });
      if (!r.count) throw new ConflictException('Execução já finalizada.');
      const run = await tx.workflowRun.findUniqueOrThrow({ where: { id } });
      if (run.approvalId) {
        const cancelledApproval = await tx.approvalRequest.updateMany({
          where: { id: run.approvalId, organizationId: p.organizationId, status: 'pending' },
          data: {
            status: 'cancelled',
            decidedBy: p.sub,
            decidedAt: new Date(),
            reason: 'Execução cancelada',
          },
        });
        if (cancelledApproval.count)
          await tx.auditEvent.create({
            data: {
              organizationId: p.organizationId,
              actorSubject: p.sub,
              action: 'approval.cancelled',
              resourceId: run.approvalId,
              metadata: { workflowRunId: id },
            },
          });
      }
      await tx.auditEvent.create({
        data: {
          organizationId: p.organizationId,
          actorSubject: p.sub,
          action: 'workflow.cancelled',
          resourceId: id,
        },
      });
      return run;
    });
  }
  async retry(p: Principal, id: string) {
    requireRole(p, 'OWNER', 'ADMIN', 'MEMBER');
    const r = await this.db.workflowRun.updateMany({
      where: { id, organizationId: p.organizationId, status: 'failed', approvalId: null },
      data: {
        status: 'queued',
        error: null,
        stepAttempts: 0,
        availableAt: new Date(),
        finishedAt: null,
        revision: { increment: 1 },
      },
    });
    if (!r.count)
      throw new ConflictException(
        'Somente falhas técnicas sem decisão humana podem ser reexecutadas.',
      );
    return { ok: true };
  }
  private async scan() {
    if (this.scanning || !this.queue) return;
    this.scanning = true;
    try {
      const schedules = await this.db.workflow.findMany({
        where: { active: true, nextRunAt: { lte: new Date() } },
        take: 50,
      });
      for (const candidate of schedules) {
        try {
          await this.db.$transaction(async (tx) => {
            await tx.$queryRaw`SELECT id FROM "Workflow" WHERE id = ${candidate.id} FOR UPDATE`;
            const w = await tx.workflow.findUniqueOrThrow({ where: { id: candidate.id } });
            if (!w.active || !w.nextRunAt || w.nextRunAt > new Date()) return;
            const version = await tx.workflowVersion.findUniqueOrThrow({
              where: { workflowId_version: { workflowId: w.id, version: w.publishedVersion } },
            });
            const graph = validateGraph(version.graph);
            if (graph.nodes[0].type !== 'schedule') return;
            await this.newRun(
              tx,
              w,
              'schedule:' + w.nextRunAt.toISOString(),
              {},
              'schedule',
              w.createdBy,
            );
            await tx.workflow.update({
              where: { id: w.id },
              data: { nextRunAt: new Date(Date.now() + graph.nodes[0].config.seconds! * 1000) },
            });
          });
        } catch (error) {
          this.logger.warn('Agendamento adiado: falha de configuração ou quota.');
          await this.db.workflow.updateMany({
            where: { id: candidate.id, nextRunAt: candidate.nextRunAt },
            data: { nextRunAt: new Date(Date.now() + 60000) },
          });
          await this.db.auditEvent.create({
            data: {
              organizationId: candidate.organizationId,
              actorSubject: 'system',
              action: 'workflow.schedule.blocked',
              resourceId: candidate.id,
              metadata: {
                reason: error instanceof ConflictException ? error.message : 'Falha no agendamento',
              },
            },
          });
        }
      }

      const runs = await this.db.workflowRun.findMany({
        where: {
          status: { in: ['queued', 'waiting', 'approval'] },
          availableAt: { lte: new Date() },
        },
        take: 100,
        orderBy: { availableAt: 'asc' },
      });
      for (const run of runs) {
        if (run.status === 'approval' && run.approvalId) {
          const a = await this.db.approvalRequest.findUnique({ where: { id: run.approvalId } });
          if (a?.status === 'pending' && a.expiresAt > new Date()) {
            await this.db.workflowRun.updateMany({
              where: { id: run.id, revision: run.revision, status: 'approval' },
              data: { availableAt: new Date(Date.now() + 2000) },
            });
            continue;
          }
        }
        const existing = await this.queue.getJob(`${run.id}-${run.revision}`);
        if (existing && (await existing.getState()) === 'failed') {
          await existing.retry();
          continue;
        }
        await this.queue.add(
          'step',
          { id: run.id },
          {
            jobId: `${run.id}-${run.revision}`,
            attempts: 3,
            backoff: { type: 'exponential', delay: 1000 },
            removeOnComplete: true,
            removeOnFail: 100,
          },
        );
      }
    } finally {
      this.scanning = false;
    }
  }
  private async step(id: string): Promise<boolean> {
    let snapshot: WorkflowRun | null = null;
    try {
      return await this.db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "WorkflowRun" WHERE id = ${id} FOR UPDATE`;
        const run = await tx.workflowRun.findUnique({ where: { id }, include: { version: true } });
        if (
          !run ||
          !['queued', 'waiting', 'approval'].includes(run.status) ||
          run.availableAt > new Date()
        )
          return false;
        snapshot = run;
        const graph = validateGraph(run.version.graph);
        const node = graph.nodes.find((n) => n.id === run.currentNode);
        if (!node) throw new Error('Etapa ausente na versão publicada.');
        if (run.revision > 500) throw new Error('Limite de operações da execução excedido.');
        const ctx = run.context as { input: Record<string, unknown>; taskId?: string };
        let next = node.next,
          state = 'queued',
          availableAt = new Date(),
          approvalId = run.approvalId;
        await this.refs(tx, run.organizationId, { nodes: [node] });
        if (node.type === 'condition')
          next = ctx.input[node.config.field!] === node.config.equals ? node.next : node.otherwise;
        if (node.type === 'task') {
          let columnId = node.config.columnId;
          if (node.config.boardId && !columnId)
            columnId = (
              await tx.taskColumn.findFirstOrThrow({
                where: { boardId: node.config.boardId, organizationId: run.organizationId },
                orderBy: { position: 'asc' },
              })
            ).id;
          if (columnId && !node.config.boardId) throw new Error('Tarefa com coluna exige quadro.');
          const task = await tx.task.create({
            data: {
              organizationId: run.organizationId,
              title: node.config.title!,
              assignedTo: node.config.assignedTo,
              boardId: node.config.boardId,
              columnId,
              createdBy: run.requestedBy,
            },
          });
          ctx.taskId = task.id;
          await tx.auditEvent.create({
            data: {
              organizationId: run.organizationId,
              actorSubject: run.requestedBy,
              action: 'task.created',
              resourceId: task.id,
              metadata: { workflowRunId: id },
            },
          });
        }
        if (node.type === 'approval') {
          if (!approvalId) {
            const a = await tx.approvalRequest.create({
              data: {
                organizationId: run.organizationId,
                requestedBy: run.requestedBy,
                approverId: node.config.approverId!,
                taskId: ctx.taskId,
                operation: node.config.title || 'Aprovar etapa do workflow',
                payload: { workflowRunId: id },
                expiresAt: new Date(Date.now() + (node.config.seconds || 86400) * 1000),
              },
            });
            approvalId = a.id;
            state = 'approval';
            next = node.id;
            await tx.auditEvent.create({
              data: {
                organizationId: run.organizationId,
                actorSubject: run.requestedBy,
                action: 'approval.created',
                resourceId: a.id,
                metadata: { workflowRunId: id },
              },
            });
            await tx.notification.create({
              data: {
                organizationId: run.organizationId,
                recipientSubject: node.config.approverId!,
                title: 'Aprovação pendente',
                body: a.operation,
              },
            });
          } else {
            const a = await tx.approvalRequest.findFirstOrThrow({
              where: { id: approvalId, organizationId: run.organizationId },
            });
            if (a.status === 'pending' && a.expiresAt > new Date()) return false;
            if (a.status !== 'approved')
              throw new Error('Aprovação rejeitada, cancelada ou expirada.');
            approvalId = null;
          }
        }
        if (node.type === 'status') {
          if (!ctx.taskId) throw new Error('Nenhuma tarefa foi criada nesta execução.');
          const task = await tx.task.findFirstOrThrow({
            where: { id: ctx.taskId, organizationId: run.organizationId, archivedAt: null },
          });
          if (node.config.columnId) {
            if (
              !(await tx.taskColumn.findFirst({
                where: {
                  id: node.config.columnId,
                  boardId: task.boardId || '',
                  organizationId: run.organizationId,
                },
              }))
            )
              throw new Error('Coluna não pertence ao quadro da tarefa.');
          } else if (task.boardId)
            throw new Error('Tarefa em quadro requer uma coluna de destino.');
          await tx.task.update({
            where: { id: task.id },
            data: {
              ...(node.config.columnId
                ? { columnId: node.config.columnId }
                : { status: node.config.status }),
              revision: { increment: 1 },
            },
          });
          await tx.auditEvent.create({
            data: {
              organizationId: run.organizationId,
              actorSubject: run.requestedBy,
              action: 'task.moved',
              resourceId: task.id,
              metadata: { workflowRunId: id },
            },
          });
        }
        if (node.type === 'notification')
          await tx.notification.create({
            data: {
              organizationId: run.organizationId,
              recipientSubject: node.config.recipientId!,
              title: node.config.title!,
            },
          });
        if (node.type === 'wait') {
          availableAt = new Date(Date.now() + node.config.seconds! * 1000);
          state = 'waiting';
        }
        if (node.type === 'end') state = 'completed';
        await tx.workflowStep.create({
          data: {
            runId: id,
            organizationId: run.organizationId,
            nodeId: node.id,
            type: node.type,
            status: state === 'approval' ? 'waiting' : 'completed',
            attempt: run.stepAttempts + 1,
          },
        });
        await tx.workflowRun.update({
          where: { id },
          data: {
            status: state,
            currentNode: next || node.id,
            context: json(ctx),
            approvalId,
            availableAt,
            revision: { increment: 1 },
            attempts: { increment: 1 },
            stepAttempts: 0,
            error: null,
            startedAt: run.startedAt || new Date(),
            ...(state === 'completed' ? { finishedAt: new Date() } : {}),
          },
        });
        if (state === 'completed')
          await tx.auditEvent.create({
            data: {
              organizationId: run.organizationId,
              actorSubject: run.requestedBy,
              action: 'workflow.completed',
              resourceId: id,
              metadata: { correlationId: run.correlationId },
            },
          });
        return state === 'queued';
      });
    } catch (error) {
      const failed = snapshot as WorkflowRun | null;
      if (!failed) throw error;
      const message =
        error instanceof BadRequestException
          ? error.message
          : error instanceof Error && !('code' in error)
            ? error.message.slice(0, 500)
            : 'Falha de persistência; consulte os registros operacionais.';
      await this.db.$transaction(async (tx) => {
        const terminal = failed.stepAttempts >= 2 || !!failed.approvalId;
        const changed = await tx.workflowRun.updateMany({
          where: {
            id,
            revision: failed.revision,
            status: { in: ['queued', 'waiting', 'approval'] },
          },
          data: {
            error: message,
            status: terminal ? 'failed' : 'queued',
            stepAttempts: { increment: 1 },
            attempts: { increment: 1 },
            revision: { increment: 1 },
            availableAt: new Date(Date.now() + 1000 * 2 ** failed.stepAttempts),
            ...(terminal ? { finishedAt: new Date() } : {}),
          },
        });
        if (changed.count)
          await tx.workflowStep.create({
            data: {
              runId: id,
              organizationId: failed.organizationId,
              nodeId: failed.currentNode,
              type: 'error',
              status: 'failed',
              attempt: failed.stepAttempts + 1,
              error: message,
            },
          });
      });
      return false;
    }
  }
}
