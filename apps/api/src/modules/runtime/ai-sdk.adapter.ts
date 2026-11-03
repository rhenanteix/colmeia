import { providerFailure, RuntimeFailure } from './runtime-error';
import { Injectable } from '@nestjs/common';
import { streamText, isStepCount, type ToolSet } from 'ai';
import { providerModel } from './model';
import { toolDefinitions } from './tools';
import type {
  AgentRuntimeAdapter,
  AgentEvent,
  RuntimeConfig,
  RuntimeContext,
  RuntimeMessage,
} from './runtime.types';
@Injectable()
export class AiSdkAdapter implements AgentRuntimeAdapter {
  readonly engine = 'ai-sdk' as const;
  async validateConfig(config: RuntimeConfig) {
    providerModel(config);
  }
  async *stream(
    context: RuntimeContext,
    config: RuntimeConfig,
    messages: RuntimeMessage[],
  ): AsyncIterable<AgentEvent> {
    const definitions = toolDefinitions(context);
    const tools: ToolSet = {};
    for (const name of Object.keys(definitions) as (keyof typeof definitions)[])
      if (config.tools.includes(name)) tools[name] = definitions[name];
    const result = streamText({
      model: providerModel(config) as unknown as Parameters<typeof streamText>[0]['model'],
      system: config.instructions,
      messages,
      tools,
      stopWhen: isStepCount(5),
      abortSignal: context.signal,
      temperature: config.temperature,
      maxOutputTokens: config.maxOutputTokens,
      maxRetries: 0,
    });
    for await (const chunk of result.stream) {
      if (chunk.type === 'text-delta') yield { type: 'text', delta: chunk.text };
      if (chunk.type === 'tool-call')
        yield { type: 'tool-call', id: chunk.toolCallId, name: chunk.toolName, input: chunk.input };
      if (chunk.type === 'tool-result')
        yield {
          type: 'tool-result',
          id: chunk.toolCallId,
          name: chunk.toolName,
          output: chunk.output,
        };
      if (chunk.type === 'error') throw providerFailure(chunk.error);
      if (chunk.type === 'tool-error') throw new RuntimeFailure('tool');
    }
    const usage = await result.totalUsage;
    yield {
      type: 'usage',
      inputTokens: usage.inputTokens ?? 0,
      outputTokens: usage.outputTokens ?? 0,
    };
  }
}
