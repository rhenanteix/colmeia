// Real Redis/BullMQ and production worker, no gateway/provider calls.
import { Queue, QueueEvents } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { spawn } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
try {
  process.loadEnvFile('.env');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const database = new URL(process.env.DATABASE_URL);
database.searchParams.set('schema', 'colmeia_p0_test');
const db = new PrismaClient({ datasources: { db: { url: database.toString() } } });
const redis = new URL(process.env.REDIS_URL);
const connection = {
  host: redis.hostname,
  port: Number(redis.port || 6379),
  username: redis.username || undefined,
  password: redis.password || undefined,
  ...(redis.protocol === 'rediss:' ? { tls: {} } : {}),
  maxRetriesPerRequest: 1,
};
const queueName = `colmeia-s6-${randomUUID()}`;
const queue = new Queue(queueName, { connection });
const events = new QueueEvents(queueName, {
  connection: { ...connection, maxRetriesPerRequest: null },
});
const worker = spawn(process.execPath, ['apps/worker/dist/index.js'], {
  env: {
    ...process.env,
    DATABASE_URL: database.toString(),
    RUNTIME_QUEUE_NAME: queueName,
    RUNTIME_ENCRYPTION_KEY: randomBytes(32).toString('hex'),
    OPENAI_API_KEY: '',
    COLMEIA_AI_API_KEY: '',
    ANTHROPIC_API_KEY: '',
  },
  stdio: ['ignore', 'inherit', 'inherit'],
});
try {
  await events.waitUntilReady();
  const organization = await db.organization.create({
    data: { name: 'Sprint 6 queue QA', slug: queueName },
  });
  const runtime = await db.runtimeInstance.create({ data: { organizationId: organization.id } });
  const completed = await db.runtimeOperation.create({
    data: {
      organizationId: organization.id,
      runtimeId: runtime.id,
      operation: 'qa.no-side-effects',
      status: 'completed',
      idempotencyKey: randomUUID(),
    },
  });
  const job = await queue.add('operation', { operationId: completed.id }, { jobId: completed.id });
  await job.waitUntilFinished(events, 15000);
  const duplicate = await queue.add(
    'operation',
    { operationId: completed.id },
    { jobId: completed.id },
  );
  assert.equal(duplicate.id, job.id);
  assert.equal(await queue.getCompletedCount(), 1);
  const failed = await db.runtimeOperation.create({
    data: {
      organizationId: organization.id,
      runtimeId: runtime.id,
      operation: 'qa.unsupported-operation',
      idempotencyKey: randomUUID(),
    },
  });
  const failing = await queue.add(
    'operation',
    { operationId: failed.id },
    { jobId: failed.id, attempts: 3, backoff: { type: 'exponential', delay: 100 } },
  );
  await assert.rejects(failing.waitUntilFinished(events, 15000));
  const storedJob = await queue.getJob(failed.id);
  assert.equal(await storedJob.getState(), 'failed');
  assert.equal(storedJob.attemptsMade, 3);
  assert.equal(
    (await db.runtimeOperation.findUniqueOrThrow({ where: { id: failed.id } })).status,
    'failed',
  );
  assert.equal(
    (await db.runtimeInstance.findUniqueOrThrow({ where: { id: runtime.id } })).status,
    'REQUESTED',
  );
  console.log(
    'PASS: real worker, isolated Redis queue, duplicate job, completed-operation replay, 3 attempts with backoff, permanent failure, tenant runtime unchanged.',
  );
} finally {
  const exited = new Promise((resolve) => worker.once('exit', resolve));
  worker.kill('SIGTERM');
  await exited;
  await events.close();
  await queue.close();
  await db.$disconnect();
}
