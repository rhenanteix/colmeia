import { ConflictException } from '@nestjs/common';
import { Prisma, Subscription } from '@prisma/client';
export const resources = [
  'users',
  'agents',
  'workflows',
  'executions',
  'storage',
  'files',
  'workspaces',
  'integrations',
] as const;
export type Resource = (typeof resources)[number];
export const plans = [
  {
    id: 'free',
    name: 'Essencial',
    limits: {
      users: 3,
      agents: 3,
      workflows: 5,
      executions: 100,
      storage: 50 * 1024 * 1024,
      files: 20,
      workspaces: 2,
      integrations: 2,
    },
  },
  {
    id: 'team',
    name: 'Equipe',
    limits: {
      users: 25,
      agents: 25,
      workflows: 50,
      executions: 10000,
      storage: 5 * 1024 ** 3,
      files: 2000,
      workspaces: 10,
      integrations: 20,
    },
  },
  {
    id: 'business',
    name: 'Empresarial',
    limits: {
      users: 250,
      agents: 250,
      workflows: 500,
      executions: 100000,
      storage: 50 * 1024 ** 3,
      files: 20000,
      workspaces: 50,
      integrations: 100,
    },
  },
];
export function effectivePlan(subscription: Subscription | null) {
  const inactive =
    subscription &&
    (['cancelled', 'past_due', 'trial_expired'].includes(subscription.status) ||
      (subscription.status === 'trialing' &&
        subscription.trialEndsAt &&
        subscription.trialEndsAt <= new Date()));
  return (
    plans.find((p) => p.id === (!subscription || inactive ? 'free' : subscription.planId)) ||
    plans[0]
  );
}
export function monthStart() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}
export async function used(
  tx: Prisma.TransactionClient,
  organizationId: string,
  resource: Resource,
): Promise<number> {
  const where = { organizationId };
  switch (resource) {
    case 'users':
      return tx.membership.count({ where });
    case 'agents':
      return tx.agent.count({ where: { ...where, status: { not: 'ARCHIVED' } } });
    case 'workflows':
      return tx.workflow.count({ where });
    case 'executions':
      return (
        (await tx.workflowRun.count({ where: { ...where, createdAt: { gte: monthStart() } } })) +
        (await tx.agentExecution.count({ where: { ...where, createdAt: { gte: monthStart() } } }))
      );
    case 'storage':
      return (await tx.knowledgeDocument.aggregate({ where, _sum: { size: true } }))._sum.size || 0;
    case 'files':
      return tx.knowledgeDocument.count({ where });
    case 'integrations':
      return tx.providerConnection.count({ where });
    case 'workspaces': {
      const org = await tx.organization.findUniqueOrThrow({ where: { id: organizationId } });
      return (
        1 +
        (await tx.organization.count({ where: { workspaceRootId: org.workspaceRootId || org.id } }))
      );
    }
  }
}
export async function quota(
  tx: Prisma.TransactionClient,
  organizationId: string,
  resource: Resource,
  amount = 1,
) {
  let scope = organizationId;
  if (resource === 'workspaces') {
    const org = await tx.organization.findUniqueOrThrow({ where: { id: organizationId } });
    scope = org.workspaceRootId || org.id;
  }
  await tx.$queryRaw`SELECT id FROM "Organization" WHERE id = ${scope} FOR NO KEY UPDATE`;
  const plan = effectivePlan(
    await tx.subscription.findUnique({ where: { organizationId: scope } }),
  );
  if ((await used(tx, scope, resource)) + amount > plan.limits[resource])
    throw new ConflictException(`Quota de ${resource} atingida no plano ${plan.name}.`);
}
export async function quotaSummary(tx: Prisma.TransactionClient, organizationId: string) {
  const sub = await tx.subscription.findUnique({ where: { organizationId } });
  const plan = effectivePlan(sub);
  const org = await tx.organization.findUniqueOrThrow({ where: { id: organizationId } });
  const workspacePlan = org.workspaceRootId
    ? effectivePlan(
        await tx.subscription.findUnique({ where: { organizationId: org.workspaceRootId } }),
      )
    : plan;
  const quotas = await Promise.all(
    resources.map(async (resource) => {
      const usage = await used(tx, organizationId, resource);
      const limit = (resource === 'workspaces' ? workspacePlan : plan).limits[resource];
      return {
        resource,
        used: usage,
        limit,
        available: Math.max(0, limit - usage),
        percent: limit ? Math.round((usage / limit) * 100) : 0,
        alert: usage >= limit ? 'limit' : usage >= limit * 0.8 ? 'warning' : null,
      };
    }),
  );
  return { plan: plan.id, periodStart: monthStart(), quotas };
}
