import { once } from 'node:events';
import { spawn } from 'node:child_process';
try {
  process.loadEnvFile('.env');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const url = new URL(process.env.DATABASE_URL);
url.searchParams.set('schema', 'colmeia_p0_e2e');
const env = {
  ...process.env,
  FILE_STORAGE_PATH: `${process.env.TMPDIR || '/tmp'}/colmeia-documents-test`,
  OPENAI_API_KEY: '',
  ANTHROPIC_API_KEY: '',
  COLMEIA_AI_API_KEY: '',
  AUTH_JWT_SECRET: 'colmeia-isolated-test-secret-not-for-production',
  MAIL_WEBHOOK_URL: '',
  MAIL_WEBHOOK_TOKEN: '',
  DATABASE_URL: url.toString(),
  API_PORT: '4300',
  WORKFLOW_QUEUE_NAME: 'colmeia-workflows-e2e',
  WEB_ORIGIN: 'http://localhost:3100',
  TEST_WEB_URL: 'http://localhost:3100',
  API_INTERNAL_URL: 'http://localhost:4300/api/v1',
  MAIL_DEV_DIRECTORY: `${process.env.TMPDIR || '/tmp'}/colmeia-p0-e2e-mail`,
  LOG_LEVEL: 'warn',
};
function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env, stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`${command} exited ${code}`)),
    );
  });
}
async function ready(url) {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Server did not become ready: ${url}`);
}
await run('npm', ['run', 'db:deploy']);
await run(process.execPath, ['packages/database/prisma/seed.mjs']);
let api = spawn(process.execPath, ['apps/api/dist/main.js'], {
  env,
  stdio: ['ignore', 'ignore', 'inherit'],
});
let web;
try {
  await ready('http://localhost:4300/api/v1/health/ready');
  web = spawn(
    process.execPath,
    ['../../node_modules/next/dist/bin/next', 'start', '--port', '3100'],
    { cwd: 'apps/web', env, stdio: ['ignore', 'ignore', 'inherit'] },
  );
  await ready('http://localhost:3100/login');
  const args = process.argv.slice(2);
  const projects = args.some((arg) => arg.startsWith('--project'))
    ? [null]
    : ['tablet', 'desktop', 'mobile'];
  for (let i = 0; i < projects.length; i++) {
    if (i) {
      const stopped = once(api, 'exit');
      api.kill('SIGTERM');
      await stopped;
      api = spawn(process.execPath, ['apps/api/dist/main.js'], {
        env,
        stdio: ['ignore', 'ignore', 'inherit'],
      });
      await ready('http://localhost:4300/api/v1/health/ready');
    }
    // Reset only the process between independent browser projects; production rate limits stay enabled.
    await run('npx', [
      'playwright',
      'test',
      ...args,
      ...(projects[i]
        ? ['--project=' + projects[i], '--output=artifacts/sprint-6.1/playwright-' + projects[i]]
        : []),
    ]);
  }
} finally {
  web?.kill('SIGTERM');
  api.kill('SIGTERM');
}
