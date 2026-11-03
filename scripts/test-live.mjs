import { spawn } from 'node:child_process';
try {
  process.loadEnvFile('.env');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const url = new URL(process.env.DATABASE_URL);
url.searchParams.set('schema', 'colmeia_live_test');
const env = {
  ...process.env,
  AUTH_JWT_SECRET: 'colmeia-isolated-test-secret-not-for-production',
  MAIL_WEBHOOK_URL: '',
  MAIL_WEBHOOK_TOKEN: '',
  DATABASE_URL: url.toString(),
  API_PORT: '4400',
  TEST_API_URL: 'http://localhost:4400/api/v1',
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
const server = spawn(process.execPath, ['apps/api/dist/main.js'], {
  env,
  stdio: ['ignore', 'ignore', 'inherit'],
});
try {
  let ready = false;
  for (let i = 0; i < 40; i++) {
    try {
      if ((await fetch(env.TEST_API_URL + '/health/ready')).ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  if (!ready) throw new Error('Test API did not start');
  await run(process.execPath, ['--test', 'tests/live.runtime.mjs']);
} finally {
  server.kill('SIGTERM');
}
