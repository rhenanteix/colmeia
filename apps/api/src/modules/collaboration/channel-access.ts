import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import type { PrismaClient, Prisma } from '@prisma/client';
import type { Principal } from '../../security';

export function channelScope(p: Principal): Prisma.ChannelWhereInput {
  return {
    organizationId: p.organizationId,
    OR: [{ directKey: null }, { participantIds: { has: p.sub } }],
  };
}
export async function assertChannelAccess(db: PrismaClient, p: Principal, id: string) {
  const channel = await db.channel.findFirst({ where: { id, ...channelScope(p) } });
  if (!channel) throw new NotFoundException('Canal não encontrado.');
  return channel;
}
export async function assertLiveSession(db: PrismaClient, p: Principal) {
  const [session, member] = await Promise.all([
    db.session.findFirst({
      where: { id: p.sessionId, userId: p.sub, revokedAt: null, expiresAt: { gt: new Date() } },
    }),
    db.membership.findUnique({
      where: { userId_organizationId: { userId: p.sub, organizationId: p.organizationId } },
    }),
  ]);
  if (!session || !member) throw new UnauthorizedException('Acesso revogado.');
}
