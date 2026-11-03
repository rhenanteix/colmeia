import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
test('Prisma generator and datasource use multiline blocks', () => {
  const schema = read('packages/database/prisma/schema.prisma');
  assert.match(schema, /generator client \{\s*provider = "prisma-client-js"\s*\}/);
  assert.match(schema, /datasource db \{\s*provider = "postgresql"/);
});
test('Required template description receives fallback', () => {
  assert.match(read('apps/api/src/product.ts'), /description:\s*d\.description \?\? ''/);
});
test('Prisma JSON writes are typed', () => {
  assert.match(read('apps/api/src/product.ts'), /Prisma\.InputJsonValue/);
  assert.match(read('apps/api/src/modules/agents/agents.service.ts'), /Prisma\.InputJsonValue/);
});
test('Prettier is installed and scripts configured', () => {
  const root = JSON.parse(read('package.json'));
  assert.ok(root.devDependencies.prettier);
  assert.ok(root.scripts.format);
  assert.ok(root.scripts['format:check']);
});
