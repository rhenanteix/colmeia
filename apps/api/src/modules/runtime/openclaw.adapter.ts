import { providerFailure } from './runtime-error';
import { Injectable, ConflictException } from '@nestjs/common';
import { createOpenAI } from '@ai-sdk/openai';
import { streamText } from 'ai';
import { decryptSecret, gatewayHealth } from '@colmeia/openclaw-adapter';
import { Db } from '../../platform/persistence/db';
import type {
  AgentRuntimeAdapter,
  AgentEvent,
  RuntimeConfig,
  RuntimeContext,
  RuntimeMessage,
} from './runtime.types';
@Injectable()
export class OpenClawAdapter implements AgentRuntimeAdapter {
  readonly engine = 'openclaw' as const;
  constructor(private db: Db) {}
  private async gateway(organizationId: string) {
    const runtime = await this.db.runtimeInstance.findFirst({
      where: { organizationId, status: 'READY' },
      orderBy: { createdAt: 'desc' },
    });
    if (!runtime?.gatewayUrl || !runtime.encryptedToken)
      throw new ConflictException('Provisione um ambiente dedicado antes de publicar.');
    const token = decryptSecret(runtime.encryptedToken, organizationId);
    try {
      await gatewayHealth(runtime.gatewayUrl, token);
    } catch {
      throw new ConflictException('O ambiente dedicado está indisponível.');
    }
    return { url: runtime.gatewayUrl, token };
  }
  async validateConfig(config: RuntimeConfig, organizationId: string) {
    if (config.tools.length)
      throw new ConflictException(
        'Ferramentas OpenClaw estão bloqueadas nesta configuração de segurança. Desmarque as ferramentas para usar o ambiente dedicado.',
      );
    await this.gateway(organizationId);
  }
  async *stream(
    context: RuntimeContext,
    config: RuntimeConfig,
    messages: RuntimeMessage[],
  ): AsyncIterable<AgentEvent> {
    const gateway = await this.gateway(context.organizationId);
    const model = createOpenAI({ apiKey: gateway.token, baseURL: `${gateway.url}/v1` }).chat(
      `openclaw/v-${context.versionId}`,
    );
    const result = streamText({
      model,
      messages,
      abortSignal: context.signal,
      maxOutputTokens: config.maxOutputTokens,
      maxRetries: 0,
    });
    for await (const chunk of result.stream) {
      if (chunk.type === 'text-delta') yield { type: 'text', delta: chunk.text };
      if (chunk.type === 'error') throw providerFailure(chunk.error);
    }
    const usage = await result.totalUsage;
    yield {
      type: 'usage',
      inputTokens: usage.inputTokens ?? 0,
      outputTokens: usage.outputTokens ?? 0,
    };
  }
}
