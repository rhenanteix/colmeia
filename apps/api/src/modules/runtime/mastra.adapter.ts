import { providerFailure, RuntimeFailure } from './runtime-error';
import { noopLogger } from '@mastra/core/logger';
import { Injectable } from '@nestjs/common';
import { Agent } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
import type { ToolsInput } from '@mastra/core/agent';
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
export class MastraAdapter implements AgentRuntimeAdapter {
  readonly engine = 'mastra' as const;
  async validateConfig(config: RuntimeConfig) {
    providerModel(config);
  }
  async *stream(
    context: RuntimeContext,
    config: RuntimeConfig,
    messages: RuntimeMessage[],
  ): AsyncIterable<AgentEvent> {
    const tools: ToolsInput = {};
    const definitions = toolDefinitions(context);
    if (config.tools.includes('calculator'))
      tools.calculator = createTool({ id: 'calculator', ...definitions.calculator });
    for (const name of ['date_time', 'organization_info', 'agent_info'] as const) {
      if (config.tools.includes(name)) tools[name] = createTool({ id: name, ...definitions[name] });
    }
    const agent = new Agent({
      id: context.versionId,
      name: context.agentName,
      instructions: config.instructions,
      model: providerModel(config),
      tools,
    });
    agent.__registerPrimitives({ logger: noopLogger });
    const result = await agent.stream(messages, {
      abortSignal: context.signal,
      maxSteps: 5,
      modelSettings: {
        temperature: config.temperature,
        maxOutputTokens: config.maxOutputTokens,
        maxRetries: 0,
      },
    });
    for await (const chunk of result.fullStream) {
      if (chunk.type === 'text-delta') yield { type: 'text', delta: chunk.payload.text };
      if (chunk.type === 'tool-call')
        yield {
          type: 'tool-call',
          id: chunk.payload.toolCallId,
          name: chunk.payload.toolName,
          input: chunk.payload.args,
        };
      if (chunk.type === 'tool-result')
        yield {
          type: 'tool-result',
          id: chunk.payload.toolCallId,
          name: chunk.payload.toolName,
          output: chunk.payload.result,
        };
      if (chunk.type === 'error') throw providerFailure(chunk.payload.error);
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
