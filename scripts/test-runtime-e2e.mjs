import { startProviderFixture } from './provider-fixture.mjs';
const fixture = await startProviderFixture();
import { spawn } from 'node:child_process';
try {
  process.loadEnvFile('.env');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const url = new URL(process.env.DATABASE_URL);
url.searchParams.set('schema', 'colmeia_runtime_e2e');
const env = {
  ...process.env,
  OPENAI_API_KEY: 'local-fixture-not-a-real-key',
  OPENAI_BASE_URL: fixture.url,
  RUNTIME_E2E: '1',
  ANTHROPIC_API_KEY: '',
  COLMEIA_AI_API_KEY: '',
  AUTH_JWT_SECRET: 'colmeia-isolated-test-secret-not-for-production',
  MAIL_WEBHOOK_URL: '',
  MAIL_WEBHOOK_TOKEN: '',
  DATABASE_URL: url.toString(),
  API_PORT: '4300',
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
const api = spawn(process.execPath, ['apps/api/dist/main.js'], {
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
  await run('npx', ['playwright', 'test', 'runtime.spec.ts', ...process.argv.slice(2)]);
} finally {
  web?.kill('SIGTERM');
  api.kill('SIGTERM');
  await fixture.close();
}
