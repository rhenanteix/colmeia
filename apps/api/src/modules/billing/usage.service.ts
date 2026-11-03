import { Injectable } from '@nestjs/common';
import { Db } from '../../platform/persistence/db';
import { Principal } from '../../security';
@Injectable()
export class UsageService {
  constructor(private db: Db) {}
  async summary(p: Principal) {
    return this.db.$transaction(
      async (tx) => {
        const where = { organizationId: p.organizationId };
        const since = new Date(Date.now() - 30 * 86400000);
        const [
          x,
          tasks,
          archivedTasks,
          workflows,
          runs,
          storage,
          wikiPages,
          agents,
          agentUsage,
          filesByAgent,
          wikiByAgent,
          history,
        ] = await Promise.all([
          tx.usageLedgerEntry.aggregate({
            where,
            _sum: { inputTokens: true, outputTokens: true, costMicros: true },
            _count: true,
          }),
          tx.task.count({ where: { ...where, archivedAt: null } }),
          tx.task.count({ where: { ...where, archivedAt: { not: null } } }),
          tx.workflow.count({ where }),
          tx.workflowRun.groupBy({ by: ['status'], where, _count: true }),
          tx.knowledgeDocument.aggregate({
            where: { ...where, status: 'ready' },
            _sum: { size: true },
            _count: true,
          }),
          tx.wikiPage.count({ where }),
          tx.agent.findMany({ where, select: { id: true, name: true } }),
          tx.usageLedgerEntry.groupBy({
            by: ['agentId'],
            where,
            _sum: { inputTokens: true, outputTokens: true, costMicros: true },
            _count: true,
          }),
          tx.knowledgeDocument.groupBy({
            by: ['agentId'],
            where: { ...where, status: 'ready' },
            _sum: { size: true },
            _count: true,
          }),
          tx.wikiPage.groupBy({ by: ['agentId'], where, _count: true }),
          tx.auditEvent.findMany({
            where: {
              ...where,
              createdAt: { gte: since },
              action: {
                in: [
                  'task.created',
                  'task.moved',
                  'file.uploaded',
                  'file.deleted',
                  'wiki.updated',
                  'workflow.completed',
                  'workflow.cancelled',
                  'workflow.schedule.blocked',
                  'approval.approved',
                  'approval.rejected',
                ],
              },
            },
            orderBy: { createdAt: 'desc' },
            take: 100,
          }),
        ]);
        return {
          events: x._count,
          inputTokens: x._sum.inputTokens || 0,
          outputTokens: x._sum.outputTokens || 0,
          costMicros: String(x._sum.costMicros || 0n),
          operational: {
            tasks,
            archivedTasks,
            workflows,
            executions: runs.reduce((sum, r) => sum + r._count, 0),
            executionStates: runs.map((r) => ({ status: r.status, count: r._count })),
            files: storage._count,
            storageBytes: storage._sum.size || 0,
            wikiPages,
          },
          agents: agents.map((agent) => {
            const ai = agentUsage.find((u) => u.agentId === agent.id);
            const files = filesByAgent.find((f) => f.agentId === agent.id);
            return {
              ...agent,
              aiEvents: ai?._count || 0,
              inputTokens: ai?._sum.inputTokens || 0,
              outputTokens: ai?._sum.outputTokens || 0,
              costMicros: String(ai?._sum.costMicros || 0n),
              files: files?._count || 0,
              storageBytes: files?._sum.size || 0,
              wikiPages: wikiByAgent.find((w) => w.agentId === agent.id)?._count || 0,
            };
          }),
          history,
          historySince: since,
        };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }
}
