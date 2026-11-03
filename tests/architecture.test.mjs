import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
test('Nest feature modules exist', () => {
  for (const f of [
    'identity',
    'agents',
    'collaboration',
    'billing',
    'onboarding',
    'workspace',
    'bee-teams',
  ])
    assert.ok(
      existsSync(new URL('../apps/api/src/modules/' + f + '/' + f + '.module.ts', import.meta.url)),
      f,
    );
});
test('API has global DTO validation and shutdown hooks', () => {
  const main = read('apps/api/src/main.ts');
  assert.match(main, /forbidNonWhitelisted:\s*true/);
  assert.match(main, /enableShutdownHooks/);
});
test('API uses membership-verified JWT tenant context', () => {
  const s = read('apps/api/src/security.ts');
  assert.match(s, /jwtVerify/);
  assert.match(s, /membership\.findUnique/);
});
test('Web has typed API errors and dedicated feature folders', () => {
  assert.match(read('apps/web/app/app/api-client.ts'), /class ApiError/);
  for (const f of ['agents', 'auth', 'dashboard', 'teams', 'billing', 'onboarding'])
    assert.ok(existsSync(new URL('../apps/web/features/' + f + '/README.md', import.meta.url)));
});
