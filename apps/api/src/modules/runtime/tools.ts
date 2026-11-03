import { z } from 'zod';
import type { RuntimeContext } from './runtime.types';
export const calculatorInput = z.object({
  operation: z.enum(['add', 'subtract', 'multiply', 'divide']),
  a: z.number().finite(),
  b: z.number().finite(),
});
export function calculate(input: z.infer<typeof calculatorInput>) {
  if (input.operation === 'divide' && input.b === 0) throw new Error('Divisão por zero');
  const value = {
    add: () => input.a + input.b,
    subtract: () => input.a - input.b,
    multiply: () => input.a * input.b,
    divide: () => input.a / input.b,
  }[input.operation]();
  if (!Number.isFinite(value)) throw new Error('Resultado fora do limite');
  return { value };
}
export function toolDefinitions(context: RuntimeContext) {
  return {
    date_time: {
      description: 'Data e hora UTC atuais.',
      inputSchema: z.object({}),
      execute: async () => ({ now: new Date().toISOString() }),
    },
    calculator: {
      description: 'Calcula uma operação aritmética, sem executar código.',
      inputSchema: calculatorInput,
      execute: async (input: z.infer<typeof calculatorInput>) => calculate(input),
    },
    organization_info: {
      description: 'Nome da organização autorizada nesta execução.',
      inputSchema: z.object({}),
      execute: async () => ({ name: context.organizationName }),
    },
    agent_info: {
      description: 'Identidade e versão do próprio agente.',
      inputSchema: z.object({}),
      execute: async () => ({ name: context.agentName, versionId: context.versionId }),
    },
  };
}
