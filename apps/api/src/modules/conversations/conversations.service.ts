import { quota } from '../billing/quotas';
import { RuntimeFailure } from '../runtime/runtime-error';
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { Db } from '../../platform/persistence/db';
import { Principal, requireRole } from '../../security';
import { RuntimeService } from '../runtime/runtime.service';
import type { SendConversationDto } from './conversations.dto';
import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
@Injectable()
export class ConversationsService {
  constructor(
    private db: Db,
    private runtime: RuntimeService,
  ) {}
  list(p: Principal) {
    return this.db.conversation.findMany({
      where: { organizationId: p.organizationId, archivedAt: null },
      include: {
        agent: {
          select: {
            name: true,
            mascot: true,
            status: true,
            deployments: { where: { status: 'ACTIVE' }, select: { engine: true } },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });
  }
  async one(p: Principal, id: string) {
    const c = await this.db.conversation.findFirst({
      where: { id, organizationId: p.organizationId, archivedAt: null },
      include: {
        agent: {
          select: {
            name: true,
            mascot: true,
            status: true,
            deployments: { where: { status: 'ACTIVE' }, select: { engine: true } },
          },
        },
      },
    });
    if (!c) throw new NotFoundException('Conversa não encontrada');
    return c;
  }
  async create(p: Principal, agentId: string) {
    requireRole(p, 'OWNER', 'ADMIN', 'MEMBER');
    if (
      !(await this.db.agent.findFirst({ where: { id: agentId, organizationId: p.organizationId } }))
    )
      throw new NotFoundException();
    await this.runtime.resolve(p.organizationId, agentId);
    return this.db.conversation.create({
      data: { organizationId: p.organizationId, agentId, createdBy: p.sub },
    });
  }
  async rename(p: Principal, id: string, title: string) {
    requireRole(p, 'OWNER', 'ADMIN', 'MEMBER');
    await this.one(p, id);
    return this.db.conversation.update({ where: { id }, data: { title } });
  }
  async archive(p: Principal, id: string) {
    requireRole(p, 'OWNER', 'ADMIN', 'MEMBER');
    await this.one(p, id);
    await this.db.agentExecution.updateMany({
      where: { conversationId: id, organizationId: p.organizationId, status: 'RUNNING' },
      data: { cancelRequested: true },
    });
    return this.db.conversation.update({ where: { id }, data: { archivedAt: new Date() } });
  }
  async messages(p: Principal, id: string) {
    await this.one(p, id);
    return this.db.conversationMessage.findMany({
      where: { conversationId: id, organizationId: p.organizationId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: 500,
    });
  }
  executions(p: Principal) {
    return this.db.agentExecution.findMany({
      where: { organizationId: p.organizationId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { agent: { select: { name: true } } },
    });
  }
  async execution(p: Principal, id: string) {
    const execution = await this.db.agentExecution.findFirst({
      where: { id, organizationId: p.organizationId },
      include: { events: { orderBy: { sequence: 'asc' } } },
    });
    if (!execution) throw new NotFoundException();
    return execution;
  }
  async cancel(p: Principal, id: string) {
    requireRole(p, 'OWNER', 'ADMIN', 'MEMBER');
    await this.execution(p, id);
    await this.db.agentExecution.updateMany({
      where: { id, organizationId: p.organizationId, status: 'RUNNING' },
      data: { cancelRequested: true },
    });
    return { requested: true };
  }
  async prepare(p: Principal, id: string, dto: SendConversationDto) {
    requireRole(p, 'OWNER', 'ADMIN', 'MEMBER');
    const conversation = await this.one(p, id);
    const resolved = await this.runtime.resolve(p.organizationId, conversation.agentId);
    const messageId = randomUUID();
    const execution = await this.db.$transaction(async (tx) => {
      // Serialize executions for this agent across replicas, including monthly budget checks.
      await tx.$queryRaw`SELECT id FROM "Agent" WHERE id = ${conversation.agentId} FOR UPDATE`;
      const cutoff = new Date(Date.now() - 120000);
      const abandoned = await tx.agentExecution.updateMany({
        where: { agentId: conversation.agentId, status: 'RUNNING', startedAt: { lt: cutoff } },
        data: {
          status: 'TIMED_OUT',
          error: 'Execução interrompida após perda do processo.',
          finishedAt: new Date(),
        },
      });
      if (abandoned.count)
        await tx.conversationMessage.updateMany({
          where: {
            organizationId: p.organizationId,
            conversation: { agentId: conversation.agentId },
            status: 'generating',
            createdAt: { lt: cutoff },
          },
          data: { status: 'timed_out' },
        });
      if (
        await tx.agentExecution.findFirst({
          where: { organizationId: p.organizationId, requestId: dto.requestId },
        })
      )
        throw new ConflictException('Esta mensagem já foi enviada; reabra o histórico.');
      if (await tx.agentExecution.findFirst({ where: { conversationId: id, status: 'RUNNING' } }))
        throw new ConflictException('Aguarde ou interrompa a resposta atual.');
      const since = new Date();
      since.setUTCDate(1);
      since.setUTCHours(0, 0, 0, 0);
      if (
        (await tx.agentExecution.count({
          where: {
            agentId: conversation.agentId,
            organizationId: p.organizationId,
            createdAt: { gte: since },
          },
        })) >= resolved.config.monthlyExecutionLimit
      )
        throw new ConflictException('Limite mensal de execuções atingido.');
      await quota(tx, p.organizationId, 'executions');
      const execution = await tx.agentExecution.create({
        data: {
          organizationId: p.organizationId,
          agentId: conversation.agentId,
          conversationId: id,
          versionId: resolved.deployment.versionId,
          requestedBy: p.sub,
          requestId: dto.requestId,
          engine: resolved.config.engine,
          model: resolved.config.model,
          provider: resolved.config.provider,
          status: 'RUNNING',
          startedAt: new Date(),
        },
      });
      await tx.conversationMessage.create({
        data: {
          id: dto.requestId,
          organizationId: p.organizationId,
          conversationId: id,
          role: 'user',
          content: dto.text,
        },
      });
      await tx.conversationMessage.create({
        data: {
          id: messageId,
          organizationId: p.organizationId,
          conversationId: id,
          role: 'assistant',
          content: '',
          status: 'generating',
        },
      });
      await tx.conversation.update({
        where: { id },
        data: {
          updatedAt: new Date(),
          ...(conversation.title === 'Nova conversa' ? { title: dto.text.slice(0, 80) } : {}),
        },
      });
      return execution;
    });
    return { ...resolved, execution, messageId };
  }
  async run(
    p: Principal,
    prepared: Awaited<ReturnType<ConversationsService['prepare']>>,
    signal: AbortSignal,
    emit: (chunk: Record<string, unknown>) => void,
  ) {
    const { execution, config, adapter, deployment, messageId } = prepared;
    const controller = new AbortController();
    const deadline = AbortSignal.timeout(
      Math.max(1000, Math.min(90000, Number(process.env.EXECUTION_TIMEOUT_MS) || 90000)),
    );
    const combined = AbortSignal.any([signal, deadline, controller.signal]);
    const poll = setInterval(() => {
      void this.db.agentExecution
        .findUnique({ where: { id: execution.id }, select: { cancelRequested: true } })
        .then((e) => {
          if (e?.cancelRequested) controller.abort();
        })
        .catch(() => controller.abort());
    }, 500);
    let content = '',
      sequence = 0,
      inputTokens = 0,
      outputTokens = 0;
    let status: 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'TIMED_OUT' = 'COMPLETED';
    let error: string | null = null;
    const record = async (type: string, payload: unknown) =>
      this.db.executionEvent.create({
        data: {
          organizationId: p.organizationId,
          executionId: execution.id,
          sequence: sequence++,
          type,
          payload: JSON.parse(JSON.stringify(payload)) as Prisma.InputJsonValue,
        },
      });
    emit({ type: 'start', messageId });
    emit({
      type: 'data-execution',
      data: { id: execution.id, engine: config.engine, model: config.model },
    });
    emit({ type: 'text-start', id: messageId });
    try {
      await record('started', { versionId: deployment.versionId });
      const history = await this.db.conversationMessage.findMany({
        where: {
          conversationId: execution.conversationId!,
          organizationId: p.organizationId,
          status: 'completed',
        },
        orderBy: { createdAt: 'desc' },
        take: 40,
      });
      const messages = history
        .reverse()
        .map((m) =>
          m.role === 'user'
            ? { role: 'user' as const, content: m.content }
            : { role: 'assistant' as const, content: m.content },
        );
      for await (const event of adapter.stream(
        {
          organizationId: p.organizationId,
          organizationName: deployment.agent.organization.name,
          agentId: execution.agentId,
          agentName: deployment.agent.name,
          versionId: deployment.versionId,
          conversationId: execution.conversationId!,
          signal: combined,
        },
        config,
        messages,
      )) {
        combined.throwIfAborted();
        await record(event.type, event);
        if (event.type === 'text') {
          content += event.delta;
          if (content.length > 200000) throw new Error('Limite de saída excedido');
          await this.db.conversationMessage.update({ where: { id: messageId }, data: { content } });
          emit({ type: 'text-delta', id: messageId, delta: event.delta });
        } else if (event.type === 'usage') {
          inputTokens = event.inputTokens;
          outputTokens = event.outputTokens;
          emit({ type: 'data-usage', data: { inputTokens, outputTokens } });
        } else emit({ type: 'data-tool', data: event });
      }
      combined.throwIfAborted();
      if (!content.trim()) throw new Error('Resposta vazia');
    } catch (failure) {
      status = deadline.aborted ? 'TIMED_OUT' : combined.aborted ? 'CANCELLED' : 'FAILED';
      error =
        status === 'TIMED_OUT'
          ? 'Tempo de resposta excedido.'
          : status === 'CANCELLED'
            ? 'Geração interrompida.'
            : failure instanceof RuntimeFailure
              ? failure.message
              : 'Falha no provedor ou ferramenta. Verifique a configuração e tente novamente.';
    } finally {
      clearInterval(poll);
      await this.db.$transaction(async (tx) => {
        await tx.conversationMessage.update({
          where: { id: messageId },
          data: { content, status: status === 'COMPLETED' ? 'completed' : status.toLowerCase() },
        });
        await tx.agentExecution.update({
          where: { id: execution.id },
          data: { status, error, finishedAt: new Date(), inputTokens, outputTokens },
        });
        await tx.usageLedgerEntry.create({
          data: {
            organizationId: p.organizationId,
            agentId: execution.agentId,
            executionId: execution.id,
            provider: config.provider,
            inputTokens,
            outputTokens,
          },
        });
      });
      await record('finished', { status, error, inputTokens, outputTokens });
      emit({ type: 'text-end', id: messageId });
      if (error) emit({ type: 'error', errorText: error });
      emit({ type: 'finish' });
    }
  }
}
