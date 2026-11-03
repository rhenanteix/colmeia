export type RuntimeEngine = 'mastra' | 'ai-sdk' | 'openclaw';
export type RuntimeConfig = {
  engine: RuntimeEngine;
  provider: 'openai' | 'anthropic' | 'ollama';
  model: string;
  instructions: string;
  temperature: number;
  maxOutputTokens: number;
  monthlyExecutionLimit: number;
  tools: string[];
};
export type RuntimeContext = {
  organizationId: string;
  organizationName: string;
  agentId: string;
  agentName: string;
  versionId: string;
  conversationId: string;
  signal: AbortSignal;
};
export type RuntimeMessage =
  { role: 'user'; content: string } | { role: 'assistant'; content: string };
export type AgentEvent =
  | { type: 'text'; delta: string }
  | { type: 'tool-call'; id: string; name: string; input: unknown }
  | { type: 'tool-result'; id: string; name: string; output: unknown }
  | { type: 'usage'; inputTokens: number; outputTokens: number };
export interface AgentRuntimeAdapter {
  readonly engine: RuntimeEngine;
  validateConfig(config: RuntimeConfig, organizationId: string): Promise<void>;
  stream(
    context: RuntimeContext,
    config: RuntimeConfig,
    messages: RuntimeMessage[],
  ): AsyncIterable<AgentEvent>;
}
