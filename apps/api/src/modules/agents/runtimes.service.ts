import { Injectable, ConflictException } from '@nestjs/common';
import { encryptionKey } from '@colmeia/openclaw-adapter';
import { Db } from '../../platform/persistence/db';
import { Principal, requireRole } from '../../security';
import { RuntimeJobs } from '../runtime/runtime-jobs.service';
@Injectable()
export class RuntimesService {
  constructor(
    private db: Db,
    private jobs: RuntimeJobs,
  ) {}
  list(p: Principal) {
    return this.db.runtimeInstance.findMany({
      where: { organizationId: p.organizationId },
      select: {
        id: true,
        status: true,
        createdAt: true,
        checkedAt: true,
        error: true,
        operations: {
          select: { id: true, operation: true, status: true, error: true },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });
  }
  async provision(p: Principal) {
    requireRole(p, 'OWNER', 'ADMIN');
    try {
      encryptionKey();
    } catch {
      throw new ConflictException('Configure a chave de criptografia do runtime no servidor.');
    }
    const operation = await this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Organization" WHERE id = ${p.organizationId} FOR UPDATE`;
      let runtime = await tx.runtimeInstance.findFirst({
        where: { organizationId: p.organizationId, status: { not: 'DESTROYED' } },
      });
      if (!runtime)
        runtime = await tx.runtimeInstance.create({ data: { organizationId: p.organizationId } });
      if (runtime.status === 'READY') return null;
      await tx.runtimeInstance.update({
        where: { id: runtime.id },
        data: { status: 'REQUESTED', error: null },
      });
      return tx.runtimeOperation.upsert({
        where: {
          organizationId_idempotencyKey: {
            organizationId: p.organizationId,
            idempotencyKey: `provision-${runtime.id}`,
          },
        },
        create: {
          organizationId: p.organizationId,
          runtimeId: runtime.id,
          operation: 'provision',
          idempotencyKey: `provision-${runtime.id}`,
        },
        update: { status: 'queued', error: null },
      });
    });
    if (operation) await this.jobs.enqueue(operation.id);
    return this.list(p);
  }
  async destroy(p: Principal, id: string) {
    requireRole(p, 'OWNER', 'ADMIN');
    const runtime = await this.db.runtimeInstance.findFirst({
      where: { id, organizationId: p.organizationId, status: { not: 'DESTROYED' } },
    });
    if (!runtime) throw new ConflictException('Ambiente não encontrado.');
    await this.db.runtimeInstance.update({ where: { id }, data: { status: 'SUSPENDED' } });
    const operation = await this.db.runtimeOperation.upsert({
      where: {
        organizationId_idempotencyKey: {
          organizationId: p.organizationId,
          idempotencyKey: `destroy-${id}`,
        },
      },
      create: {
        organizationId: p.organizationId,
        runtimeId: id,
        operation: 'destroy',
        idempotencyKey: `destroy-${id}`,
      },
      update: { status: 'queued', error: null },
    });
    await this.jobs.enqueue(operation.id);
    return { status: 'SUSPENDED' };
  }
}
