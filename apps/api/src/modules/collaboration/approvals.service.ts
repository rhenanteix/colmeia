import {
  Injectable,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { Db } from '../../platform/persistence/db';
import { Principal, requireRole } from '../../security';
import { ApprovalDto, CreateApprovalDto } from './approvals.dto';
@Injectable()
export class ApprovalsService implements OnModuleInit, OnModuleDestroy {
  constructor(private db: Db) {}
  private timer?: ReturnType<typeof setInterval>;
  private expiring = false;
  private logger = new Logger(ApprovalsService.name);
  onModuleInit() {
    this.timer = setInterval(() => {
      void this.expire().catch(() =>
        this.logger.error('Falha ao expirar aprovações; nova tentativa em 30 segundos.'),
      );
    }, 30000);
    this.timer.unref();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
  async expire(organizationId?: string) {
    if (this.expiring) return;
    this.expiring = true;
    try {
      await this.db.$transaction(async (tx) => {
        const pending = await tx.approvalRequest.findMany({
          where: { organizationId, status: 'pending', expiresAt: { lte: new Date() } },
          take: 200,
        });
        for (const a of pending) {
          const changed = await tx.approvalRequest.updateMany({
            where: { id: a.id, status: 'pending', expiresAt: { lte: new Date() } },
            data: { status: 'expired', decidedAt: new Date() },
          });
          if (changed.count)
            await tx.auditEvent.create({
              data: {
                organizationId: a.organizationId,
                actorSubject: 'system',
                action: 'approval.expired',
                resourceId: a.id,
              },
            });
        }
      });
    } finally {
      this.expiring = false;
    }
  }
  async list(p: Principal) {
    await this.expire(p.organizationId);
    return this.db.approvalRequest.findMany({
      where: { organizationId: p.organizationId },
      orderBy: { createdAt: 'desc' },
    });
  }
  async history(p: Principal, id: string) {
    if (
      !(await this.db.approvalRequest.findFirst({
        where: { id, organizationId: p.organizationId },
      }))
    )
      throw new NotFoundException();
    return this.db.auditEvent.findMany({
      where: {
        organizationId: p.organizationId,
        resourceId: id,
        action: { startsWith: 'approval.' },
      },
      orderBy: { createdAt: 'asc' },
    });
  }
  async create(p: Principal, d: CreateApprovalDto) {
    requireRole(p, 'OWNER', 'ADMIN', 'MEMBER');
    const expiresAt = new Date(d.expiresAt);
    if (
      !d.operation.trim() ||
      expiresAt <= new Date() ||
      expiresAt.getTime() > Date.now() + 90 * 86400000
    )
      throw new BadRequestException('Prazo deve estar no futuro, em até 90 dias.');
    return this.db.$transaction(async (tx) => {
      const members = await tx.$queryRaw<
        Array<{ role: string }>
      >`SELECT role FROM "Membership" WHERE "userId" = ${d.approverId} AND "organizationId" = ${p.organizationId} FOR SHARE`;
      if (!members.length || members[0].role === 'VIEWER')
        throw new BadRequestException('Aprovador deve ser um membro com permissão de escrita.');
      if (
        d.agentId &&
        !(await tx.agent.findFirst({ where: { id: d.agentId, organizationId: p.organizationId } }))
      )
        throw new BadRequestException('Agente inválido.');
      const task = d.taskId
        ? await tx.task.findFirst({
            where: { id: d.taskId, organizationId: p.organizationId, archivedAt: null },
          })
        : null;
      if (d.taskId && !task) throw new BadRequestException('Tarefa inválida.');
      if (
        d.targetColumnId &&
        (!task?.boardId ||
          !(await tx.taskColumn.findFirst({
            where: {
              id: d.targetColumnId,
              boardId: task.boardId,
              organizationId: p.organizationId,
            },
          })))
      )
        throw new BadRequestException('Coluna inválida.');
      if (d.targetStatus && (!task || task.boardId))
        throw new BadRequestException('Status se aplica somente a tarefas gerais.');
      const approval = await tx.approvalRequest.create({
        data: {
          organizationId: p.organizationId,
          requestedBy: p.sub,
          operation: d.operation.trim(),
          approverId: d.approverId,
          agentId: d.agentId,
          taskId: d.taskId,
          taskRevision: task?.revision,
          targetColumnId: d.targetColumnId,
          targetStatus: d.targetStatus,
          expiresAt,
          payload: {},
        },
      });
      await tx.notification.create({
        data: {
          organizationId: p.organizationId,
          recipientSubject: d.approverId,
          title: 'Aprovação pendente',
          body: d.operation.trim(),
        },
      });
      await tx.auditEvent.create({
        data: {
          organizationId: p.organizationId,
          actorSubject: p.sub,
          action: 'approval.created',
          resourceId: approval.id,
        },
      });
      return approval;
    });
  }
  async cancel(p: Principal, id: string, reason: string) {
    requireRole(p, 'OWNER', 'ADMIN', 'MEMBER');
    if (!reason.trim()) throw new BadRequestException('Informe a justificativa.');
    return this.db.$transaction(async (tx) => {
      const result = await tx.approvalRequest.updateMany({
        where: {
          id,
          organizationId: p.organizationId,
          status: 'pending',
          expiresAt: { gt: new Date() },
          ...(['OWNER', 'ADMIN'].includes(p.role) ? {} : { requestedBy: p.sub }),
        },
        data: {
          status: 'cancelled',
          reason: reason.trim(),
          decidedBy: p.sub,
          decidedAt: new Date(),
        },
      });
      if (!result.count) throw new ConflictException('Solicitação indisponível para cancelamento.');
      await tx.auditEvent.create({
        data: {
          organizationId: p.organizationId,
          actorSubject: p.sub,
          action: 'approval.cancelled',
          resourceId: id,
          metadata: { reason: reason.trim() },
        },
      });
      return { status: 'cancelled' };
    });
  }
  async decide(p: Principal, id: string, d: ApprovalDto) {
    requireRole(p, 'OWNER', 'ADMIN', 'MEMBER');
    if (!['approved', 'rejected'].includes(d.decision))
      throw new BadRequestException('Invalid decision');
    return this.db.$transaction(async (tx) => {
      const approval = await tx.approvalRequest.findFirst({
        where: { id, organizationId: p.organizationId },
      });
      if (
        approval?.approverId ? approval.approverId !== p.sub : !['OWNER', 'ADMIN'].includes(p.role)
      )
        throw new ForbiddenException('Somente o aprovador designado pode decidir.');
      const r = await tx.approvalRequest.updateMany({
        where: {
          id,
          organizationId: p.organizationId,
          status: 'pending',
          expiresAt: { gt: new Date() },
        },
        data: {
          status: d.decision,
          decidedBy: p.sub,
          reason: d.reason?.trim() || null,
          decidedAt: new Date(),
        },
      });
      if (!r.count || !approval)
        throw new ConflictException('Approval expired, missing or already decided');
      if (
        d.decision === 'approved' &&
        approval.taskId &&
        (approval.targetColumnId || approval.targetStatus)
      ) {
        const changed = await tx.task.updateMany({
          where: {
            id: approval.taskId,
            organizationId: p.organizationId,
            revision: approval.taskRevision ?? -1,
            archivedAt: null,
          },
          data: {
            ...(approval.targetColumnId
              ? { columnId: approval.targetColumnId }
              : { status: approval.targetStatus! }),
            revision: { increment: 1 },
          },
        });
        if (!changed.count)
          throw new ConflictException(
            'A tarefa mudou desde a solicitação. Cancele e solicite nova aprovação.',
          );
        await tx.auditEvent.create({
          data: {
            organizationId: p.organizationId,
            actorSubject: p.sub,
            action: 'task.moved',
            resourceId: approval.taskId,
            metadata: {
              approvalId: id,
              columnId: approval.targetColumnId,
              status: approval.targetStatus,
            },
          },
        });
      }
      await tx.auditEvent.create({
        data: {
          organizationId: p.organizationId,
          actorSubject: p.sub,
          action: 'approval.' + d.decision,
          resourceId: id,
          metadata: { reason: d.reason || '' },
        },
      });
      await tx.notification.create({
        data: {
          organizationId: p.organizationId,
          recipientSubject: approval.requestedBy,
          title: d.decision === 'approved' ? 'Solicitação aprovada' : 'Solicitação rejeitada',
          body: approval.operation,
        },
      });
      return { status: d.decision };
    });
  }
}
