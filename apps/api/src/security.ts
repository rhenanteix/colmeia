import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  createParamDecorator,
} from '@nestjs/common';
import { jwtVerify } from 'jose';
import { PrismaClient } from '@prisma/client';
import type { Request } from 'express';
export type Principal = {
  sub: string;
  sessionId: string;
  organizationId: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
};
export const CurrentPrincipal = createParamDecorator(
  (_data, ctx: ExecutionContext) => ctx.switchToHttp().getRequest().principal as Principal,
);
@Injectable()
export class JwtGuard implements CanActivate {
  constructor(private readonly db: PrismaClient) {}
  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest<Request & { principal?: Principal }>();
    const raw = req.headers.authorization;
    if (!raw?.startsWith('Bearer ')) throw new UnauthorizedException('Bearer token required');
    const secret = process.env.AUTH_JWT_SECRET;
    if (!secret || secret.length < 32) throw new UnauthorizedException('Auth not configured');
    try {
      const { payload } = await jwtVerify(raw.slice(7), new TextEncoder().encode(secret), {
        issuer: 'colmeia',
        audience: 'colmeia-api',
      });
      if (typeof payload.sub !== 'string' || typeof payload.organizationId !== 'string')
        throw Error('invalid claims');
      if (typeof payload.jti !== 'string') throw Error('session required');
      const session = await this.db.session.findUnique({ where: { id: payload.jti } });
      if (
        !session ||
        session.userId !== payload.sub ||
        session.revokedAt ||
        session.expiresAt <= new Date()
      )
        throw Error('session expired or revoked');
      const user = await this.db.user.findUnique({ where: { id: payload.sub } });
      if (!user) throw Error('unknown user');
      const membership = await this.db.membership.findUnique({
        where: {
          userId_organizationId: { userId: user.id, organizationId: payload.organizationId },
        },
      });
      if (!membership) throw Error('membership revoked');
      req.principal = {
        sub: user.id,
        sessionId: session.id,
        organizationId: payload.organizationId,
        role: membership.role,
      };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
export function requireRole(p: Principal, ...roles: Principal['role'][]) {
  if (!roles.includes(p.role)) throw new ForbiddenException('Insufficient role');
}
