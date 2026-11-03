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
test('P0: real PostgreSQL auth, tenant isolation, drafts, versions, invitations and revocation', async () => {
  const email = `p0-owner-${suffix}@example.test`;
  const otherEmail = `p0-other-${suffix}@example.test`;
  assert.equal(
    (
      await request('/auth/register', {
        email,
        password: 'short',
        name: 'QA',
        organizationName: 'QA',
      })
    ).status,
    400,
  );
  const signup = await request('/auth/register', {
    email,
    password,
    name: 'P0 Owner',
    organizationName: 'P0 QA',
  });
  assert.equal(signup.status, 201);
  const token = signup.data.token;
  assert.equal(
    (
      await request('/auth/register', {
        email,
        password,
        name: 'Duplicate',
        organizationName: 'QA',
      })
    ).status,
    409,
  );
  assert.equal((await request('/auth/login', { email, password: 'wrong' })).status, 401);
  const login = await request('/auth/login', { email, password });
  assert.equal(login.status, 201);
  const other = await request('/auth/register', {
    email: otherEmail,
    password,
    name: 'Other',
    organizationName: 'Other tenant',
  });
  assert.equal(other.status, 201);
  const agent = await request(
    '/agents',
    { name: 'QA specialist', description: 'Functional test' },
    token,
  );
  assert.equal(agent.status, 201);
  const id = agent.data.id;
  assert.equal((await request(`/agents/${id}`, null, other.data.token)).status, 404);
  assert.equal((await request(`/builder/${id}`, null, other.data.token)).status, 404);
  const config = {
    maxOutputTokens: 4096,
    monthlyExecutionLimit: 100,
    approvalRequired: true,
    instructions: 'Help the team with precise answers.',
    model: 'test-config-only',
    mascot: 'rainha',
  };
  const saved = await request(`/builder/${id}`, { config, revision: 0 }, token);
  assert.equal(saved.status, 201);
  assert.equal(saved.data.revision, 1);
  const conflict = await request(`/builder/${id}`, { config, revision: 0 }, token);
  assert.equal(conflict.status, 409);
  assert.deepEqual((await request(`/builder/${id}`, null, token)).data.config, config);
  const version = await request(`/builder/${id}/versions`, { config, revision: 1 }, token);
  assert.equal(version.status, 201);
  assert.equal((await request(`/builder/${id}/versions`, null, token)).data.length, 1);
  assert.equal((await request(`/agents/${id}/publish`, { config }, token)).status, 409);
  const dashboard = await request('/dashboard', null, token);
  assert.equal(dashboard.data.stats.total, 1);
  assert.equal(dashboard.data.stats.drafts, 1);
  const invited = await request('/team/invitations', { email: otherEmail, role: 'VIEWER' }, token);
  assert.equal(invited.status, 201);
  const directory = process.env.MAIL_DEV_DIRECTORY || '/private/tmp/colmeia-p0-mail';
  const mails = await Promise.all(
    (await readdir(directory)).map(async (file) =>
      JSON.parse(await readFile(`${directory}/${file}`, 'utf8')),
    ),
  );
  const mail = mails.find((m) => m.to === otherEmail);
  assert.ok(mail);
  const inviteToken = new URL(mail.text).searchParams.get('token');
  assert.equal(
    (await request('/team/invitations/accept', { token: inviteToken }, other.data.token)).status,
    201,
  );
  assert.equal(
    (await request('/team/invitations/accept', { token: inviteToken }, other.data.token)).status,
    400,
  );
  const switched = await request(
    '/auth/switch',
    { organizationId: signup.data.organization.id },
    other.data.token,
  );
  assert.equal(switched.status, 201);
  assert.equal((await request('/agents', { name: 'Forbidden' }, switched.data.token)).status, 403);
  assert.equal(
    (await request(`/builder/${id}`, { config: { maxOutputTokens: -1 }, revision: 2 }, token))
      .status,
    400,
  );
  const concurrent = await Promise.all([
    request(`/builder/${id}`, { config, revision: 2 }, token),
    request(`/builder/${id}`, { config, revision: 2 }, token),
  ]);
  assert.deepEqual(concurrent.map((r) => r.status).sort(), [201, 409]);
  assert.deepEqual((await request(`/builder/${id}/versions`, null, token)).data[0].config, config);
  const members = (await request('/team/members', null, token)).data;
  const viewerMembership = members.find((m) => m.user.email === otherEmail);
  assert.equal(
    (
      await request(
        `/team/members/${viewerMembership.id}`,
        { email: otherEmail, role: 'MEMBER' },
        token,
        'PATCH',
      )
    ).status,
    200,
  );
  assert.equal(
    (await request('/agents', { name: 'Allowed after role update' }, switched.data.token)).status,
    201,
  );
  const ownerMembership = members.find((m) => m.user.email === email);
  assert.equal(
    (
      await request(
        `/team/members/${ownerMembership.id}`,
        { email, role: 'VIEWER' },
        token,
        'PATCH',
      )
    ).status,
    403,
  );
  const channel = await request('/channels', { name: `qa-${suffix}` }, token);
  assert.equal(channel.status, 201);
  assert.equal(
    (await request(`/channels/${channel.data.id}/messages`, null, other.data.token)).status,
    404,
  );
  assert.equal(
    (
      await request(
        `/channels/${channel.data.id}/messages`,
        { body: 'Mensagem persistida de QA' },
        token,
      )
    ).status,
    201,
  );
  assert.equal(
    (await request(`/channels/${channel.data.id}/messages`, null, token)).data.length,
    1,
  );
  assert.equal(
    (await request(`/team/members/${viewerMembership.id}`, null, token, 'DELETE')).status,
    200,
  );
  assert.equal((await request('/auth/me', null, switched.data.token)).status, 401);
  assert.equal((await request(`/agents/${id}/archive`, {}, token)).status, 201);
  assert.equal(
    (
      await request(
        `/bee-team/channels/${channel.data.id}/handoffs`,
        { targetAgentId: id, instruction: 'Esta execução deve ser bloqueada' },
        token,
      )
    ).status,
    404,
  );
  assert.equal((await request(`/builder/${id}/versions`, null, token)).data.length, 1);
  const duplicateInvites = await Promise.all([
    request(
      '/team/invitations',
      { email: `concurrent-${suffix}@example.test`, role: 'MEMBER' },
      token,
    ),
    request(
      '/team/invitations',
      { email: `concurrent-${suffix}@example.test`, role: 'MEMBER' },
      token,
    ),
  ]);
  assert.deepEqual(duplicateInvites.map((r) => r.status).sort(), [201, 409]);
  const createdOrg = await request(
    '/organizations',
    { name: 'Second workspace', slug: `qa-${suffix}` },
    token,
  );
  assert.equal(createdOrg.status, 201);
  assert.equal(
    (await request('/auth/switch', { organizationId: createdOrg.data.id }, other.data.token))
      .status,
    403,
  );
  const newOrgSession = await request(
    '/auth/switch',
    { organizationId: createdOrg.data.id },
    token,
  );
  assert.equal((await request('/dashboard', null, newOrgSession.data.token)).data.stats.total, 0);
  const template = await request(
    '/templates',
    { name: 'Private template', category: 'QA', config: {} },
    token,
  );
  assert.equal(template.status, 201);
  assert.ok(
    !(await request('/templates', null, other.data.token)).data.some(
      (t) => t.id === template.data.id,
    ),
  );
  const revoke = await request(
    '/team/invitations',
    { email: `revoked-${suffix}@example.test`, role: 'MEMBER' },
    token,
  );
  assert.equal(revoke.status, 201);
  assert.equal(
    (await request(`/team/invitations/${revoke.data.id}/resend`, {}, token)).status,
    201,
  );
  assert.equal(
    (await request(`/team/invitations/${revoke.data.id}/revoke`, {}, token)).status,
    201,
  );
  assert.equal(
    (await request(`/team/invitations/${revoke.data.id}/resend`, {}, token)).status,
    404,
  );
  assert.equal(
    (await request(`/builder/${id}`, { revision: 2, config: { instructions: 123 } }, token)).status,
    400,
  );
  const refreshed = await request('/auth/refresh', {}, newOrgSession.data.token);
  assert.equal(refreshed.status, 201);
  assert.equal((await request('/auth/me', null, newOrgSession.data.token)).status, 401);
  assert.equal((await request('/auth/me', null, refreshed.data.token)).status, 200);
  const db = new PrismaClient();
  try {
    await assert.rejects(
      db.message.create({
        data: {
          organizationId: other.data.organization.id,
          channelId: channel.data.id,
          authorSubject: other.data.user.id,
          body: 'Cross-tenant write must fail at the database',
        },
      }),
      (error) => error.code === 'P2003',
    );
    await assert.rejects(
      db.agentExecution.create({
        data: {
          organizationId: other.data.organization.id,
          agentId: id,
          requestId: crypto.randomUUID(),
        },
      }),
      (error) => error.code === 'P2003',
    );
    const sessionId = JSON.parse(
      Buffer.from(refreshed.data.token.split('.')[1], 'base64url').toString(),
    ).jti;
    await db.session.update({
      where: { id: sessionId },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    assert.equal((await request('/auth/me', null, refreshed.data.token)).status, 401);
  } finally {
    await db.$disconnect();
  }
  assert.equal((await request('/auth/logout', {}, token)).status, 201);
  assert.equal((await request('/auth/me', null, token)).status, 401);
  assert.equal((await request('/auth/password-reset/request', { email })).status, 201);
  const resetMails = await Promise.all(
    (await readdir(directory)).map(async (file) =>
      JSON.parse(await readFile(`${directory}/${file}`, 'utf8')),
    ),
  );
  const reset = resetMails.find((m) => m.to === email && m.subject.includes('Recupere'));
  assert.ok(reset);
  const resetToken = new URL(reset.text).searchParams.get('token');
  assert.equal(
    (
      await request('/auth/password-reset/confirm', {
        token: resetToken,
        password: password + '-new',
      })
    ).status,
    201,
  );
  assert.equal(
    (await request('/auth/password-reset/confirm', { token: resetToken, password })).status,
    400,
  );
  assert.equal((await request('/auth/me', null, login.data.token)).status, 401);
});

test('password reset serializes different valid tokens and revokes all sessions', async () => {
  const email = `reset-race-${suffix}@example.test`;
  const signup = await request('/auth/register', {
    email,
    password,
    name: 'Reset QA',
    organizationName: 'Reset QA',
  });
  assert.equal(signup.status, 201);
  for (let i = 0; i < 2; i++) {
    assert.equal((await request('/auth/password-reset/request', { email })).status, 201);
  }
  const directory = process.env.MAIL_DEV_DIRECTORY;
  const mails = await Promise.all(
    (await readdir(directory)).map(async (file) =>
      JSON.parse(await readFile(`${directory}/${file}`, 'utf8')),
    ),
  );
  const tokens = mails
    .filter((mail) => mail.to === email)
    .map((mail) => new URL(mail.text).searchParams.get('token'));
  assert.equal(tokens.length, 2);
  const results = await Promise.all(
    tokens.map((token, i) =>
      request('/auth/password-reset/confirm', { token, password: `${password}-${i}` }),
    ),
  );
  assert.deepEqual(results.map((result) => result.status).sort(), [201, 400]);
  const winner = results.findIndex((result) => result.status === 201);
  assert.equal(
    (await request('/auth/login', { email, password: `${password}-${winner}` })).status,
    201,
  );
  assert.equal((await request('/auth/me', null, signup.data.token)).status, 401);
  for (const token of tokens) {
    assert.equal((await request('/auth/password-reset/confirm', { token, password })).status, 400);
  }
});

test('Teams: private DMs, threads, mentions, presence, notifications and stable history', async () => {
  const users = [];
  for (const label of ['alice', 'bob', 'carol']) {
    const registered = await request('/auth/register', {
      email: `${label}-${suffix}@example.test`,
      password,
      name: label,
      organizationName: `${label} QA`,
    });
    assert.equal(registered.status, 201);
    users.push(registered.data);
  }
  const [alice, bob, carol] = users;
  const db = new PrismaClient();
  try {
    await db.membership.createMany({
      data: [bob, carol].map((user) => ({
        organizationId: alice.organization.id,
        userId: user.user.id,
        role: 'ADMIN',
      })),
    });
    const bobToken = (
      await request('/auth/switch', { organizationId: alice.organization.id }, bob.token)
    ).data.token;
    const carolToken = (
      await request('/auth/switch', { organizationId: alice.organization.id }, carol.token)
    ).data.token;
    const dm = await request('/channels/direct', { userId: bob.user.id }, alice.token);
    assert.equal(dm.status, 201);
    const id = dm.data.id;
    assert.equal(
      (await request('/channels/direct', { userId: alice.user.id }, bobToken)).data.id,
      id,
    );
    assert.equal((await request(`/channels/${id}/messages`, null, carolToken)).status, 404);
    assert.equal(
      (await request(`/bee-team/channels/${id}/handoffs`, null, carolToken)).status,
      404,
    );
    assert.equal(
      (await request(`/channels/${id}/messages`, { body: 'Private injection' }, carolToken)).status,
      404,
    );
    assert.ok(
      !(await request('/channels', null, carolToken)).data.some((channel) => channel.id === id),
    );
    assert.equal(
      (await request(`/channels/${id}/messages`, { body: '   ' }, alice.token)).status,
      400,
    );
    const root = await request(
      `/channels/${id}/messages`,
      { body: 'Private hello', mentionIds: [bob.user.id] },
      alice.token,
    );
    assert.equal(root.status, 201);
    assert.equal(
      (
        await request(
          `/channels/${id}/messages`,
          { body: 'Leaking mention', mentionIds: [carol.user.id] },
          alice.token,
        )
      ).status,
      400,
    );
    const reply = await request(
      `/channels/${id}/messages`,
      { body: 'Thread reply', parentId: root.data.id },
      bobToken,
    );
    assert.equal(reply.status, 201);
    assert.equal(
      (await request(`/channels/${id}/messages?parentId=${root.data.id}`, null, alice.token))
        .data[0].id,
      reply.data.id,
    );
    const publicChannel = await request('/channels', { name: `public-${suffix}` }, alice.token);
    assert.equal(
      (
        await request(
          `/channels/${publicChannel.data.id}/messages`,
          { body: 'Invalid parent', parentId: root.data.id },
          alice.token,
        )
      ).status,
      404,
    );
    await assert.rejects(
      db.message.create({
        data: {
          organizationId: alice.organization.id,
          channelId: publicChannel.data.id,
          authorSubject: alice.user.id,
          body: 'Invalid FK',
          parentId: root.data.id,
        },
      }),
      (error) => error.code === 'P2003',
    );
    const notifications = await request('/notifications', null, bobToken);
    assert.equal(notifications.data.length, 1);
    assert.equal(notifications.data[0].title, 'Você foi mencionado');
    assert.equal(
      (await request(`/notifications/${notifications.data[0].id}/read`, {}, carolToken)).status,
      404,
    );
    assert.equal(
      (await request(`/notifications/${notifications.data[0].id}/read`, {}, bobToken)).status,
      201,
    );
    const stream = await fetch(`${base}/notifications/events`, {
      headers: { Authorization: `Bearer ${bobToken}` },
    });
    assert.equal(stream.status, 200);
    const reader = stream.body.getReader();
    try {
      let frame = '';
      while (!frame.includes('data:')) {
        const chunk = await reader.read();
        assert.equal(chunk.done, false);
        frame += new TextDecoder().decode(chunk.value);
      }
      assert.match(frame, /Você foi mencionado/);
    } finally {
      await reader.cancel();
    }
    assert.equal((await request('/channels/presence', {}, bobToken)).status, 201);
    const presence = (await request('/channels/presence', null, alice.token)).data;
    assert.ok(presence.find((person) => person.userId === bob.user.id).lastSeenAt);
    assert.equal((await request(`/channels/${id}/messages`, null, bob.token)).status, 404);
    const timestamp = new Date();
    await db.message.createMany({
      data: Array.from({ length: 105 }, (_, i) => ({
        organizationId: alice.organization.id,
        channelId: publicChannel.data.id,
        authorSubject: alice.user.id,
        body: `History ${i}`,
        createdAt: timestamp,
      })),
    });
    const first = (await request(`/channels/${publicChannel.data.id}/messages`, null, alice.token))
      .data;
    assert.equal(first.length, 100);
    const second = (
      await request(
        `/channels/${publicChannel.data.id}/messages?before=${first.at(-1).id}`,
        null,
        alice.token,
      )
    ).data;
    assert.equal(second.length, 5);
    assert.equal(new Set([...first, ...second].map((message) => message.id)).size, 105);
    assert.equal(first[0].authorName, 'alice');
    const events = await fetch(`${base}/bee-team/channels/${id}/events`, {
      headers: { Authorization: `Bearer ${bobToken}` },
      signal: AbortSignal.timeout(10000),
    });
    const eventsReader = events.body.getReader();
    let buffered = '';
    async function nextEvent() {
      while (true) {
        const boundary = buffered.indexOf('\n\n');
        if (boundary !== -1) {
          const frame = buffered.slice(0, boundary);
          buffered = buffered.slice(boundary + 2);
          const data = frame.split('\n').find((line) => line.startsWith('data: '));
          if (data) return JSON.parse(data.slice(6));
        } else {
          const chunk = await eventsReader.read();
          assert.equal(chunk.done, false);
          buffered += new TextDecoder().decode(chunk.value).replace(/\r\n/g, '\n');
        }
      }
    }
    try {
      assert.equal((await nextEvent()).type, 'snapshot');
      assert.equal((await request('/auth/logout', {}, bobToken)).status, 201);
      const revokedEvent = await nextEvent();
      assert.equal(revokedEvent.type, 'error');
      assert.equal(revokedEvent.lastMessageId, undefined);
    } finally {
      await eventsReader.cancel();
    }
  } finally {
    await db.$disconnect();
  }
});

test('Sprint 6: task assignees and approval decisions preserve tenant, role and audit integrity', async () => {
  const accounts = [];
  for (const label of ['Empresa A', 'Empresa B']) {
    const result = await request('/auth/register', {
      email: `s6-${accounts.length}-${suffix}@example.test`,
      password,
      name: label,
      organizationName: label,
    });
    assert.equal(result.status, 201);
    accounts.push(result.data);
  }
  const [a, b] = accounts;
  const db = new PrismaClient();
  try {
    assert.equal(
      (await request('/tasks', { title: 'Invalid assignment', assignedTo: b.user.id }, a.token))
        .status,
      400,
    );
    const task = await request('/tasks', { title: 'Tenant task', assignedTo: a.user.id }, a.token);
    assert.equal(task.status, 201);
    assert.equal((await request('/tasks', null, b.token)).data.length, 0);
    assert.equal(
      (await request(`/tasks/${task.data.id}`, { status: 'done' }, b.token, 'PATCH')).status,
      404,
    );
    assert.equal(
      (await request(`/tasks/${task.data.id}`, { status: 'done' }, a.token, 'PATCH')).status,
      200,
    );
    assert.equal(
      await db.auditEvent.count({ where: { resourceId: task.data.id, action: 'task.created' } }),
      1,
    );
    const agent = await request('/agents', { name: 'Approval QA' }, a.token);
    assert.equal(agent.status, 201);
    const approval = await db.approvalRequest.create({
      data: {
        organizationId: a.organization.id,
        agentId: agent.data.id,
        requestedBy: a.user.id,
        operation: 'qa.no-external-side-effects',
        payload: {},
        expiresAt: new Date(Date.now() + 60000),
      },
    });
    assert.equal((await request('/approvals', null, b.token)).data.length, 0);
    assert.equal(
      (await request(`/approvals/${approval.id}/decision`, { decision: 'approved' }, b.token))
        .status,
      409,
    );
    const membership = await db.membership.create({
      data: { organizationId: a.organization.id, userId: b.user.id, role: 'VIEWER' },
    });
    const viewer = (await request('/auth/switch', { organizationId: a.organization.id }, b.token))
      .data.token;
    assert.equal((await request('/tasks', { title: 'Viewer write' }, viewer)).status, 403);
    assert.equal(
      (await request(`/approvals/${approval.id}/decision`, { decision: 'approved' }, viewer))
        .status,
      403,
    );
    assert.equal(
      (await request(`/approvals/${approval.id}/decision`, { decision: 'invalid' }, a.token))
        .status,
      400,
    );
    const decisions = await Promise.all(
      ['approved', 'rejected'].map((decision) =>
        request(`/approvals/${approval.id}/decision`, { decision }, a.token),
      ),
    );
    assert.deepEqual(decisions.map((r) => r.status).sort(), [201, 409]);
    assert.equal(await db.auditEvent.count({ where: { resourceId: approval.id } }), 1);
    const expired = await db.approvalRequest.create({
      data: {
        organizationId: a.organization.id,
        agentId: agent.data.id,
        requestedBy: a.user.id,
        operation: 'qa.expired',
        payload: {},
        expiresAt: new Date(0),
      },
    });
    assert.equal(
      (await request(`/approvals/${expired.id}/decision`, { decision: 'approved' }, a.token))
        .status,
      409,
    );
    assert.equal(await db.auditEvent.count({ where: { resourceId: expired.id } }), 0);
    await db.membership.update({ where: { id: membership.id }, data: { role: 'MEMBER' } });
    assert.equal(
      (await request(`/approvals/${expired.id}/decision`, { decision: 'rejected' }, viewer)).status,
      403,
    );
  } finally {
    await db.$disconnect();
  }
});

test('Sprint 6.1 Kanban: boards, edits, concurrency, comments, archive and tenant boundaries', async () => {
  const accounts = [];
  for (const label of ['kanban-a', 'kanban-b']) {
    const r = await request('/auth/register', {
      email: `${label}-${suffix}@example.test`,
      password,
      name: label,
      organizationName: label,
    });
    assert.equal(r.status, 201);
    accounts.push(r.data);
  }
  const [a, b] = accounts;
  const db = new PrismaClient();
  try {
    const board = await request('/tasks/boards', { name: 'Operações' }, a.token);
    assert.equal(board.status, 201);
    assert.equal(board.data.columns.length, 3);
    const otherBoard = await request('/tasks/boards', { name: 'Privado' }, b.token);
    assert.equal((await request('/tasks/boards', null, b.token)).data.length, 1);
    assert.equal(
      (await request(`/tasks/boards/${board.data.id}/columns`, { name: 'Intruso' }, b.token))
        .status,
      404,
    );
    const extra = await request(
      `/tasks/boards/${board.data.id}/columns`,
      { name: 'Revisão', position: 2 },
      a.token,
    );
    assert.equal(extra.status, 201);
    const task = await request(
      '/tasks',
      {
        title: 'Entrega comercial',
        boardId: board.data.id,
        assignedTo: a.user.id,
        priority: 'high',
        dueAt: '2026-12-01T12:00:00Z',
        labels: ['cliente'],
      },
      a.token,
    );
    assert.equal(task.status, 201);
    assert.equal(task.data.columnId, board.data.columns[0].id);
    assert.equal(
      (await request('/tasks', { title: 'Invasão', boardId: otherBoard.data.id }, a.token)).status,
      400,
    );
    assert.equal(
      (
        await request(
          `/tasks/${task.data.id}`,
          { columnId: otherBoard.data.columns[0].id, revision: 0 },
          a.token,
          'PATCH',
        )
      ).status,
      400,
    );
    assert.equal(
      (await request(`/tasks/${task.data.id}`, { title: 'Sem revisão' }, a.token, 'PATCH')).status,
      400,
    );
    const moves = await Promise.all(
      [extra.data.id, board.data.columns[1].id].map((columnId) =>
        request(`/tasks/${task.data.id}`, { columnId, revision: 0 }, a.token, 'PATCH'),
      ),
    );
    assert.deepEqual(moves.map((r) => r.status).sort(), [200, 409]);
    assert.equal(
      await db.auditEvent.count({ where: { resourceId: task.data.id, action: 'task.moved' } }),
      1,
    );
    assert.equal(
      (await request(`/tasks/${task.data.id}/comments`, { body: 'Revisado pelo cliente' }, a.token))
        .status,
      201,
    );
    assert.equal((await request(`/tasks/${task.data.id}/comments`, null, b.token)).status, 404);
    assert.equal((await request(`/tasks/${task.data.id}/history`, null, b.token)).status, 404);
    assert.equal((await request(`/tasks/${task.data.id}/comments`, null, a.token)).data.length, 1);
    const membership = await db.membership.create({
      data: { userId: b.user.id, organizationId: a.organization.id, role: 'MEMBER' },
    });
    const teammate = (await request('/auth/switch', { organizationId: a.organization.id }, b.token))
      .data.token;
    const shared = await request(
      `/tasks?boardId=${board.data.id}&q=comercial&priority=high&assignedTo=${a.user.id}`,
      null,
      teammate,
    );
    assert.equal(shared.data.length, 1);
    assert.equal(shared.data[0].revision, 1);
    assert.equal(
      (await request(`/tasks/${task.data.id}`, { revision: 1, archived: true }, teammate, 'PATCH'))
        .status,
      200,
    );
    assert.equal((await request('/tasks', null, a.token)).data.length, 0);
    assert.equal((await request('/tasks?archived=true', null, a.token)).data[0].id, task.data.id);
    assert.equal(
      (
        await request(
          `/tasks/${task.data.id}`,
          { revision: 2, archived: false, assignedTo: null },
          a.token,
          'PATCH',
        )
      ).status,
      200,
    );
    await db.membership.update({ where: { id: membership.id }, data: { role: 'VIEWER' } });
    assert.equal(
      (await request(`/tasks/${task.data.id}/comments`, { body: 'Não autorizado' }, teammate))
        .status,
      403,
    );
    assert.equal(
      (await request('/tasks/boards', { name: 'Não autorizado' }, teammate)).status,
      403,
    );
    await assert.rejects(
      db.task.update({
        where: { id: task.data.id },
        data: { columnId: otherBoard.data.columns[0].id },
      }),
      (e) => e.code === 'P2003',
    );
    await assert.rejects(
      db.taskComment.create({
        data: {
          organizationId: b.organization.id,
          taskId: task.data.id,
          authorSubject: b.user.id,
          body: 'Cross tenant',
        },
      }),
      (e) => e.code === 'P2003',
    );
  } finally {
    await db.$disconnect();
  }
});

test('Sprint 6.1 approvals: designated member, notification, task update, cancellation and expiry', async () => {
  const users = [];
  for (const label of ['approval-a', 'approval-b']) {
    const r = await request('/auth/register', {
      email: `${label}-${suffix}@example.test`,
      password,
      name: label,
      organizationName: label,
    });
    assert.equal(r.status, 201);
    users.push(r.data);
  }
  const [a, b] = users;
  const db = new PrismaClient();
  try {
    await db.membership.create({
      data: { organizationId: a.organization.id, userId: b.user.id, role: 'MEMBER' },
    });
    const member = (await request('/auth/switch', { organizationId: a.organization.id }, b.token))
      .data.token;
    const task = (await request('/tasks', { title: 'Contrato aprovado' }, a.token)).data;
    const payload = {
      operation: 'Liberar contrato',
      approverId: b.user.id,
      expiresAt: new Date(Date.now() + 60000).toISOString(),
      taskId: task.id,
      targetStatus: 'done',
    };
    const approval = await request('/approvals', payload, a.token);
    assert.equal(approval.status, 201);
    assert.ok(
      (await request('/notifications', null, member)).data.some(
        (n) => n.title === 'Aprovação pendente',
      ),
    );
    assert.equal(
      (await request(`/approvals/${approval.data.id}/decision`, { decision: 'approved' }, a.token))
        .status,
      403,
    );
    assert.equal(
      (await request(`/approvals/${approval.data.id}/history`, null, b.token)).status,
      404,
    );
    const decisions = await Promise.all(
      ['approved', 'rejected'].map((decision) =>
        request(
          `/approvals/${approval.data.id}/decision`,
          { decision, reason: 'Análise concluída' },
          member,
        ),
      ),
    );
    assert.deepEqual(decisions.map((r) => r.status).sort(), [201, 409]);
    const winner = decisions.find((r) => r.status === 201).data.status;
    assert.equal(
      (await db.task.findUniqueOrThrow({ where: { id: task.id } })).status,
      winner === 'approved' ? 'done' : 'todo',
    );
    assert.equal(
      (await request(`/approvals/${approval.data.id}/history`, null, member)).data.length,
      2,
    );
    const cancel = await request(
      '/approvals',
      { ...payload, taskId: undefined, targetStatus: undefined },
      a.token,
    );
    assert.equal(
      (await request(`/approvals/${cancel.data.id}/cancel`, { reason: 'Desistência' }, member))
        .status,
      409,
    );
    assert.equal(
      (await request(`/approvals/${cancel.data.id}/cancel`, { reason: 'Desistência' }, a.token))
        .status,
      201,
    );
    assert.equal(
      (await request(`/approvals/${cancel.data.id}/decision`, { decision: 'approved' }, member))
        .status,
      409,
    );
    const expired = await request('/approvals', payload, a.token);
    await db.approvalRequest.update({
      where: { id: expired.data.id },
      data: { expiresAt: new Date(0) },
    });
    assert.equal(
      (await request('/approvals', null, a.token)).data.find((x) => x.id === expired.data.id)
        .status,
      'expired',
    );
    assert.equal(
      await db.auditEvent.count({
        where: { resourceId: expired.data.id, action: 'approval.expired' },
      }),
      1,
    );
    const stale = await request('/approvals', payload, a.token);
    const currentTask = await db.task.findUniqueOrThrow({ where: { id: task.id } });
    await request(
      `/tasks/${task.id}`,
      { revision: currentTask.revision, title: 'Contrato alterado' },
      a.token,
      'PATCH',
    );
    assert.equal(
      (await request(`/approvals/${stale.data.id}/decision`, { decision: 'approved' }, member))
        .status,
      409,
    );
    assert.equal(
      (await db.approvalRequest.findUniqueOrThrow({ where: { id: stale.data.id } })).status,
      'pending',
    );
    assert.equal(
      (await request('/approvals', { ...payload, approverId: crypto.randomUUID() }, a.token))
        .status,
      400,
    );
  } finally {
    await db.$disconnect();
  }
});

test('Sprint 6.1 deterministic workflows: signed secret, idempotency, approval resume and durable effects', async () => {
  const a = (
    await request('/auth/register', {
      email: `workflow-${suffix}@example.test`,
      password,
      name: 'Workflow QA',
      organizationName: 'Workflow QA',
    })
  ).data;
  const graph = {
    nodes: [
      { id: 'start', type: 'webhook', config: {}, next: 'task' },
      {
        id: 'task',
        type: 'task',
        config: { title: 'Tarefa do webhook', assignedTo: a.user.id },
        next: 'approval',
      },
      {
        id: 'approval',
        type: 'approval',
        config: { approverId: a.user.id, title: 'Autorizar entrega' },
        next: 'status',
      },
      { id: 'status', type: 'status', config: { status: 'done' }, next: 'notification' },
      {
        id: 'notification',
        type: 'notification',
        config: { recipientId: a.user.id, title: 'Workflow concluído' },
        next: 'end',
      },
      { id: 'end', type: 'end', config: {} },
    ],
  };
  const created = await request(
    '/workflows',
    { name: 'Entrega determinística', draft: graph },
    a.token,
  );
  assert.equal(created.status, 201);
  const w = created.data;
  assert.equal((await request(`/workflows/${w.id}/publish`, { revision: 0 }, a.token)).status, 201);
  assert.equal((await request(`/workflows/${w.id}/active`, { active: true }, a.token)).status, 201);
  async function hook(secret, key) {
    const r = await supertest(base)
      .post(`/workflow-webhooks/${w.id}`)
      .set('x-workflow-secret', secret)
      .set('idempotency-key', key)
      .send({ input: { source: 'contract-test' } });
    return r;
  }
  assert.equal((await hook('wrong', 'delivery-1')).status, 401);
  const calls = await Promise.all([
    hook(w.webhookSecret, 'delivery-1'),
    hook(w.webhookSecret, 'delivery-1'),
  ]);
  assert.deepEqual(
    calls.map((r) => r.status),
    [201, 201],
  );
  assert.equal(calls[0].body.id, calls[1].body.id);
  const db = new PrismaClient();
  const runId = calls[0].body.id;
  async function until(status) {
    for (let i = 0; i < 100; i++) {
      const run = await db.workflowRun.findUniqueOrThrow({ where: { id: runId } });
      if (run.status === status) return run;
      if (run.status === 'failed') assert.fail(run.error);
      await new Promise((r) => setTimeout(r, 100));
    }
    assert.fail(`Run did not reach ${status}`);
  }
  try {
    const paused = await until('approval');
    const taskId = paused.context.taskId;
    assert.ok(taskId);
    assert.equal(
      (await db.task.findUniqueOrThrow({ where: { id: taskId } })).assignedTo,
      a.user.id,
    );
    assert.equal(
      (
        await request(
          `/approvals/${paused.approvalId}/decision`,
          { decision: 'approved', reason: 'Conferido' },
          a.token,
        )
      ).status,
      201,
    );
    const done = await until('completed');
    assert.equal((await db.task.findUniqueOrThrow({ where: { id: taskId } })).status, 'done');
    assert.equal(await db.task.count({ where: { organizationId: a.organization.id } }), 1);
    assert.equal(
      await db.auditEvent.count({ where: { resourceId: runId, action: 'workflow.completed' } }),
      1,
    );
    assert.equal(
      await db.notification.count({
        where: { organizationId: a.organization.id, title: 'Workflow concluído' },
      }),
      1,
    );
    const usage = (await request('/usage/summary', null, a.token)).data;
    assert.equal(usage.events, 0);
    assert.equal(usage.operational.tasks, 1);
    assert.equal(usage.operational.executions, 1);
    assert.equal(usage.operational.executionStates.find((s) => s.status === 'completed').count, 1);
    assert.ok(usage.history.some((e) => e.action === 'workflow.completed'));
    const quotas = (await request('/billing/quotas', null, a.token)).data;
    assert.equal(quotas.quotas.find((q) => q.resource === 'executions').used, 1);
    assert.ok(done.correlationId);
    assert.ok(done.finishedAt);
    assert.equal((await hook(w.webhookSecret, 'delivery-1')).body.id, runId);
    assert.equal((await request(`/workflows/${w.id}/runs`, null, a.token)).data[0].steps.length, 7);
    const loop = structuredClone(graph);
    loop.nodes[1].next = 'start';
    assert.equal(
      (
        await request(
          `/workflows/${w.id}`,
          { name: 'Loop inválido', revision: 1, draft: loop },
          a.token,
          'PATCH',
        )
      ).status,
      200,
    );
    assert.equal(
      (await request(`/workflows/${w.id}/publish`, { revision: 2 }, a.token)).status,
      400,
    );
    assert.equal(
      (await request(`/workflows/${w.id}/active`, { active: false }, a.token)).status,
      201,
    );
    assert.equal((await hook(w.webhookSecret, 'delivery-2')).status, 409);
  } finally {
    await db.$disconnect();
  }
});
