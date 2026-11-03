import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const base = process.env.TEST_API_URL;
async function call(path, token, body) {
  const r = await fetch(base + path, {
    method: body ? 'POST' : 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json();
  assert.ok(r.ok, `${path}: HTTP ${r.status} ${data.message || ''}`);
  return data;
}
test('LIVE gpt-4.1-mini through Mastra and AI SDK with tool execution and database persistence', async () => {
  assert.ok(
    process.env.OPENAI_API_KEY || process.env.COLMEIA_AI_API_KEY,
    'Real server credential required',
  );
  const owner = await call('/auth/register', null, {
    email: `live-${crypto.randomUUID()}@example.test`,
    password: 'Live-test-password-2026',
    name: 'Live QA',
    organizationName: 'Colmeia Live QA',
  });
  const evidence = [];
  for (const engine of ['mastra', 'ai-sdk']) {
    const agent = await call('/agents', owner.token, { name: `Abelha Atendimento ${engine}` });
    const config = {
      engine,
      provider: 'openai',
      model: 'gpt-4.1-mini',
      instructions:
        'Você é a Abelha Atendimento. Use a ferramenta calculator para qualquer cálculo. Responda de forma breve em português.',
      tools: ['calculator'],
      maxOutputTokens: 256,
    };
    await call(`/builder/${agent.id}`, owner.token, { config, revision: 0 });
    const version = await call(`/builder/${agent.id}/versions`, owner.token, {
      config,
      revision: 1,
    });
    await call(`/agents/${agent.id}/publish`, owner.token, { versionId: version.version.id });
    const conversation = await call('/conversations', owner.token, { agentId: agent.id });
    const response = await fetch(`${base}/conversations/${conversation.id}/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${owner.token}` },
      body: JSON.stringify({
        text: 'Use a calculadora para multiplicar 7 por 6 e diga o resultado.',
        requestId: crypto.randomUUID(),
      }),
      signal: AbortSignal.timeout(100000),
    });
    assert.equal(response.status, 200);
    const stream = await response.text();
    assert.match(stream, /text-delta/);
    assert.doesNotMatch(stream, /"type":"error"/);
    const messages = await call(`/conversations/${conversation.id}/messages`, owner.token);
    assert.match(messages[1].content, /42/);
    const executions = await call('/executions', owner.token);
    const execution = executions.find((e) => e.conversationId === conversation.id);
    assert.equal(execution.status, 'COMPLETED');
    assert.ok(execution.inputTokens > 0);
    const detail = await call(`/executions/${execution.id}`, owner.token);
    assert.ok(detail.events.some((e) => e.type === 'tool-result'));
    evidence.push({
      engine,
      model: config.model,
      executionId: execution.id,
      versionId: version.version.id,
      status: execution.status,
      response: messages[1].content,
      inputTokens: execution.inputTokens,
      outputTokens: execution.outputTokens,
      eventTypes: [...new Set(detail.events.map((e) => e.type))],
    });
  }
  await mkdir('artifacts/verification', { recursive: true });
  await writeFile(
    'artifacts/verification/live-models.json',
    JSON.stringify({ checkedAt: new Date().toISOString(), evidence }, null, 2) + '\n',
  );
});
