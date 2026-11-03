import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { Db } from '../../platform/persistence/db';
import { Principal, requireRole } from '../../security';
import type { ChannelDto, MessageDto, MessageQueryDto } from '../../resources';
import { assertChannelAccess, channelScope } from './channel-access';
@Injectable()
export class ChannelsService {
  constructor(private db: Db) {}
  list(p: Principal) {
    return this.db.channel.findMany({ where: channelScope(p), orderBy: { createdAt: 'asc' } });
  }
  async create(p: Principal, d: ChannelDto) {
    requireRole(p, 'OWNER', 'ADMIN', 'MEMBER');
    const name = d.name.trim();
    if (name.length < 2) throw new BadRequestException('Informe um nome para o canal.');
    if (name.startsWith('dm:'))
      throw new BadRequestException('Este prefixo é reservado para mensagens diretas.');
    try {
      return await this.db.channel.create({ data: { organizationId: p.organizationId, name } });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002')
        throw new ConflictException('Já existe um canal com este nome.');
      throw error;
    }
  }
  async direct(p: Principal, userId: string) {
    requireRole(p, 'OWNER', 'ADMIN', 'MEMBER');
    if (userId === p.sub) throw new BadRequestException('Selecione outro membro.');
    const member = await this.db.membership.findUnique({
      where: { userId_organizationId: { userId, organizationId: p.organizationId } },
      include: { user: { select: { name: true } } },
    });
    if (!member) throw new NotFoundException('Membro não encontrado.');
    const participantIds = [p.sub, userId].sort();
    const directKey = participantIds.join(':');
    return this.db.channel.upsert({
      where: { organizationId_directKey: { organizationId: p.organizationId, directKey } },
      create: {
        organizationId: p.organizationId,
        directKey,
        participantIds,
        name: `dm:${directKey}`,
      },
      update: {},
    });
  }
  async messages(p: Principal, id: string, query: MessageQueryDto = {}) {
    await assertChannelAccess(this.db, p, id);
    const before = query.before
      ? await this.db.message.findFirst({
          where: { id: query.before, channelId: id, organizationId: p.organizationId },
        })
      : null;
    if (query.before && !before) throw new NotFoundException('Mensagem não encontrada.');
    const messages = await this.db.message.findMany({
      where: {
        organizationId: p.organizationId,
        channelId: id,
        ...(query.parentId ? { parentId: query.parentId } : {}),
        ...(before
          ? {
              OR: [
                { createdAt: { lt: before.createdAt } },
                { createdAt: before.createdAt, id: { lt: before.id } },
              ],
            }
          : {}),
      },
      take: 100,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    const authors = await this.db.membership.findMany({
      where: {
        organizationId: p.organizationId,
        userId: { in: messages.map((m) => m.authorSubject) },
      },
      select: { user: { select: { id: true, name: true } } },
    });
    const names = new Map(authors.map((a) => [a.user.id, a.user.name]));
    return messages.map((m) => ({
      ...m,
      authorName: names.get(m.authorSubject) || 'Membro da equipe',
    }));
  }
  async send(p: Principal, id: string, d: MessageDto) {
    requireRole(p, 'OWNER', 'ADMIN', 'MEMBER');
    const channel = await assertChannelAccess(this.db, p, id);
    const body = d.body.trim();
    if (!body) throw new BadRequestException('Escreva uma mensagem.');
    const mentionIds = [...new Set(d.mentionIds || [])];
    return this.db.$transaction(async (tx) => {
      const parent = d.parentId
        ? await tx.message.findFirst({
            where: {
              id: d.parentId,
              channelId: id,
              organizationId: p.organizationId,
              parentId: null,
            },
          })
        : null;
      if (d.parentId && !parent) throw new NotFoundException('Thread não encontrada neste canal.');
      const members = await tx.membership.findMany({
        where: { organizationId: p.organizationId, userId: { in: mentionIds } },
      });
      if (
        members.length !== mentionIds.length ||
        (channel.directKey && mentionIds.some((userId) => !channel.participantIds.includes(userId)))
      )
        throw new BadRequestException('Menção fora desta conversa.');
      const message = await tx.message.create({
        data: {
          organizationId: p.organizationId,
          channelId: id,
          authorSubject: p.sub,
          body,
          parentId: d.parentId,
          mentionIds,
        },
      });
      const recipients = [
        ...new Set([
          ...mentionIds,
          ...(channel.directKey ? channel.participantIds : []),
          ...(parent && !parent.agentId ? [parent.authorSubject] : []),
        ]),
      ].filter((userId) => userId !== p.sub);
      const activeRecipients = await tx.membership.findMany({
        where: { organizationId: p.organizationId, userId: { in: recipients } },
      });
      await tx.notification.createMany({
        data: activeRecipients.map((member) => ({
          organizationId: p.organizationId,
          recipientSubject: member.userId,
          title: mentionIds.includes(member.userId)
            ? 'Você foi mencionado'
            : channel.directKey
              ? 'Nova mensagem direta'
              : 'Nova resposta na thread',
          body: body.slice(0, 500),
        })),
      });
      return message;
    });
  }
  async presence(p: Principal) {
    return this.db.membership.findMany({
      where: { organizationId: p.organizationId },
      select: { userId: true, lastSeenAt: true, user: { select: { name: true } } },
    });
  }
  async heartbeat(p: Principal) {
    await this.db.membership.update({
      where: { userId_organizationId: { userId: p.sub, organizationId: p.organizationId } },
      data: { lastSeenAt: new Date() },
    });
    return { ok: true };
  }
}
