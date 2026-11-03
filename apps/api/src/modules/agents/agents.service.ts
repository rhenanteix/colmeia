import { quota } from '../billing/quotas';
import { RuntimeService } from '../runtime/runtime.service';
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Db } from '../../platform/persistence/db';
import { Principal, requireRole } from '../../security';
import { Prisma } from '@prisma/client';
import type { AgentDto, PublishDto } from '../../resources';
@Injectable()
export class AgentsService {
  constructor(
    private db: Db,
    private runtime: RuntimeService,
  ) {}
  list(p: Principal) {
    return this.db.agent.findMany({
      where: { organizationId: p.organizationId },
      orderBy: { createdAt: 'desc' },
      include: {
        versions: { orderBy: { version: 'desc' }, take: 1 },
        deployments: { where: { status: 'ACTIVE' }, select: { engine: true } },
      },
    });
  }
  async create(p: Principal, dto: AgentDto) {
    requireRole(p, 'OWNER', 'ADMIN', 'MEMBER');
    const template = dto.templateId
      ? await this.db.agentTemplate.findFirst({
          where: {
            id: dto.templateId,
            OR: [{ organizationId: null }, { organizationId: p.organizationId }],
          },
        })
      : null;
    if (dto.templateId && !template) throw new NotFoundException('Template não encontrado');
    const config = template ? (template.config as Record<string, unknown>) : {};
    const mascot =
      dto.mascot || (typeof config.mascot === 'string' ? config.mascot : 'exploradora');
    if (
      ![
        'rainha',
        'atendimento',
        'exploradora',
        'financeiro',
        'operacoes',
        'rh',
        'seguranca',
        'vendas',
      ].includes(mascot)
    )
      throw new BadRequestException('Mascote inválido no template');
    return this.db.$transaction(async (tx) => {
      await quota(tx, p.organizationId, 'agents');
      const agent = await tx.agent.create({
        data: {
          organizationId: p.organizationId,
          name: dto.name,
          description: dto.description,
          mascot,
        },
      });
      await tx.agentDraft.create({
        data: {
          agentId: agent.id,
          organizationId: p.organizationId,
          config: { ...config, mascot } as Prisma.InputJsonValue,
        },
      });
      await tx.auditEvent.create({
        data: {
          organizationId: p.organizationId,
          actorSubject: p.sub,
          action: 'agent.created',
          resourceId: agent.id,
        },
      });
      return agent;
    });
  }
  async archive(p: Principal, id: string) {
    requireRole(p, 'OWNER', 'ADMIN', 'MEMBER');
    await this.one(p, id);
    return this.db.$transaction(async (tx) => {
      const agent = await tx.agent.update({ where: { id }, data: { status: 'ARCHIVED' } });
      await tx.auditEvent.create({
        data: {
          organizationId: p.organizationId,
          actorSubject: p.sub,
          action: 'agent.archived',
          resourceId: id,
        },
      });
      return agent;
    });
  }
  async one(p: Principal, id: string) {
    const a = await this.db.agent.findFirst({
      where: { id, organizationId: p.organizationId },
      include: { versions: true },
    });
    if (!a) throw new NotFoundException();
    return a;
  }
  async update(p: Principal, id: string, dto: AgentDto) {
    requireRole(p, 'OWNER', 'ADMIN', 'MEMBER');
    await this.one(p, id);
    return this.db.agent.update({
      where: { id },
      data: { name: dto.name, description: dto.description },
    });
  }
  async publish(p: Principal, id: string, dto: PublishDto) {
    requireRole(p, 'OWNER', 'ADMIN');
    await this.one(p, id);
    return this.runtime.publish(p, id, dto.versionId);
  }
}
