import test from 'node:test';
import assert from 'node:assert/strict';
import supertest from 'supertest';
const api = supertest(process.env.TEST_API_URL);
async function call(method, path, token, body) {
  const r = api[method](path);
  if (token) r.set('Authorization', `Bearer ${token}`);
  if (body) r.send(body);
  return r;
}
async function signup() {
  const r = await call('post', '/auth/register', null, {
    email: `runtime-${crypto.randomUUID()}@example.test`,
    password: 'Runtime-test-password-2026',
    name: 'Runtime QA',
    organizationName: 'Runtime QA',
  });
  assert.equal(r.status, 201);
  return r.body;
}
async function published(token, engine, model) {
  const agent = await call('post', '/agents', token, { name: `Abelha ${engine}` });
  assert.equal(agent.status, 201);
  const config = {
    engine,
    provider: 'openai',
    model,
    instructions: 'Responda com clareza e precisão.',
    tools: [],
  };
  const draft = await call('post', `/builder/${agent.body.id}`, token, { revision: 0, config });
  assert.equal(draft.status, 201);
  const version = await call('post', `/builder/${agent.body.id}/versions`, token, {
    revision: 1,
    config,
  });
  assert.equal(version.status, 201);
  const publish = await call('post', `/agents/${agent.body.id}/publish`, token, {
    versionId: version.body.version.id,
  });
  assert.equal(publish.status, 201, JSON.stringify(publish.body));
  const conversation = await call('post', '/conversations', token, { agentId: agent.body.id });
  assert.equal(conversation.status, 201);
  return { agent: agent.body, version: version.body.version, conversation: conversation.body };
}
async function stream(token, id, requestId = crypto.randomUUID(), signal) {
  return fetch(`${process.env.TEST_API_URL}/conversations/${id}/stream`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: 'Olá, ajude minha empresa.', requestId }),
    signal,
  });
}
test('Mastra and AI SDK: persisted streaming, immutable versions, events, usage, tenant isolation and idempotency (explicit provider fixture)', async () => {
  const owner = await signup(),
    other = await signup();
  for (const engine of ['mastra', 'ai-sdk']) {
    const f = await published(owner.token, engine, 'fixture-success');
    const requestId = crypto.randomUUID();
    const res = await stream(owner.token, f.conversation.id, requestId);
    assert.equal(res.status, 200);
    const text = await res.text();
    assert.match(text, /text-delta/);
    assert.match(text, /\[DONE\]/);
    assert.doesNotMatch(text, /"type":"error"/);
    const messages = await call('get', `/conversations/${f.conversation.id}/messages`, owner.token);
    assert.equal(messages.body.length, 2);
    assert.equal(messages.body[1].content, 'Resposta do provedor de teste.');
    assert.equal(messages.body[1].status, 'completed');
    assert.equal((await stream(owner.token, f.conversation.id, requestId)).status, 409);
    const executions = await call('get', '/executions', owner.token);
    const execution = executions.body.find((e) => e.conversationId === f.conversation.id);
    assert.equal(execution.status, 'COMPLETED');
    assert.equal(execution.versionId, f.version.id);
    assert.ok(execution.inputTokens > 0);
    const events = await call('get', `/executions/${execution.id}`, owner.token);
    assert.ok(events.body.events.some((e) => e.type === 'text'));
    assert.ok(events.body.events.some((e) => e.type === 'usage'));
    for (const path of [
      `/agents/${f.agent.id}`,
      `/builder/${f.agent.id}/versions`,
      `/conversations/${f.conversation.id}`,
      `/conversations/${f.conversation.id}/messages`,
      `/executions/${execution.id}`,
    ])
      assert.equal((await call('get', path, other.token)).status, 404, path);
    assert.equal((await stream(other.token, f.conversation.id)).status, 404);
    assert.equal(
      (await call('post', `/executions/${execution.id}/cancel`, other.token, {})).status,
      404,
    );
    assert.equal(
      (await call('patch', `/conversations/${f.conversation.id}`, other.token, { title: 'IDOR' }))
        .status,
      404,
    );
    assert.equal(
      (await call('delete', `/conversations/${f.conversation.id}`, other.token)).status,
      404,
    );
    assert.equal(
      (
        await call('patch', `/conversations/${f.conversation.id}`, owner.token, {
          title: 'Atendimento',
        })
      ).status,
      200,
    );
    assert.equal(
      (await call('delete', `/conversations/${f.conversation.id}`, owner.token)).status,
      200,
    );
    assert.equal((await stream(owner.token, f.conversation.id)).status, 404);
  }
});
test('Provider failure is persisted without exposing credentials; cancellation preserves partial response', async () => {
  const owner = await signup();
  const broken = await published(owner.token, 'mastra', 'fixture-error');
  const response = await stream(owner.token, broken.conversation.id);
  const text = await response.text();
  assert.match(text, /"type":"error"/);
  assert.doesNotMatch(text, /local-fixture-not-a-real-key/);
  const slow = await published(owner.token, 'ai-sdk', 'fixture-slow');
  const abort = new AbortController();
  const res = await stream(owner.token, slow.conversation.id, crypto.randomUUID(), abort.signal);
  const reader = res.body.getReader();
  let received = '';
  while (!received.includes('text-delta')) {
    const next = await reader.read();
    if (next.done) break;
    received += new TextDecoder().decode(next.value);
  }
  abort.abort();
  let execution;
  for (let i = 0; i < 30; i++) {
    const all = await call('get', '/executions', owner.token);
    execution = all.body.find((e) => e.conversationId === slow.conversation.id);
    if (execution?.status === 'CANCELLED') break;
    await new Promise((r) => setTimeout(r, 100));
  }
  assert.equal(execution.status, 'CANCELLED');
  const messages = await call(
    'get',
    `/conversations/${slow.conversation.id}/messages`,
    owner.token,
  );
  assert.ok(messages.body[1].content.length > 0);
  assert.equal(messages.body[1].status, 'cancelled');
  const all = await call('get', '/executions', owner.token);
  assert.equal(all.body.find((e) => e.conversationId === broken.conversation.id).status, 'FAILED');
});

test('Timeout is bounded and recorded, and a conversation rejects concurrent generations', async () => {
  const owner = await signup();
  const slow = await published(owner.token, 'mastra', 'fixture-slow');
  const res = await stream(owner.token, slow.conversation.id);
  const concurrent = await stream(owner.token, slow.conversation.id);
  assert.equal(concurrent.status, 409);
  const body = await res.text();
  assert.match(body, /Tempo de resposta excedido/);
  const all = await call('get', '/executions', owner.token);
  assert.equal(all.body[0].status, 'TIMED_OUT');
});
