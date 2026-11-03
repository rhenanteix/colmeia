import { Injectable, BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Db } from '../../platform/persistence/db';
import { Principal, requireRole } from '../../security';
import { plans, resources, used } from './quotas';
export type SubscriptionCommand = {
  action: 'change' | 'cancel' | 'reactivate';
  planId?: string;
  revision: number;
  idempotencyKey: string;
};
export interface BillingProvider {
  apply(
    organizationId: string,
    command: SubscriptionCommand,
  ): Promise<{ paymentStatus: 'not_required' | 'paid' | 'failed'; reference: string }>;
}
@Injectable()
export class InternalBillingProvider implements BillingProvider {
  async apply(
    organizationId: string,
    command: SubscriptionCommand,
  ): ReturnType<BillingProvider['apply']> {
    return {
      paymentStatus: 'not_required' as const,
      reference: `internal:${organizationId}:${command.idempotencyKey}`,
    };
  }
}
export function initialSubscription() {
  const days = Math.min(90, Math.max(0, Number(process.env.BILLING_TRIAL_DAYS) || 0));
  return {
    planId: days ? 'team' : 'free',
    status: days ? 'trialing' : 'active',
    paymentStatus: days ? 'trial' : 'not_required',
    ...(days ? { trialEndsAt: new Date(Date.now() + days * 86400000) } : {}),
  };
}
@Injectable()
export class SubscriptionsService {
  constructor(
    private db: Db,
    private provider: InternalBillingProvider,
  ) {}
  private async ensure(tx: Prisma.TransactionClient, organizationId: string) {
    await tx.$queryRaw`SELECT id FROM "Organization" WHERE id = ${organizationId} FOR UPDATE`;
    let sub = await tx.subscription.findUnique({ where: { organizationId } });
    if (!sub) {
      sub = await tx.subscription.create({ data: { organizationId, ...initialSubscription() } });
      await tx.subscriptionEvent.create({
        data: {
          organizationId,
          idempotencyKey: 'initial',
          type: 'subscription.created',
          actorId: 'system',
          payload: { planId: sub.planId, status: sub.status },
        },
      });
    }
    if (sub.status === 'trialing' && sub.trialEndsAt && sub.trialEndsAt <= new Date()) {
      sub = await tx.subscription.update({
        where: { organizationId },
        data: { status: 'trial_expired', revision: { increment: 1 } },
      });
      await tx.subscriptionEvent.create({
        data: {
          organizationId,
          idempotencyKey: 'trial-expired',
          type: 'subscription.trial_expired',
          actorId: 'system',
          payload: {},
        },
      });
    }
    return sub;
  }
  async get(p: Principal) {
    const subscription = await this.db.$transaction((tx) => this.ensure(tx, p.organizationId));
    const events = await this.db.subscriptionEvent.findMany({
      where: { organizationId: p.organizationId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return {
      subscription,
      events,
      integration: { mode: 'internal', stripe: 'not_configured', chargesEnabled: false },
    };
  }
  async command(p: Principal, d: SubscriptionCommand) {
    requireRole(p, 'OWNER', 'ADMIN');
    return this.db.$transaction(
      async (tx) => {
        const sub = await this.ensure(tx, p.organizationId);
        const existing = await tx.subscriptionEvent.findUnique({
          where: {
            organizationId_idempotencyKey: {
              organizationId: p.organizationId,
              idempotencyKey: 'command:' + d.idempotencyKey,
            },
          },
        });
        if (existing) {
          const previous = existing.payload as { action: string; planId?: string };
          if (previous.action !== d.action || previous.planId !== d.planId)
            throw new ConflictException('Chave de idempotência já usada em outra operação.');
          return sub;
        }
        if (sub.revision !== d.revision)
          throw new ConflictException('Assinatura alterada. Recarregue antes de tentar novamente.');
        const planId = d.action === 'change' ? d.planId : sub.planId;
        const plan = plans.find((plan) => plan.id === planId);
        if (!plan) throw new BadRequestException('Plano inválido.');
        if (
          d.action === 'reactivate' &&
          !['cancelled', 'past_due', 'trial_expired'].includes(sub.status)
        )
          throw new ConflictException('Assinatura já está ativa.');
        if (d.action === 'cancel' && sub.status === 'cancelled')
          throw new ConflictException('Assinatura já está cancelada.');
        if (d.action === 'change') {
          const org = await tx.organization.findUniqueOrThrow({ where: { id: p.organizationId } });
          for (const resource of resources) {
            if (resource === 'workspaces' && org.workspaceRootId) continue;
            if ((await used(tx, p.organizationId, resource)) > plan.limits[resource])
              throw new ConflictException(
                `Reduza o consumo de ${resource} antes de mudar para este plano.`,
              );
          }
        }
        const payment = await this.provider.apply(p.organizationId, d);
        const status =
          d.action === 'cancel'
            ? 'cancelled'
            : payment.paymentStatus === 'failed'
              ? 'past_due'
              : 'active';
        const updated = await tx.subscription.update({
          where: { organizationId: p.organizationId },
          data: {
            planId: payment.paymentStatus === 'failed' ? sub.planId : plan.id,
            status,
            paymentStatus: payment.paymentStatus,
            trialEndsAt: null,
            revision: { increment: 1 },
          },
        });
        await tx.subscriptionEvent.create({
          data: {
            organizationId: p.organizationId,
            idempotencyKey: 'command:' + d.idempotencyKey,
            type:
              payment.paymentStatus === 'failed' ? 'payment.failed' : 'subscription.' + d.action,
            actorId: p.sub,
            payload: {
              action: d.action,
              ...(d.planId ? { planId: d.planId } : {}),
              previousPlan: sub.planId,
              plan: updated.planId,
              status,
              reference: payment.reference,
            },
          },
        });
        await tx.auditEvent.create({
          data: {
            organizationId: p.organizationId,
            actorSubject: p.sub,
            action: 'subscription.' + d.action,
            resourceId: p.organizationId,
            metadata: { status, planId: updated.planId },
          },
        });
        return updated;
      },
      { timeout: 10000 },
    );
  }
}
