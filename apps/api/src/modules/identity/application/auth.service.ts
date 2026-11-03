import { initialSubscription } from '../../billing/subscriptions.service';
import {
  Injectable,
  BadRequestException,
  ConflictException,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import * as argon2 from 'argon2';
import { Db } from '../../../resources';
import { MailService } from '../../../mail';
import { Principal } from '../../../security';
import { AuthService } from './session.service';
import {
  RegisterDto,
  LoginDto,
  ResetRequestDto,
  ResetConfirmDto,
  SwitchDto,
} from '../identity.dto';
const hash = (v: string) => createHash('sha256').update(v).digest('hex');
const passwordHash = (password: string) => argon2.hash(password, { type: argon2.argon2id });
const passwordMatches = async (password: string, encoded: string) => {
  if (encoded.startsWith('$argon2')) return argon2.verify(encoded, password);
  const [salt, expected] = encoded.split(':');
  if (!salt || !expected || expected.length !== 128) return false;
  return timingSafeEqual(Buffer.from(expected, 'hex'), scryptSync(password, salt, 64));
};
@Injectable()
export class AuthApplicationService {
  constructor(
    private db: Db,
    private auth: AuthService,
    private mail: MailService,
  ) {}
  async register(d: RegisterDto) {
    const email = d.email.trim().toLowerCase();
    if (await this.db.user.findUnique({ where: { email } }))
      throw new ConflictException('Email already registered');
    const slug = 'org-' + randomBytes(6).toString('hex');
    const result = await this.db
      .$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email,
            name: d.name,
            passwordHash: await passwordHash(d.password),
            externalSubject: 'local:' + email,
          },
        });
        const org = await tx.organization.create({
          data: {
            name: d.organizationName,
            slug,
            subscription: { create: initialSubscription() },
            subscriptionEvents: {
              create: {
                idempotencyKey: 'initial',
                type: 'subscription.created',
                actorId: user.id,
                payload: {},
              },
            },
          },
        });
        await tx.membership.create({
          data: { userId: user.id, organizationId: org.id, role: 'OWNER' },
        });
        await tx.auditEvent.create({
          data: {
            organizationId: org.id,
            actorSubject: user.id,
            action: 'organization.created',
            resourceId: org.id,
          },
        });
        return { user, org };
      })
      .catch((error: { code?: string }) => {
        if (error.code === 'P2002') throw new ConflictException('Email already registered');
        throw error;
      });
    return {
      token: await this.auth.issue(result.user.id, result.org.id),
      organization: { id: result.org.id, name: result.org.name },
      user: { id: result.user.id, email: result.user.email, name: result.user.name },
    };
  }
  async login(d: LoginDto) {
    const user = await this.db.user.findUnique({
      where: { email: d.email.trim().toLowerCase() },
      include: { memberships: true },
    });
    if (
      !user?.passwordHash ||
      !(await passwordMatches(d.password, user.passwordHash)) ||
      !user.memberships.length
    )
      throw new UnauthorizedException('Invalid credentials');
    const membership = user.memberships[0];
    return {
      token: await this.auth.issue(user.id, membership.organizationId),
      user: { id: user.id, email: user.email, name: user.name },
      organizationId: membership.organizationId,
    };
  }
  async request(d: ResetRequestDto) {
    const user = await this.db.user.findUnique({ where: { email: d.email.trim().toLowerCase() } });
    if (user) {
      const token = randomBytes(32).toString('hex');
      await this.db.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: hash(token),
          expiresAt: new Date(Date.now() + 30 * 60000),
        },
      });
      await this.mail
        .send(
          user.email,
          'Recupere seu acesso à Colmeia',
          `${process.env.WEB_ORIGIN?.split(',')[0] || 'http://localhost:3000'}/recuperar?token=${token}`,
        )
        .catch(() => {
          // Keep the public response identical for registered and unknown addresses.
          console.error('Password reset delivery failed');
        });
    }
    return {
      message:
        'If this account exists, reset instructions will be sent when email delivery is configured.',
    };
  }
  async confirm(d: ResetConfirmDto) {
    const reset = await this.db.passwordResetToken.findUnique({
      where: { tokenHash: hash(d.token) },
    });
    if (!reset || reset.consumedAt || reset.expiresAt <= new Date())
      throw new BadRequestException('Invalid or expired token');
    const encoded = await passwordHash(d.password);
    await this.db.$transaction(async (tx) => {
      // Serialize resets for one user before consuming any of their tokens.
      // Different valid tokens must not deadlock or both replace the password.
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${reset.userId} FOR UPDATE`;
      const consumed = await tx.passwordResetToken.updateMany({
        where: { id: reset.id, consumedAt: null, expiresAt: { gt: new Date() } },
        data: { consumedAt: new Date() },
      });
      if (!consumed.count) throw new BadRequestException('Invalid or expired token');
      await tx.user.update({
        where: { id: reset.userId },
        data: { passwordHash: encoded, passwordResetHash: null, passwordResetExpiresAt: null },
      });
      await tx.passwordResetToken.updateMany({
        where: { userId: reset.userId, consumedAt: null },
        data: { consumedAt: new Date() },
      });
      await tx.session.updateMany({
        where: { userId: reset.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });
    return { ok: true };
  }
  async refresh(p: Principal) {
    const revoked = await this.db.session.updateMany({
      where: { id: p.sessionId, revokedAt: null, expiresAt: { gt: new Date() } },
      data: { revokedAt: new Date() },
    });
    if (!revoked.count) throw new UnauthorizedException('Session already renewed');
    const token = await this.auth.issue(p.sub, p.organizationId);
    return { token };
  }
  async logout(p: Principal) {
    await this.db.session.updateMany({
      where: { id: p.sessionId, userId: p.sub },
      data: { revokedAt: new Date() },
    });
    return { ok: true };
  }
  async me(p: Principal) {
    const user = await this.db.user.findUnique({
      where: { id: p.sub },
      select: {
        id: true,
        email: true,
        name: true,
        memberships: { include: { organization: true } },
      },
    });
    return { user, activeOrganizationId: p.organizationId, role: p.role };
  }
  async switchOrg(p: Principal, d: SwitchDto) {
    const membership = await this.db.membership.findUnique({
      where: { userId_organizationId: { userId: p.sub, organizationId: d.organizationId } },
    });
    if (!membership) throw new ForbiddenException();
    return { token: await this.auth.issue(p.sub, d.organizationId) };
  }
}
