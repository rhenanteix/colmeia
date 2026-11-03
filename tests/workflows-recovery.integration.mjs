import { spawn } from 'node:child_process';
import { once } from 'node:events';
import test from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
const url = 'http://localhost:4205/api/v1';
let server;
async function start() {
  server = spawn(process.execPath, ['apps/api/dist/main.js'], {
    env: {
      ...process.env,
      API_PORT: '4205',
      WORKFLOW_QUEUE_NAME: 'colmeia-workflows-recovery',
      LOG_LEVEL: 'error',
    },
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(url + '/health/ready')).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('Recovery test API did not start');
}
async function stop(signal = 'SIGTERM') {
  const exiting = once(server, 'exit');
  server.kill(signal);
  await exiting;
}
async function request(path, body, token, method = 'POST') {
  const r = await fetch(url + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: r.status, data: await r.json() };
}
async function until(fn, label) {
  for (let i = 0; i < 150; i++) {
    const value = await fn();
    if (value) return value;
    await new Promise((r) => setTimeout(r, 100));
  }
  assert.fail(label);
}
test(
  'Workflow recovery after SIGKILL, scheduled dispatch, bounded retry and cancellation',
  { timeout: 60000 },
  async () => {
    const db = new PrismaClient();
    await start();
    try {
      const a = (
        await request('/auth/register', {
          email: `recovery-${crypto.randomUUID()}@example.test`,
          password: 'Recovery-password-2026',
          name: 'Recovery',
          organizationName: 'Recovery',
        })
      ).data;
      async function publish(name, nodes) {
        const w = (await request('/workflows', { name, draft: { nodes } }, a.token)).data;
        assert.ok(w.id);
        assert.equal(
          (await request(`/workflows/${w.id}/publish`, { revision: 0 }, a.token)).status,
          201,
        );
        assert.equal(
          (await request(`/workflows/${w.id}/active`, { active: true }, a.token)).status,
          201,
        );
        return w;
      }
      const w = await publish('Crash recovery', [
        { id: 'start', type: 'manual', config: {}, next: 'task' },
        { id: 'task', type: 'task', config: { title: 'Exactly once after crash' }, next: 'wait' },
        { id: 'wait', type: 'wait', config: { seconds: 3 }, next: 'end' },
        { id: 'end', type: 'end', config: {} },
      ]);
      const run = (
        await request(`/workflows/${w.id}/run`, { idempotencyKey: 'crash-1', input: {} }, a.token)
      ).data;
      await until(
        async () =>
          (await db.workflowRun.findUnique({ where: { id: run.id } })).status === 'waiting',
        'Run did not suspend',
      );
      await stop('SIGKILL');
      await start();
      await until(
        async () =>
          (await db.workflowRun.findUnique({ where: { id: run.id } })).status === 'completed',
        'Run did not recover',
      );
      assert.equal(
        await db.task.count({
          where: { organizationId: a.organization.id, title: 'Exactly once after crash' },
        }),
        1,
      );
      assert.equal(
        await db.workflowStep.count({
          where: { runId: run.id, nodeId: 'task', status: 'completed' },
        }),
        1,
      );
      const scheduled = await publish('Scheduled', [
        { id: 'start', type: 'schedule', config: { seconds: 60 }, next: 'end' },
        { id: 'end', type: 'end', config: {} },
      ]);
      // Bring only the persisted due time forward; production scheduling path is unchanged.
      await db.workflow.update({
        where: { id: scheduled.id },
        data: { nextRunAt: new Date(Date.now() - 1000) },
      });
      await until(
        () =>
          db.workflowRun.findFirst({
            where: { workflowId: scheduled.id, status: 'completed', trigger: 'schedule' },
          }),
        'Scheduled run missing',
      );
      assert.equal(await db.workflowRun.count({ where: { workflowId: scheduled.id } }), 1);
      const invalid = await publish('Bounded failure', [
        { id: 'start', type: 'manual', config: {}, next: 'status' },
        { id: 'status', type: 'status', config: { status: 'done' }, next: 'end' },
        { id: 'end', type: 'end', config: {} },
      ]);
      const failed = (
        await request(
          `/workflows/${invalid.id}/run`,
          { idempotencyKey: 'failure-1', input: {} },
          a.token,
        )
      ).data;
      await until(
        async () =>
          (await db.workflowRun.findUnique({ where: { id: failed.id } })).status === 'failed',
        'Retries did not terminate',
      );
      assert.equal(
        await db.workflowStep.count({ where: { runId: failed.id, status: 'failed' } }),
        3,
      );
      assert.equal((await request(`/workflows/runs/${failed.id}/retry`, {}, a.token)).status, 201);
      await until(
        async () =>
          (await db.workflowRun.findUnique({ where: { id: failed.id } })).status === 'failed',
        'Manual retry did not terminate',
      );
      assert.equal(
        await db.workflowStep.count({ where: { runId: failed.id, status: 'failed' } }),
        6,
      );
      const waiting = await publish('Cancellation', [
        { id: 'start', type: 'manual', config: {}, next: 'wait' },
        { id: 'wait', type: 'wait', config: { seconds: 60 }, next: 'end' },
        { id: 'end', type: 'end', config: {} },
      ]);
      const cancelled = (
        await request(
          `/workflows/${waiting.id}/run`,
          { idempotencyKey: 'cancel-1', input: {} },
          a.token,
        )
      ).data;
      await until(
        async () =>
          (await db.workflowRun.findUnique({ where: { id: cancelled.id } })).status === 'waiting',
        'Cancellation run did not wait',
      );
      assert.equal(
        (await request(`/workflows/runs/${cancelled.id}/cancel`, {}, a.token)).status,
        201,
      );
      assert.equal(
        (await db.workflowRun.findUnique({ where: { id: cancelled.id } })).status,
        'cancelled',
      );
      assert.equal(
        (await request(`/workflows/runs/${cancelled.id}/retry`, {}, a.token)).status,
        409,
      );
    } finally {
      await stop();
      await db.$disconnect();
    }
  },
);
