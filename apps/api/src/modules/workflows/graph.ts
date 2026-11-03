import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
const cfg = z
  .object({
    title: z.string().min(2).max(200).optional(),
    assignedTo: z.uuid().optional(),
    approverId: z.uuid().optional(),
    recipientId: z.uuid().optional(),
    boardId: z.uuid().optional(),
    columnId: z.uuid().optional(),
    status: z.enum(['todo', 'doing', 'done']).optional(),
    seconds: z.number().int().min(1).max(2592000).optional(),
    field: z
      .string()
      .regex(/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/)
      .optional(),
    equals: z.union([z.string().max(1000), z.number(), z.boolean(), z.null()]).optional(),
  })
  .strict();
const node = z
  .object({
    id: z.string().regex(/^[a-zA-Z0-9_-]{1,60}$/),
    type: z.enum([
      'manual',
      'schedule',
      'webhook',
      'condition',
      'task',
      'approval',
      'status',
      'notification',
      'wait',
      'end',
    ]),
    config: cfg,
    next: z.string().optional(),
    otherwise: z.string().optional(),
  })
  .strict();
const schema = z.object({ nodes: z.array(node).min(2).max(50) }).strict();
export type Graph = z.infer<typeof schema>;
export function validateGraph(value: unknown): Graph {
  const parsed = schema.safeParse(value);
  if (!parsed.success)
    throw new BadRequestException(
      'Estrutura de workflow inválida: ' +
        parsed.error.issues
          .map((i) => i.path.join('.') + ' ' + i.message)
          .join('; ')
          .slice(0, 1000),
    );
  const graph = parsed.data;
  const nodes = new Map(graph.nodes.map((n) => [n.id, n]));
  const fail = (message: string): never => {
    throw new BadRequestException(message);
  };
  if (nodes.size !== graph.nodes.length) fail('IDs de etapas devem ser únicos.');
  const triggers = graph.nodes.filter((n) => ['manual', 'schedule', 'webhook'].includes(n.type));
  if (triggers.length !== 1 || triggers[0] !== graph.nodes[0])
    fail('O primeiro nó deve ser o único trigger.');
  for (const n of graph.nodes) {
    if (n.type !== 'end' && (!n.next || !nodes.has(n.next))) fail(`Conecte a etapa ${n.id}.`);
    if (n.type === 'end' && (n.next || n.otherwise)) fail('Finalização não pode ter saída.');
    if (
      n.type === 'condition' &&
      (!n.otherwise || !nodes.has(n.otherwise) || !n.config.field || n.config.equals === undefined)
    )
      fail('Condição exige campo, valor e dois destinos.');
    if (n.type !== 'condition' && n.otherwise)
      fail('Somente condições podem ter saída alternativa.');
    if (n.type === 'task' && !n.config.title) fail('Criação de tarefa exige título.');
    if (n.type === 'approval' && !n.config.approverId) fail('Escolha o aprovador.');
    if (n.type === 'notification' && (!n.config.recipientId || !n.config.title))
      fail('Notificação exige destinatário e título.');
    if (['schedule', 'wait'].includes(n.type) && !n.config.seconds)
      fail('Informe o intervalo em segundos.');
    if (n.type === 'schedule' && n.config.seconds! < 60) fail('Agendamento mínimo: 60 segundos.');
    if (n.type === 'status' && !n.config.status && !n.config.columnId)
      fail('Escolha status ou coluna.');
  }
  const visiting = new Set<string>(),
    visited = new Set<string>();
  function visit(id: string) {
    if (visiting.has(id)) fail('Ciclos não são permitidos.');
    if (visited.has(id)) return;
    visiting.add(id);
    const n = nodes.get(id)!;
    for (const next of [n.next, n.otherwise]) if (next) visit(next);
    visiting.delete(id);
    visited.add(id);
  }
  visit(graph.nodes[0].id);
  if (visited.size !== nodes.size) fail('Todas as etapas devem ser alcançáveis.');
  return graph;
}
