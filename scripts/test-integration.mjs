import { once } from 'node:events';
import { spawn } from 'node:child_process';
try {
  process.loadEnvFile('.env');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const url = new URL(process.env.DATABASE_URL);
url.searchParams.set('schema', 'colmeia_p0_test');
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
  API_PORT: '4200',
  WORKFLOW_QUEUE_NAME: 'colmeia-workflows-integration',
  TEST_API_URL: 'http://localhost:4200/api/v1',
  MAIL_DEV_DIRECTORY: `${process.env.TMPDIR || '/tmp'}/colmeia-p0-integration-mail`,
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
await run('npm', ['run', 'build', '-w', '@colmeia/api']);
await run('npm', ['run', 'db:deploy']);
let server = spawn(process.execPath, ['apps/api/dist/main.js'], {
  env,
  stdio: ['ignore', 'inherit', 'inherit'],
});
async function ready() {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error('Test API exited before readiness');
    try {
      if (
        (await fetch(env.TEST_API_URL + '/health/ready', { signal: AbortSignal.timeout(1000) })).ok
      )
        return;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('Test API did not become ready within 30 seconds');
}
try {
  await ready();
  await run(process.execPath, ['--test', 'tests/p0.integration.mjs']);
  const stopped = once(server, 'exit');
  server.kill('SIGTERM');
  await stopped;
  server = spawn(process.execPath, ['apps/api/dist/main.js'], {
    env,
    stdio: ['ignore', 'inherit', 'inherit'],
  });
  await ready();
  await run(process.execPath, ['--test', 'tests/documents.integration.mjs']);

  await run(process.execPath, ['--test', 'tests/workflows-recovery.integration.mjs']);
} finally {
  server.kill('SIGTERM');
}
