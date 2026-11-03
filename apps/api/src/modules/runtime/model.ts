import { ConflictException } from '@nestjs/common';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOllama } from 'ollama-ai-provider';
import type { RuntimeConfig } from './runtime.types';
export function providerModel(config: RuntimeConfig) {
  if (config.provider === 'ollama') {
    const baseURL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    return createOllama({ baseURL })(config.model);
  }
  const key =
    config.provider === 'openai'
      ? process.env.OPENAI_API_KEY || process.env.COLMEIA_AI_API_KEY
      : process.env.ANTHROPIC_API_KEY;
  if (!key) throw new ConflictException('Credencial do provedor ausente no servidor.');
  return config.provider === 'openai'
    ? createOpenAI({ apiKey: key, baseURL: process.env.OPENAI_BASE_URL }).chat(config.model)
    : createAnthropic({ apiKey: key })(config.model);
}
