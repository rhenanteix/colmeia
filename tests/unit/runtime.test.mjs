import 'reflect-metadata';
import { createRequire } from 'node:module';
import { describe, it, expect } from 'vitest';
import {
  encryptSecret,
  decryptSecret,
  runtimeNames,
} from '../../packages/openclaw-adapter/src/index.mjs';
const require = createRequire(import.meta.url);
const { parseRuntimeConfig } = require('../../apps/api/dist/modules/runtime/runtime.config.js');
const { calculate } = require('../../apps/api/dist/modules/runtime/tools.js');
const base = {
  instructions: 'Ajude o usuário com clareza.',
  provider: 'openai',
  model: 'gpt-4.1-mini',
};
describe('runtime policy', () => {
  it('defaults to Mastra and bounded execution', () => {
    expect(parseRuntimeConfig(base)).toMatchObject({
      engine: 'mastra',
      maxOutputTokens: 2048,
      tools: [],
    });
  });
  it('rejects injected tools, unsupported engines and invalid limits', () => {
    for (const override of [
      { tools: ['exec'] },
      { engine: 'shell' },
      { maxOutputTokens: -1 },
      { monthlyExecutionLimit: 0 },
      { temperature: NaN },
    ])
      expect(() => parseRuntimeConfig({ ...base, ...override })).toThrow();
  });
  it('calculates without evaluating expressions and rejects invalid arithmetic', () => {
    expect(calculate({ operation: 'multiply', a: 7, b: 6 })).toEqual({ value: 42 });
    expect(() => calculate({ operation: 'divide', a: 1, b: 0 })).toThrow();
    expect(() => calculate({ operation: 'multiply', a: 1e308, b: 1e308 })).toThrow();
  });
  it('binds encrypted secrets to the owning tenant and detects tampering', () => {
    const previous = process.env.RUNTIME_ENCRYPTION_KEY;
    process.env.RUNTIME_ENCRYPTION_KEY = 'a'.repeat(64);
    try {
      const encrypted = encryptSecret('private-token', 'org-a');
      expect(encrypted).not.toContain('private-token');
      expect(decryptSecret(encrypted, 'org-a')).toBe('private-token');
      expect(() => decryptSecret(encrypted, 'org-b')).toThrow();
      expect(() => decryptSecret(encrypted.slice(0, -3) + 'abc', 'org-a')).toThrow();
    } finally {
      if (previous === undefined) delete process.env.RUNTIME_ENCRYPTION_KEY;
      else process.env.RUNTIME_ENCRYPTION_KEY = previous;
    }
  });
  it('rejects arbitrary Docker identifiers', () => {
    expect(() => runtimeNames('../../etc')).toThrow();
    expect(() => runtimeNames('x; touch /tmp/bad')).toThrow();
  });
});

const { providerFailure } = require('../../apps/api/dist/modules/runtime/runtime-error.js');
it('classifies quota and authentication without echoing provider secrets', () => {
  expect(
    providerFailure({ statusCode: 429, data: { error: { code: 'credit_balance_exhausted' } } })
      .code,
  ).toBe('quota');
  expect(providerFailure({ statusCode: 401, responseBody: 'secret-provider-body' }).code).toBe(
    'auth',
  );
  expect(
    providerFailure({ statusCode: 401, responseBody: 'secret-provider-body' }).message,
  ).not.toContain('secret-provider-body');
  expect(providerFailure({ statusCode: 429 }).code).toBe('rate');
});
