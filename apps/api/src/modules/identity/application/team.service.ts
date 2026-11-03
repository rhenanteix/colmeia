import { quota } from '../../billing/quotas';
import {
  Injectable,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes, createHash } from 'node:crypto';
import { Db } from '../../../resources';
import { MailService } from '../../../mail';
import { Principal, requireRole } from '../../../security';
import { InviteDto, AcceptDto } from '../identity.dto';
const hash = (v: string) => createHash('sha256').update(v).digest('hex');
@Injectable()
export class TeamService {
  constructor(
    private db: Db,
    private mail: MailService,
  ) {}
  async members(p: Principal) {
    return this.db.membership.findMany({
      where: { organizationId: p.organizationId },
      select: { id: true, role: true, user: { select: { id: true, email: true, name: true } } },
    });
  }
  async updateMember(p: Principal, id: string, d: InviteDto) {
    requireRole(p, 'OWNER', 'ADMIN');
    const member = await this.db.membership.findFirst({
      where: { id, organizationId: p.organizationId },
    });
    if (!member) throw new NotFoundException();
    if (member.role === 'OWNER')
      throw new ForbiddenException('O proprietário não pode ser alterado por este fluxo');
    return this.db.$transaction(async (tx) => {
      const result = await tx.membership.update({ where: { id }, data: { role: d.role } });
      await tx.auditEvent.create({
        data: {
          organizationId: p.organizationId,
          actorSubject: p.sub,
          action: 'team.role.updated',
          resourceId: id,
        },
      });
      return result;
    });
  }
  async removeMember(p: Principal, id: string) {
    requireRole(p, 'OWNER', 'ADMIN');
    const result = await this.db.membership.deleteMany({
      where: { id, organizationId: p.organizationId, role: { not: 'OWNER' } },
    });
    if (!result.count)
      throw new NotFoundException('Membro não encontrado ou proprietário protegido');
    await this.db.auditEvent.create({
      data: {
        organizationId: p.organizationId,
        actorSubject: p.sub,
        action: 'team.removed',
        resourceId: id,
      },
    });
    return { ok: true };
  }
  async invite(p: Principal, d: InviteDto) {
    requireRole(p, 'OWNER', 'ADMIN');
    const token = randomBytes(32).toString('hex');
    const invitation = await this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Organization" WHERE id = ${p.organizationId} FOR UPDATE`;
      const existing = await tx.invitation.findFirst({
        where: {
          organizationId: p.organizationId,
          email: d.email.trim().toLowerCase(),
          acceptedAt: null,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
      });
      if (existing) throw new ConflictException('Já existe um convite pendente para este email');
      const invitation = await tx.invitation.create({
        data: {
          organizationId: p.organizationId,
          email: d.email.trim().toLowerCase(),
          role: d.role,
          tokenHash: hash(token),
          expiresAt: new Date(Date.now() + 7 * 86400000),
        },
      });
      await tx.auditEvent.create({
        data: {
          organizationId: p.organizationId,
          actorSubject: p.sub,
          action: 'team.invited',
          resourceId: invitation.id,
        },
      });
      return invitation;
    });
    await this.deliver(invitation.email, token);
    return { id: invitation.id, expiresAt: invitation.expiresAt };
  }
  private deliver(email: string, token: string) {
    return this.mail.send(
      email,
      'Você foi convidado para a Colmeia',
      `${process.env.WEB_ORIGIN?.split(',')[0] || 'http://localhost:3000'}/convite?token=${token}`,
    );
  }
  async invitations(p: Principal) {
    requireRole(p, 'OWNER', 'ADMIN');
    return this.db.invitation.findMany({
      where: { organizationId: p.organizationId },
      select: {
        id: true,
        email: true,
        role: true,
        expiresAt: true,
        acceptedAt: true,
        revokedAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
  async revoke(p: Principal, id: string) {
    requireRole(p, 'OWNER', 'ADMIN');
    const result = await this.db.invitation.updateMany({
      where: { id, organizationId: p.organizationId, acceptedAt: null, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (!result.count) throw new NotFoundException('Convite não encontrado');
    await this.db.auditEvent.create({
      data: {
        organizationId: p.organizationId,
        actorSubject: p.sub,
        action: 'team.invitation.revoked',
        resourceId: id,
      },
    });
    return { ok: true };
  }
  async resend(p: Principal, id: string) {
    requireRole(p, 'OWNER', 'ADMIN');
    const token = randomBytes(32).toString('hex');
    const invitation = await this.db.$transaction(async (tx) => {
      const result = await tx.invitation.updateMany({
        where: { id, organizationId: p.organizationId, acceptedAt: null, revokedAt: null },
        data: { tokenHash: hash(token), expiresAt: new Date(Date.now() + 7 * 86400000) },
      });
      if (!result.count) throw new NotFoundException('Convite não encontrado');
      return tx.invitation.findUniqueOrThrow({ where: { id } });
    });
    await this.deliver(invitation.email, token);
    await this.db.auditEvent.create({
      data: {
        organizationId: p.organizationId,
        actorSubject: p.sub,
        action: 'team.invitation.resent',
        resourceId: id,
      },
    });
    return { ok: true };
  }
  async accept(p: Principal, d: AcceptDto) {
    const invitation = await this.db.invitation.findUnique({ where: { tokenHash: hash(d.token) } });
    if (
      !invitation ||
      invitation.acceptedAt ||
      invitation.revokedAt ||
      invitation.expiresAt < new Date()
    )
      throw new BadRequestException('Invitation expired or invalid');
    const user = await this.db.user.findUnique({ where: { id: p.sub } });
    if (!user || user.email !== invitation.email)
      throw new ForbiddenException('Invitation belongs to another email');
    await this.db.$transaction(async (tx) => {
      if (
        !(await tx.membership.findUnique({
          where: {
            userId_organizationId: { userId: user.id, organizationId: invitation.organizationId },
          },
        }))
      )
        await quota(tx, invitation.organizationId, 'users');
      const consumed = await tx.invitation.updateMany({
        where: {
          id: invitation.id,
          tokenHash: hash(d.token),
          acceptedAt: null,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { acceptedAt: new Date() },
      });
      if (!consumed.count) throw new BadRequestException('Convite inválido ou já aceito');
      await tx.auditEvent.create({
        data: {
          organizationId: invitation.organizationId,
          actorSubject: p.sub,
          action: 'team.invitation.accepted',
          resourceId: invitation.id,
        },
      });
      await tx.membership.upsert({
        where: {
          userId_organizationId: { userId: user.id, organizationId: invitation.organizationId },
        },
        create: {
          userId: user.id,
          organizationId: invitation.organizationId,
          role: invitation.role,
        },
        update: {},
      });
      await tx.invitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date() },
      });
    });
    return { organizationId: invitation.organizationId };
  }
}
