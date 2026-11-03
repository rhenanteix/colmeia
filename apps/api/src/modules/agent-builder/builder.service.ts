import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Db } from '../../resources';
import { Principal, requireRole } from '../../security';
import { DraftDto } from './builder.dto';
@Injectable()
export class BuilderService {
  constructor(private db: Db) {}
  async get(p: Principal, agentId: string) {
    await this.check(p, agentId);
    return this.db.agentDraft.findUnique({ where: { agentId } });
  }
  async save(p: Principal, agentId: string, d: DraftDto) {
    requireRole(p, 'OWNER', 'ADMIN', 'MEMBER');
    await this.check(p, agentId);
    for (const key of [
      'changeSummary',
      'instructions',
      'model',
      'provider',
      'mascot',
      'objective',
      'tone',
      'restrictions',
      'context',
      'name',
      'description',
    ]) {
      if (
        d.config[key] !== undefined &&
        (typeof d.config[key] !== 'string' || String(d.config[key]).length > 16000)
      )
        throw new BadRequestException(`Configuração inválida: ${key}`);
    }
    for (const [key, min, max] of [
      ['temperature', 0, 2],
      ['maxOutputTokens', 1, 128000],
      ['monthlyExecutionLimit', 1, 1000000],
    ] as const) {
      const value = d.config[key];
      if (
        value !== undefined &&
        (typeof value !== 'number' ||
          !Number.isFinite(value) ||
          value < min ||
          value > max ||
          (key !== 'temperature' && !Number.isInteger(value)))
      )
        throw new BadRequestException(`Limite inválido: ${key}`);
    }
    if (d.config.approvalRequired !== undefined && typeof d.config.approvalRequired !== 'boolean')
      throw new BadRequestException('Política de aprovação inválida');
    return this.db.$transaction(async (tx) => {
      await tx.agentDraft.createMany({
        data: [{ agentId, organizationId: p.organizationId, config: {} }],
        skipDuplicates: true,
      });
      const updated = await tx.agentDraft.updateMany({
        where: { agentId, organizationId: p.organizationId, revision: d.revision },
        data: { config: d.config as Prisma.InputJsonValue, revision: { increment: 1 } },
      });
      if (!updated.count)
        throw new ConflictException(
          'O rascunho foi alterado em outra sessão. Reabra antes de salvar.',
        );
      const mascot = d.config.mascot;
      if (
        mascot !== undefined &&
        ![
          'rainha',
          'atendimento',
          'exploradora',
          'financeiro',
          'operacoes',
          'rh',
          'seguranca',
          'vendas',
        ].includes(String(mascot))
      )
        throw new BadRequestException('Mascote inválido');
      const name = d.config.name;
      const description = d.config.description;
      if (
        name !== undefined &&
        (typeof name !== 'string' || name.trim().length < 2 || name.length > 100)
      )
        throw new BadRequestException('Nome inválido');
      if (
        description !== undefined &&
        (typeof description !== 'string' || description.length > 1000)
      )
        throw new BadRequestException('Descrição inválida');
      await tx.agent.update({
        where: { id: agentId },
        data: {
          ...(typeof mascot === 'string' ? { mascot } : {}),
          ...(typeof name === 'string' ? { name } : {}),
          ...(typeof description === 'string' ? { description } : {}),
        },
      });
      await tx.auditEvent.create({
        data: {
          organizationId: p.organizationId,
          actorSubject: p.sub,
          action: 'agent.draft.saved',
          resourceId: agentId,
        },
      });
      return tx.agentDraft.findUniqueOrThrow({ where: { agentId } });
    });
  }
  async versions(p: Principal, agentId: string) {
    await this.check(p, agentId);
    return this.db.agentVersion.findMany({ where: { agentId }, orderBy: { version: 'desc' } });
  }
  async version(p: Principal, agentId: string, d: DraftDto) {
    requireRole(p, 'OWNER', 'ADMIN', 'MEMBER');
    await this.check(p, agentId);
    for (const key of [
      'changeSummary',
      'instructions',
      'model',
      'provider',
      'mascot',
      'objective',
      'tone',
      'restrictions',
      'context',
      'name',
      'description',
    ]) {
      if (
        d.config[key] !== undefined &&
        (typeof d.config[key] !== 'string' || String(d.config[key]).length > 16000)
      )
        throw new BadRequestException(`Configuração inválida: ${key}`);
    }
    return this.db.$transaction(async (tx) => {
      const locked = await tx.agentDraft.updateMany({
        where: { agentId, revision: d.revision, organizationId: p.organizationId },
        data: { revision: { increment: 1 } },
      });
      if (!locked.count)
        throw new ConflictException('Salve e recarregue o rascunho antes de criar a versão.');
      const draft = await tx.agentDraft.findUniqueOrThrow({ where: { agentId } });
      const config = draft.config as Record<string, unknown>;
      if (
        typeof config.instructions !== 'string' ||
        config.instructions.trim().length < 10 ||
        typeof config.model !== 'string' ||
        !config.model.trim()
      )
        throw new BadRequestException('Preencha instruções (10 caracteres) e modelo.');
      const last = await tx.agentVersion.findFirst({
        where: { agentId },
        orderBy: { version: 'desc' },
      });
      const version = await tx.agentVersion.create({
        data: {
          agentId,
          authorSubject: p.sub,
          version: (last?.version ?? 0) + 1,
          config: draft.config as Prisma.InputJsonValue,
        },
      });
      await tx.auditEvent.create({
        data: {
          organizationId: p.organizationId,
          actorSubject: p.sub,
          action: 'agent.version.created',
          resourceId: version.id,
        },
      });
      return { version, revision: draft.revision };
    });
  }
  private async check(p: Principal, id: string) {
    if (!(await this.db.agent.findFirst({ where: { id, organizationId: p.organizationId } })))
      throw new NotFoundException('Agent not found');
  }
}
