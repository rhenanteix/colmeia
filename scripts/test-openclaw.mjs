import { Queue } from 'bullmq';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { PrismaClient } from '@prisma/client';
import {
  decryptSecret,
  gatewayHealth,
  runtimeNames,
} from '../packages/openclaw-adapter/src/index.mjs';
import assert from 'node:assert/strict';
process.loadEnvFile('.env');
process.env.COLMEIA_DOCKER_DIAGNOSTICS = '1';
const url = new URL(process.env.DATABASE_URL);
url.searchParams.set('schema', 'colmeia_openclaw_test');
process.env.DATABASE_URL = url.toString();
process.env.RUNTIME_ENCRYPTION_KEY = randomBytes(32).toString('hex');
const require = createRequire(import.meta.url);
async function run(cmd, args) {
  await new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { env: process.env, stdio: 'inherit' });
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} failed`))));
    child.on('error', reject);
  });
}
await run('npm', ['run', 'db:deploy']);
await run('npm', ['run', 'build', '-w', '@colmeia/worker']);
const { GatewayProvisioner } = require('../apps/worker/dist/gateway.js');
const { docker } = require('../apps/worker/dist/docker.js');
process.env.RUNTIME_QUEUE_NAME = `colmeia-qa-${crypto.randomUUID()}`;
const redis = new URL(process.env.REDIS_URL);
const queue = new Queue(process.env.RUNTIME_QUEUE_NAME, {
  connection: { host: redis.hostname, port: Number(redis.port || 6379), maxRetriesPerRequest: 1 },
});
const worker = spawn(process.execPath, ['apps/worker/dist/index.js'], {
  env: process.env,
  stdio: ['ignore', 'inherit', 'inherit'],
});
const db = new PrismaClient();
async function operation(runtime, name) {
  const op = await db.runtimeOperation.create({
    data: {
      organizationId: runtime.organizationId,
      runtimeId: runtime.id,
      operation: name,
      idempotencyKey: crypto.randomUUID(),
    },
  });
  await queue.add('operation', { operationId: op.id }, { jobId: op.id });
  const deadline = Date.now() + 180000;
  while (Date.now() < deadline) {
    const current = await db.runtimeOperation.findUniqueOrThrow({ where: { id: op.id } });
    if (current.status === 'completed') return;
    if (current.status === 'failed') throw new Error(current.error);
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('Runtime queue operation timed out');
}

const organization = await db.organization.create({
  data: { name: 'OpenClaw QA', slug: `openclaw-${crypto.randomUUID()}` },
});
let runtime = await db.runtimeInstance.create({ data: { organizationId: organization.id } });
const provisioner = new GatewayProvisioner(db);
try {
  await operation(runtime, 'provision');
  runtime = await db.runtimeInstance.findUniqueOrThrow({ where: { id: runtime.id } });
  assert.equal(runtime.status, 'READY');
  const token = decryptSecret(runtime.encryptedToken, organization.id);
  await assert.rejects(gatewayHealth(runtime.gatewayUrl, 'invalid-token'));
  const config = {
    engine: 'openclaw',
    provider: 'openai',
    model: 'gpt-4.1-mini',
    instructions: 'Você é a Abelha Atendimento. Responda em português.',
    tools: [],
  };
  const agent = await db.agent.create({
    data: { organizationId: organization.id, name: 'Abelha Atendimento' },
  });
  const version = await db.agentVersion.create({ data: { agentId: agent.id, version: 1, config } });
  await db.runtimeDeployment.create({
    data: {
      organizationId: organization.id,
      agentId: agent.id,
      versionId: version.id,
      engine: 'openclaw',
    },
  });
  await operation(runtime, `deploy:${version.id}`);
  assert.ok((await gatewayHealth(runtime.gatewayUrl, token)).includes(`openclaw/v-${version.id}`));
  const inspect = JSON.parse(await docker(['inspect', runtimeNames(runtime.id).container]))[0];
  assert.equal(inspect.HostConfig.ReadonlyRootfs, true);
  assert.equal(inspect.Config.User, '1000:1000');
  assert.deepEqual(inspect.HostConfig.CapDrop, ['ALL']);
  console.log(
    'PASS: real OpenClaw gateway provisioning, authenticated health, version deployment and container restrictions',
  );
  if (process.env.OPENAI_API_KEY || process.env.COLMEIA_AI_API_KEY) {
    const result = await fetch(`${runtime.gatewayUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: `openclaw/v-${version.id}`,
        messages: [{ role: 'user', content: 'Diga olá em uma frase.' }],
      }),
      signal: AbortSignal.timeout(90000),
    });
    assert.equal(result.status, 200);
    const data = await result.json();
    assert.ok(data.choices?.[0]?.message?.content);
    console.log('PASS: real OpenClaw model response');
  } else console.log('BLOCKED: real model response requires OPENAI_API_KEY');
} catch (error) {
  console.error(error.message);
  try {
    const logs = await docker(['logs', '--tail', '50', runtimeNames(runtime.id).container]);
    console.error(logs.replace(/[a-f0-9]{64}/gi, '[redacted]'));
  } catch {}
  process.exitCode = 1;
} finally {
  await provisioner.destroy(runtime);
  await docker(['volume', 'rm', runtimeNames(runtime.id).volume]);
  worker.kill('SIGTERM');
  await queue.obliterate({ force: true });
  await queue.close();
  await db.$disconnect();
}
