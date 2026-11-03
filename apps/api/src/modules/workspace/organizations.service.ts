import { initialSubscription } from '../billing/subscriptions.service';
import { quota } from '../billing/quotas';
import { Injectable, ConflictException } from '@nestjs/common';
import { Db } from '../../platform/persistence/db';
import { Principal, requireRole } from '../../security';
import type { OrganizationDto } from '../../workspace';
@Injectable()
export class OrganizationsService {
  constructor(private db: Db) {}
  list(p: Principal) {
    return this.db.organization.findMany({
      where: { memberships: { some: { userId: p.sub } } },
      orderBy: { name: 'asc' },
    });
  }
  async create(p: Principal, d: OrganizationDto) {
    try {
      requireRole(p, 'OWNER', 'ADMIN');
      return await this.db.$transaction(async (tx) => {
        await quota(tx, p.organizationId, 'workspaces');
        const parent = await tx.organization.findUniqueOrThrow({ where: { id: p.organizationId } });
        return tx.organization.create({
          data: {
            ...d,
            subscription: { create: initialSubscription() },
            subscriptionEvents: {
              create: {
                idempotencyKey: 'initial',
                type: 'subscription.created',
                actorId: p.sub,
                payload: {},
              },
            },
            workspaceRootId: parent.workspaceRootId || parent.id,
            memberships: { create: { userId: p.sub, role: 'OWNER' } },
            auditEvents: { create: { actorSubject: p.sub, action: 'organization.created' } },
          },
        });
      });
    } catch (e) {
      if (
        (
          e as {
            code?: string;
          }
        ).code === 'P2002'
      )
        throw new ConflictException('Este slug já está em uso');
      throw e;
    }
  }
  async update(p: Principal, d: OrganizationDto) {
    requireRole(p, 'OWNER', 'ADMIN');
    try {
      return await this.db.organization.update({
        where: { id: p.organizationId },
        data: {
          ...d,
          auditEvents: { create: { actorSubject: p.sub, action: 'organization.updated' } },
        },
      });
    } catch (e) {
      if (
        (
          e as {
            code?: string;
          }
        ).code === 'P2002'
      )
        throw new ConflictException('Este slug já está em uso');
      throw e;
    }
  }
}
