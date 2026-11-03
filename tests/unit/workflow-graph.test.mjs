import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { validateGraph } = require('../../apps/api/dist/modules/workflows/graph.js');
describe('deterministic graph validation', () => {
  it('rejects cycles, duplicate IDs, disconnected nodes and missing branch destinations', () => {
    const base = {
      nodes: [
        { id: 'start', type: 'manual', config: {}, next: 'end' },
        { id: 'end', type: 'end', config: {} },
      ],
    };
    expect(validateGraph(base)).toEqual(base);
    expect(() =>
      validateGraph({ nodes: [{ ...base.nodes[0], next: 'start' }, base.nodes[1]] }),
    ).toThrow(/Ciclos/);
    expect(() => validateGraph({ nodes: [...base.nodes, base.nodes[1]] })).toThrow(/únicos/);
    expect(() =>
      validateGraph({ nodes: [...base.nodes, { id: 'unreachable', type: 'end', config: {} }] }),
    ).toThrow(/alcançáveis/);
    expect(() =>
      validateGraph({
        nodes: [
          { ...base.nodes[0], next: 'if' },
          { id: 'if', type: 'condition', config: { field: 'approved', equals: true }, next: 'end' },
          base.nodes[1],
        ],
      }),
    ).toThrow(/Condição/);
  });
  it('requires bounded waits, minimum scheduling interval and notification recipients', () => {
    const end = { id: 'end', type: 'end', config: {} };
    expect(() =>
      validateGraph({
        nodes: [{ id: 'start', type: 'schedule', config: { seconds: 1 }, next: 'end' }, end],
      }),
    ).toThrow(/60 segundos/);
    expect(() =>
      validateGraph({
        nodes: [
          { id: 'start', type: 'manual', config: {}, next: 'wait' },
          { id: 'wait', type: 'wait', config: { seconds: 0 }, next: 'end' },
          end,
        ],
      }),
    ).toThrow();
    expect(() =>
      validateGraph({
        nodes: [
          { id: 'start', type: 'manual', config: {}, next: 'notify' },
          { id: 'notify', type: 'notification', config: { title: 'Notify' }, next: 'end' },
          end,
        ],
      }),
    ).toThrow(/destinatário/);
  });
});
