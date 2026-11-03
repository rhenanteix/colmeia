import supertest from 'supertest';
import { PrismaClient } from '@prisma/client';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
const base = process.env.TEST_API_URL || 'http://localhost:4100/api/v1';
const password = 'Colmeia-test-password-2026';
const suffix = crypto.randomUUID();
async function request(path, body, token, method = body ? 'POST' : 'GET') {
  const outgoing = supertest(base)
    [method.toLowerCase()](path)
    .set('Content-Type', 'application/json');
  if (token) outgoing.set('Authorization', `Bearer ${token}`);
  if (body) outgoing.send(body);
  const result = await outgoing;
  return { status: result.status, data: result.body };
}
test('Sprint 6.1 documents: binary storage, Wiki versions, restore, RBAC and tenant isolation', async () => {
  const accounts = [];
  for (const label of ['docs-a', 'docs-b'])
    accounts.push(
      (
        await request('/auth/register', {
          email: `${label}-${suffix}@example.test`,
          password,
          name: label,
          organizationName: label,
        })
      ).data,
    );
  const [a, b] = accounts;
  const page = await request(
    '/documents/wiki',
    {
      title: 'Manual operacional',
      content: '<script>alert(1)</script> Texto original',
      visibility: 'private',
    },
    a.token,
  );
  assert.equal(page.status, 201);
  const folder = await request('/documents/folders', { name: 'Operações' }, a.token);
  assert.equal(folder.status, 201);
  const bytes = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 255, 0, 128, 7]);
  const upload = await supertest(base)
    .post('/documents/files')
    .set('Authorization', `Bearer ${a.token}`)
    .field('folderId', folder.data.id)
    .field('wikiId', page.data.id)
    .field('visibility', 'organization')
    .attach('file', bytes, { filename: 'evidence.png', contentType: 'image/png' });
  assert.equal(upload.status, 201);
  assert.equal(upload.body.size, bytes.length);
  assert.equal(upload.body.storageKey, undefined);
  const consumption = (await request('/usage/summary', null, a.token)).data;
  assert.equal(consumption.operational.storageBytes, bytes.length);
  assert.equal(consumption.operational.files, 1);
  assert.equal(consumption.operational.wikiPages, 1);
  assert.equal((await request('/usage/summary', null, b.token)).data.operational.files, 0);

  const download = await supertest(base)
    .get(`/documents/files/${upload.body.id}/download`)
    .set('Authorization', `Bearer ${a.token}`);
  assert.equal(download.status, 200);
  assert.deepEqual(download.body, bytes);
  assert.match(download.headers['content-disposition'], /attachment/);
  assert.equal(
    (await request(`/documents/files/${upload.body.id}/download`, null, b.token)).status,
    404,
  );
  assert.equal((await request('/documents/wiki', null, b.token)).data.length, 0);
  assert.equal(
    (await request(`/documents/wiki/${page.data.id}/versions`, null, b.token)).status,
    404,
  );
  const changed = await request(
    `/documents/wiki/${page.data.id}`,
    { title: 'Manual operacional', content: 'Texto revisado', visibility: 'private', revision: 1 },
    a.token,
    'PATCH',
  );
  assert.equal(changed.status, 200);
  assert.equal(
    (
      await request(
        `/documents/wiki/${page.data.id}`,
        { title: 'Conflito', content: 'perdido', visibility: 'private', revision: 1 },
        a.token,
        'PATCH',
      )
    ).status,
    409,
  );
  const restored = await request(
    `/documents/wiki/${page.data.id}/restore`,
    { revision: 2, version: 1 },
    a.token,
  );
  assert.equal(restored.status, 201);
  assert.equal(restored.data.content, page.data.content);
  assert.equal(restored.data.revision, 3);
  assert.equal((await request('/documents/wiki?q=original', null, a.token)).data.length, 1);
  assert.equal(
    (await request(`/documents/wiki/${page.data.id}/versions`, null, a.token)).data.length,
    3,
  );
  assert.equal(
    (
      await request(
        `/documents/wiki/${page.data.id}`,
        { title: 'Cycle', content: '', visibility: 'private', revision: 3, parentId: page.data.id },
        a.token,
        'PATCH',
      )
    ).status,
    400,
  );
  const invalid = await supertest(base)
    .post('/documents/files')
    .set('Authorization', `Bearer ${a.token}`)
    .attach('file', Buffer.from('<script>evil</script>'), {
      filename: 'evil.png',
      contentType: 'image/png',
    });
  assert.equal(invalid.status, 400);
  const big = await supertest(base)
    .post('/documents/files')
    .set('Authorization', `Bearer ${a.token}`)
    .attach('file', Buffer.alloc(10 * 1024 * 1024 + 1, 65), {
      filename: 'big.txt',
      contentType: 'text/plain',
    });
  assert.equal(big.status, 413);
  const db = new PrismaClient();
  try {
    await db.membership.create({
      data: { organizationId: a.organization.id, userId: b.user.id, role: 'VIEWER' },
    });
    const viewer = (await request('/auth/switch', { organizationId: a.organization.id }, b.token))
      .data.token;
    assert.equal((await request('/documents/wiki', null, viewer)).data.length, 0);
    assert.equal((await request('/documents/files', null, viewer)).data.length, 0);
    assert.equal(
      (
        await request(
          '/documents/wiki',
          { title: 'Forbidden', content: '', visibility: 'organization' },
          viewer,
        )
      ).status,
      403,
    );
    assert.equal(
      (await request(`/documents/files/${upload.body.id}`, null, viewer, 'DELETE')).status,
      403,
    );
    assert.equal(
      (await request(`/documents/files/${upload.body.id}`, null, a.token, 'DELETE')).status,
      200,
    );
    assert.equal(
      (await request(`/documents/files/${upload.body.id}/download`, null, a.token)).status,
      404,
    );
  } finally {
    await db.$disconnect();
  }
});

test('Commercial quotas serialize concurrent capacity consumption and reflect actual usage', async () => {
  const a = (
    await request('/auth/register', {
      email: `quota-${suffix}@example.test`,
      password,
      name: 'Quota',
      organizationName: 'Quota',
    })
  ).data;
  const db = new PrismaClient();
  try {
    for (let i = 0; i < 2; i++)
      assert.equal((await request('/agents', { name: `Agent ${i}` }, a.token)).status, 201);
    const race = await Promise.all([
      request('/agents', { name: 'Last seat A' }, a.token),
      request('/agents', { name: 'Last seat B' }, a.token),
    ]);
    assert.deepEqual(race.map((r) => r.status).sort(), [201, 409]);
    assert.equal(await db.agent.count({ where: { organizationId: a.organization.id } }), 3);
    const quotas = (await request('/billing/quotas', null, a.token)).data;
    const agents = quotas.quotas.find((q) => q.resource === 'agents');
    assert.equal(agents.used, 3);
    assert.equal(agents.available, 0);
    assert.equal(agents.percent, 100);
    assert.equal(agents.alert, 'limit');
    const workspaces = await Promise.all(
      ['a', 'b'].map((n) =>
        request(
          '/organizations',
          { name: `Workspace ${n}`, slug: `quota-${n}-${suffix}` },
          a.token,
        ),
      ),
    );
    assert.deepEqual(workspaces.map((r) => r.status).sort(), [201, 409]);
    const child = workspaces.find((r) => r.status === 201).data;
    const switched = (await request('/auth/switch', { organizationId: child.id }, a.token)).data
      .token;
    assert.equal(
      (
        await request(
          '/organizations',
          { name: 'Nested bypass', slug: `quota-nested-${suffix}` },
          switched,
        )
      ).status,
      409,
    );
    await db.knowledgeDocument.create({
      data: {
        organizationId: a.organization.id,
        name: 'Storage quota fixture',
        storageKey: crypto.randomUUID(),
        size: 50 * 1024 * 1024 - 5,
        status: 'fixture',
        ownerId: a.user.id,
      },
    });
    const rejected = await supertest(base)
      .post('/documents/files')
      .set('Authorization', `Bearer ${a.token}`)
      .attach('file', Buffer.from('larger than remaining capacity'), {
        filename: 'quota.txt',
        contentType: 'text/plain',
      });
    assert.equal(rejected.status, 409);
    assert.equal(
      await db.knowledgeDocument.count({ where: { organizationId: a.organization.id } }),
      1,
    );
    const graph = {
      nodes: [
        { id: 'start', type: 'manual', config: {}, next: 'end' },
        { id: 'end', type: 'end', config: {} },
      ],
    };
    const w = (await request('/workflows', { name: 'Quota execution', draft: graph }, a.token))
      .data;
    await request(`/workflows/${w.id}/publish`, { revision: 0 }, a.token);
    await request(`/workflows/${w.id}/active`, { active: true }, a.token);
    const version = await db.workflowVersion.findFirstOrThrow({ where: { workflowId: w.id } });
    await db.workflowRun.createMany({
      data: Array.from({ length: 99 }, (_, i) => ({
        organizationId: a.organization.id,
        workflowId: w.id,
        versionId: version.id,
        idempotencyKey: `fixture-${i}`,
        requestedBy: a.user.id,
        trigger: 'fixture',
        currentNode: 'end',
        context: {},
        status: 'completed',
      })),
    });
    const runs = await Promise.all(
      ['last-a', 'last-b'].map((idempotencyKey) =>
        request(`/workflows/${w.id}/run`, { idempotencyKey, input: {} }, a.token),
      ),
    );
    assert.deepEqual(runs.map((r) => r.status).sort(), [201, 409]);
    assert.equal(await db.workflowRun.count({ where: { organizationId: a.organization.id } }), 100);
  } finally {
    await db.$disconnect();
  }
});

test('Subscriptions: internal lifecycle, idempotency, downgrade constraints, RBAC and payment contract fake', async () => {
  const a = (
    await request('/auth/register', {
      email: `billing-${suffix}@example.test`,
      password,
      name: 'Billing',
      organizationName: 'Billing',
    })
  ).data;
  const db = new PrismaClient();
  try {
    const initial = (await request('/billing/subscription', null, a.token)).data;
    assert.equal(initial.subscription.planId, 'free');
    assert.equal(initial.integration.chargesEnabled, false);
    const change = { action: 'change', planId: 'team', revision: 0, idempotencyKey: 'upgrade-1' };
    const race = await Promise.all([
      request('/billing/subscription', change, a.token),
      request('/billing/subscription', change, a.token),
    ]);
    assert.deepEqual(
      race.map((r) => r.status),
      [201, 201],
    );
    assert.equal(
      await db.subscriptionEvent.count({
        where: { organizationId: a.organization.id, idempotencyKey: 'command:upgrade-1' },
      }),
      1,
    );
    assert.equal(
      (await request('/billing/subscription', { ...change, planId: 'business' }, a.token)).status,
      409,
    );
    for (let i = 0; i < 4; i++)
      assert.equal((await request('/agents', { name: `Billing agent ${i}` }, a.token)).status, 201);
    assert.equal(
      (
        await request(
          '/billing/subscription',
          { action: 'change', planId: 'free', revision: 1, idempotencyKey: 'downgrade-1' },
          a.token,
        )
      ).status,
      409,
    );
    const cancelled = await request(
      '/billing/subscription',
      { action: 'cancel', revision: 1, idempotencyKey: 'cancel-1' },
      a.token,
    );
    assert.equal(cancelled.status, 201);
    assert.equal(cancelled.data.status, 'cancelled');
    assert.equal((await request('/billing/quotas', null, a.token)).data.plan, 'free');
    assert.equal((await request('/agents', { name: 'Over cancelled quota' }, a.token)).status, 409);
    const restored = await request(
      '/billing/subscription',
      { action: 'reactivate', revision: 2, idempotencyKey: 'reactivate-1' },
      a.token,
    );
    assert.equal(restored.status, 201);
    assert.equal(restored.data.planId, 'team');
    const member = await db.membership.findFirstOrThrow({
      where: { userId: a.user.id, organizationId: a.organization.id },
    });
    await db.membership.update({ where: { id: member.id }, data: { role: 'MEMBER' } });
    assert.equal(
      (
        await request(
          '/billing/subscription',
          { action: 'cancel', revision: 3, idempotencyKey: 'forbidden' },
          a.token,
        )
      ).status,
      403,
    );
    await db.membership.update({ where: { id: member.id }, data: { role: 'OWNER' } });
    const { createRequire } = await import('node:module');
    const { SubscriptionsService } = createRequire(import.meta.url)(
      '../apps/api/dist/modules/billing/subscriptions.service.js',
    );
    const service = new SubscriptionsService(db, {
      apply: async () => ({ paymentStatus: 'failed', reference: 'explicit-test-contract' }),
    });
    const principal = {
      sub: a.user.id,
      organizationId: a.organization.id,
      role: 'OWNER',
      sessionId: 'contract',
    };
    const failure = await service.command(principal, {
      action: 'change',
      planId: 'business',
      revision: 3,
      idempotencyKey: 'declined-contract',
    });
    assert.equal(failure.status, 'past_due');
    assert.equal(failure.paymentStatus, 'failed');
    assert.equal(failure.planId, 'team');
    assert.equal((await request('/billing/quotas', null, a.token)).data.plan, 'free');
    await db.subscription.update({
      where: { organizationId: a.organization.id },
      data: { status: 'trialing', trialEndsAt: new Date(0) },
    });
    assert.equal((await service.get(principal)).subscription.status, 'trial_expired');
    assert.equal(
      await db.subscriptionEvent.count({
        where: { organizationId: a.organization.id, type: 'subscription.trial_expired' },
      }),
      1,
    );
  } finally {
    await db.$disconnect();
  }
});

test('Remaining quota resources: invitation acceptance, file/workflow capacity and integration guard', async () => {
  const accounts = [];
  for (let i = 0; i < 3; i++) {
    const r = await request('/auth/register', {
      email: `capacity-${i}-${suffix}@example.test`,
      password,
      name: 'Capacity',
      organizationName: 'Capacity',
    });
    assert.equal(r.status, 201);
    accounts.push(r.data);
  }
  const [a, b, c] = accounts;
  const db = new PrismaClient();
  const { createHash } = await import('node:crypto');
  try {
    const filler = await db.user.create({
      data: {
        email: `capacity-fixture-${suffix}@example.test`,
        externalSubject: `capacity-fixture-${suffix}`,
      },
    });
    await db.membership.create({
      data: { organizationId: a.organization.id, userId: filler.id, role: 'MEMBER' },
    });
    const tokens = [crypto.randomUUID(), crypto.randomUUID()];
    await db.invitation.createMany({
      data: [b, c].map((account, i) => ({
        organizationId: a.organization.id,
        email: account.user.email,
        role: 'MEMBER',
        tokenHash: createHash('sha256').update(tokens[i]).digest('hex'),
        expiresAt: new Date(Date.now() + 60000),
      })),
    });
    const seats = await Promise.all(
      [b, c].map((account, i) =>
        request('/team/invitations/accept', { token: tokens[i] }, account.token),
      ),
    );
    assert.deepEqual(seats.map((r) => r.status).sort(), [201, 409]);
    assert.equal(await db.membership.count({ where: { organizationId: a.organization.id } }), 3);
    assert.equal(
      await db.invitation.count({
        where: { organizationId: a.organization.id, acceptedAt: { not: null } },
      }),
      1,
    );
    await db.knowledgeDocument.createMany({
      data: Array.from({ length: 19 }, (_, i) => ({
        organizationId: a.organization.id,
        name: `Capacity fixture ${i}`,
        storageKey: crypto.randomUUID(),
        ownerId: a.user.id,
        status: 'fixture',
      })),
    });
    const uploads = await Promise.all(
      ['a', 'b'].map((name) =>
        supertest(base)
          .post('/documents/files')
          .set('Authorization', `Bearer ${a.token}`)
          .attach('file', Buffer.from('data'), {
            filename: `${name}.txt`,
            contentType: 'text/plain',
          }),
      ),
    );
    assert.deepEqual(uploads.map((r) => r.status).sort(), [201, 409]);
    const draft = {
      nodes: [
        { id: 'start', type: 'manual', config: {}, next: 'end' },
        { id: 'end', type: 'end', config: {} },
      ],
    };
    for (let i = 0; i < 4; i++)
      assert.equal(
        (await request('/workflows', { name: `Workflow ${i}`, draft }, a.token)).status,
        201,
      );
    const workflows = await Promise.all(
      ['a', 'b'].map((n) => request('/workflows', { name: `Last workflow ${n}`, draft }, a.token)),
    );
    assert.deepEqual(workflows.map((r) => r.status).sort(), [201, 409]);
    const { createRequire } = await import('node:module');
    const { quota } = createRequire(import.meta.url)('../apps/api/dist/modules/billing/quotas.js');
    await db.providerConnection.create({
      data: {
        organizationId: a.organization.id,
        provider: 'fixture',
        secretReference: 'fixture:no-secret',
      },
    });
    const integrations = await Promise.allSettled(
      ['a', 'b'].map((n) =>
        db.$transaction(async (tx) => {
          await quota(tx, a.organization.id, 'integrations');
          return tx.providerConnection.create({
            data: {
              organizationId: a.organization.id,
              provider: `fixture-${n}`,
              secretReference: 'fixture:no-secret',
            },
          });
        }),
      ),
    );
    assert.equal(integrations.filter((r) => r.status === 'fulfilled').length, 1);
    assert.equal(integrations.filter((r) => r.status === 'rejected').length, 1);
    assert.equal(
      await db.providerConnection.count({ where: { organizationId: a.organization.id } }),
      2,
    );
  } finally {
    await db.$disconnect();
  }
});
