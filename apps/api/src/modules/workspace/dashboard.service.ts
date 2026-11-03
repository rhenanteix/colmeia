import { Injectable } from '@nestjs/common';
import { Db } from '../../platform/persistence/db';
import { Principal } from '../../security';
@Injectable()
export class DashboardService {
  constructor(private db: Db) {}
  async get(p: Principal) {
    const where = { organizationId: p.organizationId };
    const [organization, agents, total, drafts, active, members, activity, executions, failures] =
      await this.db.$transaction([
        this.db.organization.findUniqueOrThrow({ where: { id: p.organizationId } }),
        this.db.agent.findMany({ where, orderBy: { createdAt: 'desc' }, take: 6 }),
        this.db.agent.count({ where }),
        this.db.agent.count({ where: { ...where, status: 'DRAFT' } }),
        this.db.agent.count({ where: { ...where, status: 'ACTIVE' } }),
        this.db.membership.count({ where }),
        this.db.auditEvent.findMany({ where, orderBy: { createdAt: 'desc' }, take: 12 }),
        this.db.agentExecution.count({ where }),
        this.db.agentExecution.count({
          where: { ...where, status: { in: ['FAILED', 'TIMED_OUT'] } },
        }),
      ]);
    return {
      organization,
      agents,
      stats: { total, drafts, active, members, executions, failures },
      activity,
    };
  }
}
