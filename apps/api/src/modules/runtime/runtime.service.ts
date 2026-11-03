import { OpenClawAdapter } from './openclaw.adapter';
import { RuntimeJobs } from './runtime-jobs.service';
import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { Db } from '../../platform/persistence/db';
import { MastraAdapter } from './mastra.adapter';
import { AiSdkAdapter } from './ai-sdk.adapter';
import { parseRuntimeConfig } from './runtime.config';
import type { AgentRuntimeAdapter, RuntimeEngine } from './runtime.types';
import { Principal, requireRole } from '../../security';
@Injectable()
export class RuntimeService {
  private readonly adapters: Map<RuntimeEngine, AgentRuntimeAdapter>;
  constructor(
    private db: Db,
    mastra: MastraAdapter,
    ai: AiSdkAdapter,
    openclaw: OpenClawAdapter,
    private jobs: RuntimeJobs,
  ) {
    this.adapters = new Map<RuntimeEngine, AgentRuntimeAdapter>([
      [mastra.engine, mastra],
      [ai.engine, ai],
      [openclaw.engine, openclaw],
    ]);
  }
  adapter(engine: RuntimeEngine) {
    const adapter = this.adapters.get(engine);
    if (!adapter)
      throw new ConflictException('Este motor ainda não tem um gateway operacional conectado.');
    return adapter;
  }
  async publish(p: Principal, agentId: string, versionId?: string) {
    requireRole(p, 'OWNER', 'ADMIN');
    const agent = await this.db.agent.findFirst({
      where: { id: agentId, organizationId: p.organizationId, status: { not: 'ARCHIVED' } },
    });
    if (!agent) throw new NotFoundException('Abelhinha não encontrada');
    const version = await this.db.agentVersion.findFirst({
      where: { agentId, ...(versionId ? { id: versionId } : {}) },
      orderBy: { version: 'desc' },
    });
    if (!version) throw new ConflictException('Crie uma versão antes de publicar.');
    const config = parseRuntimeConfig(version.config);
    await this.adapter(config.engine).validateConfig(config, p.organizationId);
    if (config.engine === 'openclaw') {
      const runtime = await this.db.runtimeInstance.findFirstOrThrow({
        where: { organizationId: p.organizationId, status: 'READY' },
      });
      const operation = await this.db.$transaction(async (tx) => {
        await tx.runtimeDeployment.upsert({
          where: { versionId: version.id },
          create: {
            organizationId: p.organizationId,
            agentId,
            versionId: version.id,
            engine: config.engine,
          },
          update: { status: 'PENDING', error: null },
        });
        return tx.runtimeOperation.upsert({
          where: {
            organizationId_idempotencyKey: {
              organizationId: p.organizationId,
              idempotencyKey: `deploy-${version.id}`,
            },
          },
          create: {
            organizationId: p.organizationId,
            runtimeId: runtime.id,
            operation: `deploy:${version.id}`,
            idempotencyKey: `deploy-${version.id}`,
          },
          update: { status: 'queued', error: null },
        });
      });
      await this.jobs.enqueue(operation.id);
      return { status: 'PENDING', operationId: operation.id };
    }
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Agent" WHERE id = ${agentId} FOR UPDATE`;

      const deployment = await tx.runtimeDeployment.upsert({
        where: { versionId: version.id },
        create: {
          organizationId: p.organizationId,
          agentId,
          versionId: version.id,
          engine: config.engine,
          status: 'ACTIVE',
        },
        update: { status: 'ACTIVE', error: null },
      });
      await tx.runtimeDeployment.updateMany({
        where: { agentId, versionId: { not: version.id }, status: 'ACTIVE' },
        data: { status: 'SUPERSEDED' },
      });
      await tx.agentVersion.update({
        where: { id: version.id },
        data: { publishedAt: version.publishedAt ?? new Date() },
      });
      await tx.agent.update({ where: { id: agentId }, data: { status: 'ACTIVE' } });
      await tx.auditEvent.create({
        data: {
          organizationId: p.organizationId,
          actorSubject: p.sub,
          action: 'agent.published',
          resourceId: version.id,
        },
      });
      return deployment;
    });
  }
  async resolve(organizationId: string, agentId: string) {
    const deployment = await this.db.runtimeDeployment.findFirst({
      where: { organizationId, agentId, status: 'ACTIVE', agent: { status: 'ACTIVE' } },
      include: { version: true, agent: { include: { organization: true } } },
      orderBy: { createdAt: 'desc' },
    });
    if (!deployment) throw new ConflictException('Publique a abelhinha antes de conversar.');
    const config = parseRuntimeConfig(deployment.version.config);
    const adapter = this.adapter(config.engine);
    await adapter.validateConfig(config, organizationId);
    return { deployment, config, adapter };
  }
}
