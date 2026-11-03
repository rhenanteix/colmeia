import 'reflect-metadata';
import { createRequire } from 'node:module';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { SignJWT } from 'jose';
const require = createRequire(import.meta.url);
const { JwtGuard } = require('../../apps/api/dist/security.js');
const { BuilderService } = require('../../apps/api/dist/modules/agent-builder/builder.service.js');
const principal = {
  sub: 'user-a',
  organizationId: 'org-a',
  sessionId: 'session-a',
  role: 'MEMBER',
};
const secret = 'unit-test-only-secret-with-at-least-32-characters';
let previousSecret;
beforeEach(() => {
  previousSecret = process.env.AUTH_JWT_SECRET;
  process.env.AUTH_JWT_SECRET = secret;
});
afterEach(() => {
  if (previousSecret === undefined) delete process.env.AUTH_JWT_SECRET;
  else process.env.AUTH_JWT_SECRET = previousSecret;
});
async function token(claims = {}) {
  return new SignJWT({ organizationId: 'org-a', role: 'OWNER', ...claims })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject('user-a')
    .setJti('session-a')
    .setIssuer('colmeia')
    .setAudience('colmeia-api')
    .setExpirationTime('1h')
    .sign(new TextEncoder().encode(secret));
}
function fixture() {
  const db = {
    session: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'session-a',
        userId: 'user-a',
        expiresAt: new Date(Date.now() + 60000),
        revokedAt: null,
      }),
    },
    user: { findUnique: vi.fn().mockResolvedValue({ id: 'user-a' }) },
    membership: { findUnique: vi.fn().mockResolvedValue({ role: 'VIEWER' }) },
  };
  const request = { headers: {} };
  const context = { switchToHttp: () => ({ getRequest: () => request }) };
  return { db, request, context, guard: new JwtGuard(db) };
}
describe('Session guard', () => {
  it('rejects missing credentials before querying persistence', async () => {
    const f = fixture();
    await expect(f.guard.canActivate(f.context)).rejects.toMatchObject({ status: 401 });
    expect(f.db.session.findUnique).not.toHaveBeenCalled();
  });
  it('uses current membership role instead of the JWT role', async () => {
    const f = fixture();
    f.request.headers.authorization = `Bearer ${await token()}`;
    await expect(f.guard.canActivate(f.context)).resolves.toBe(true);
    expect(f.request.principal.role).toBe('VIEWER');
  });
  it('rejects revoked membership', async () => {
    const f = fixture();
    f.db.membership.findUnique.mockResolvedValue(null);
    f.request.headers.authorization = `Bearer ${await token()}`;
    await expect(f.guard.canActivate(f.context)).rejects.toMatchObject({ status: 401 });
  });
  it('rejects expired persisted session even when JWT is still valid', async () => {
    const f = fixture();
    f.db.session.findUnique.mockResolvedValue({ userId: 'user-a', expiresAt: new Date(0) });
    f.request.headers.authorization = `Bearer ${await token()}`;
    await expect(f.guard.canActivate(f.context)).rejects.toMatchObject({ status: 401 });
  });
  it('rejects session belonging to a different subject', async () => {
    const f = fixture();
    f.db.session.findUnique.mockResolvedValue({
      userId: 'other',
      expiresAt: new Date(Date.now() + 60000),
    });
    f.request.headers.authorization = `Bearer ${await token()}`;
    await expect(f.guard.canActivate(f.context)).rejects.toMatchObject({ status: 401 });
  });
  it('rejects invalid signature', async () => {
    const f = fixture();
    f.request.headers.authorization = `Bearer ${await token()}`;
    process.env.AUTH_JWT_SECRET = 'a-different-valid-length-secret-123456789';
    await expect(f.guard.canActivate(f.context)).rejects.toMatchObject({ status: 401 });
  });
});
describe('Draft service', () => {
  it('denies writes by a viewer before touching persistence', async () => {
    const db = { $transaction: vi.fn() };
    await expect(
      new BuilderService(db).save({ ...principal, role: 'VIEWER' }, 'agent-a', {
        revision: 0,
        config: {},
      }),
    ).rejects.toMatchObject({ status: 403 });
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  it('does not read a draft when its agent is absent from the active tenant', async () => {
    const db = {
      agent: { findFirst: vi.fn().mockResolvedValue(null) },
      agentDraft: { findUnique: vi.fn() },
    };
    await expect(new BuilderService(db).get(principal, 'other-agent')).rejects.toMatchObject({
      status: 404,
    });
    expect(db.agent.findFirst).toHaveBeenCalledWith({
      where: { id: 'other-agent', organizationId: 'org-a' },
    });
    expect(db.agentDraft.findUnique).not.toHaveBeenCalled();
  });
  it('rejects invalid configuration before opening a transaction', async () => {
    const db = {
      agent: { findFirst: vi.fn().mockResolvedValue({ id: 'agent-a' }) },
      $transaction: vi.fn(),
    };
    await expect(
      new BuilderService(db).save(principal, 'agent-a', {
        revision: 0,
        config: { instructions: 17 },
      }),
    ).rejects.toMatchObject({ status: 400 });
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  it('returns conflict without writing audit or identity for a stale revision', async () => {
    const tx = {
      agentDraft: { createMany: vi.fn(), updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
      auditEvent: { create: vi.fn() },
      agent: { update: vi.fn() },
    };
    const db = {
      agent: { findFirst: vi.fn().mockResolvedValue({ id: 'agent-a' }) },
      $transaction: (fn) => fn(tx),
    };
    await expect(
      new BuilderService(db).save(principal, 'agent-a', { revision: 1, config: {} }),
    ).rejects.toMatchObject({ status: 409 });
    expect(tx.auditEvent.create).not.toHaveBeenCalled();
    expect(tx.agent.update).not.toHaveBeenCalled();
  });
});
