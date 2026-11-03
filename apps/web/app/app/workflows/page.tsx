'use client';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../api-client';
import { Skeleton, ErrorState } from '../../../components/ui/feedback';
type Node = {
  id: string;
  type: string;
  config: Record<string, string | number | boolean | null>;
  next?: string;
  otherwise?: string;
};
type Workflow = {
  id: string;
  name: string;
  draft: { nodes: Node[] };
  revision: number;
  publishedVersion: number;
  active: boolean;
};
type Run = {
  id: string;
  status: string;
  correlationId: string;
  createdAt: string;
  error: string | null;
  attempts: number;
  approvalId: string | null;
  steps: {
    id: string;
    nodeId: string;
    type: string;
    status: string;
    attempt: number;
    error: string | null;
  }[];
};
const types: Record<string, string> = {
  manual: 'Trigger manual',
  webhook: 'Trigger webhook',
  schedule: 'Trigger agendado',
  task: 'Criar e atribuir tarefa',
  approval: 'Solicitar aprovação',
  status: 'Atualizar tarefa',
  notification: 'Notificar membro',
  condition: 'Condição',
  wait: 'Esperar',
  end: 'Finalizar',
};
const states: Record<string, string> = {
  queued: 'Na fila',
  waiting: 'Em espera',
  approval: 'Aguardando aprovação',
  completed: 'Concluída',
  failed: 'Falhou',
  cancelled: 'Cancelada',
};
export default function Workflows() {
  const client = useQueryClient();
  const list = useQuery({
    queryKey: ['workflows'],
    queryFn: () => apiRequest<Workflow[]>('/workflows'),
  });
  const me = useQuery({
    queryKey: ['me'],
    queryFn: () => apiRequest<{ role: string; user: { id: string } }>('/auth/me'),
  });
  const members = useQuery({
    queryKey: ['members'],
    queryFn: () =>
      apiRequest<{ role: string; user: { id: string; name: string; email: string } }[]>(
        '/team/members',
      ),
  });
  const [editing, setEditing] = useState<Workflow | null>(null);
  const [secret, setSecret] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [input, setInput] = useState('{}');
  const runs = useQuery({
    queryKey: ['workflow-runs', editing?.id],
    queryFn: () => apiRequest<Run[]>(`/workflows/${editing?.id}/runs`),
    enabled: !!editing,
    refetchInterval: 2000,
  });
  const saved = list.data?.find((w) => w.id === editing?.id);
  const dirty =
    !!editing &&
    !!saved &&
    (editing.name !== saved.name || JSON.stringify(editing.draft) !== JSON.stringify(saved.draft));
  const canEdit = ['OWNER', 'ADMIN', 'MEMBER'].includes(me.data?.role || '');
  async function action(path: string, body: unknown, method: 'POST' | 'PATCH' = 'POST') {
    if (busy) return null;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await apiRequest<Workflow & { webhookSecret?: string }>(path, {
        method,
        body,
      });
      await client.invalidateQueries({ queryKey: ['workflows'] });
      await client.invalidateQueries({ queryKey: ['workflow-runs'] });
      setNotice('Operação concluída.');
      return result;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao salvar.');
      return null;
    } finally {
      setBusy(false);
    }
  }
  function changeNode(id: string, changes: Partial<Node>) {
    setEditing((w) =>
      w
        ? {
            ...w,
            draft: { nodes: w.draft.nodes.map((n) => (n.id === id ? { ...n, ...changes } : n)) },
          }
        : w,
    );
  }
  async function create() {
    const userId = me.data?.user.id;
    if (!userId) return;
    const draft = {
      nodes: [
        { id: 'start', type: 'manual', config: {}, next: 'task' },
        {
          id: 'task',
          type: 'task',
          config: { title: 'Nova entrega', assignedTo: userId },
          next: 'approval',
        },
        {
          id: 'approval',
          type: 'approval',
          config: { approverId: userId, title: 'Autorizar entrega' },
          next: 'status',
        },
        { id: 'status', type: 'status', config: { status: 'done' }, next: 'notification' },
        {
          id: 'notification',
          type: 'notification',
          config: { recipientId: userId, title: 'Entrega concluída' },
          next: 'end',
        },
        { id: 'end', type: 'end', config: {} },
      ],
    };
    const w = await action('/workflows', { name, draft });
    if (w) {
      setEditing(w);
      setName('');
      setSecret(w.webhookSecret || '');
    }
  }
  return (
    <>
      <h1>Workflows</h1>
      <p className="muted">Processos determinísticos com tarefas e decisões humanas.</p>
      {canEdit && (
        <form
          className="card form"
          onSubmit={(e) => {
            e.preventDefault();
            void create();
          }}
        >
          <label>
            Nome do novo workflow
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              minLength={2}
              maxLength={100}
            />
          </label>
          <button disabled={busy}>Criar workflow</button>
        </form>
      )}
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {list.isPending ? (
        <Skeleton />
      ) : list.isError ? (
        <ErrorState retry={() => list.refetch()} />
      ) : (
        <div className="flex flex-wrap gap-2">
          {list.data.map((w) => (
            <button
              className="secondary"
              key={w.id}
              onClick={() => {
                setEditing(w);
                setSecret('');
              }}
            >
              {w.name} · v{w.publishedVersion} · {w.active ? 'Ativo' : 'Inativo'}
            </button>
          ))}
        </div>
      )}
      {editing && (
        <>
          <section className="card my-4">
            <h2>Editor de {editing.name}</h2>
            <p>
              Conecte cada etapa ao próximo destino. Condições têm duas saídas. Salve o rascunho
              antes de publicar.
            </p>
            <label>
              Nome do workflow
              <input
                disabled={!canEdit || busy}
                value={editing.name}
                maxLength={100}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              />
            </label>
            {secret && (
              <div className="card">
                <p>Guarde este segredo agora; ele não será exibido novamente.</p>
                <label>
                  Segredo do webhook
                  <input readOnly value={secret} />
                </label>
              </div>
            )}
            <p className="break-all">Webhook: POST /api/v1/workflow-webhooks/{editing.id}</p>
            <p>
              Envie os cabeçalhos x-workflow-secret e idempotency-key, e um corpo com o objeto
              input.
            </p>
            <ol className="grid gap-4 lg:grid-cols-2">
              {editing.draft.nodes.map((n) => (
                <li className="card min-w-0" key={n.id}>
                  <h3>
                    {n.id} · {types[n.type]}
                  </h3>
                  <fieldset disabled={!canEdit || busy} className="grid gap-3">
                    <label>
                      Tipo de {n.id}
                      <select
                        value={n.type}
                        onChange={(e) =>
                          changeNode(n.id, {
                            type: e.target.value,
                            config: ['schedule', 'wait'].includes(e.target.value)
                              ? { seconds: 60 }
                              : {},
                            otherwise: undefined,
                            ...(e.target.value === 'end'
                              ? { next: undefined, otherwise: undefined }
                              : {}),
                          })
                        }
                      >
                        {Object.entries(types).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                    {['task', 'notification', 'approval'].includes(n.type) && (
                      <label>
                        Título de {n.id}
                        <input
                          value={String(n.config.title || '')}
                          maxLength={200}
                          onChange={(e) =>
                            changeNode(n.id, { config: { ...n.config, title: e.target.value } })
                          }
                        />
                      </label>
                    )}
                    {['task', 'notification', 'approval'].includes(n.type) &&
                      (() => {
                        const key =
                          n.type === 'task'
                            ? 'assignedTo'
                            : n.type === 'approval'
                              ? 'approverId'
                              : 'recipientId';
                        return (
                          <label>
                            Membro de {n.id}
                            <select
                              value={String(n.config[key] || '')}
                              onChange={(e) => {
                                const config = { ...n.config };
                                if (e.target.value) config[key] = e.target.value;
                                else delete config[key];
                                changeNode(n.id, { config });
                              }}
                            >
                              <option value="">Escolha um membro</option>
                              {members.data
                                ?.filter((m) => n.type !== 'approval' || m.role !== 'VIEWER')
                                .map((m) => (
                                  <option key={m.user.id} value={m.user.id}>
                                    {m.user.name || m.user.email}
                                  </option>
                                ))}
                            </select>
                          </label>
                        );
                      })()}
                    {n.type === 'status' && (
                      <label>
                        Status de destino
                        <select
                          value={String(n.config.status || '')}
                          onChange={(e) => changeNode(n.id, { config: { status: e.target.value } })}
                        >
                          <option value="">Escolha</option>
                          <option value="todo">A fazer</option>
                          <option value="doing">Em andamento</option>
                          <option value="done">Concluída</option>
                        </select>
                      </label>
                    )}
                    {['schedule', 'wait', 'approval'].includes(n.type) && (
                      <label>
                        {n.type === 'approval' ? 'Prazo' : 'Intervalo'} em segundos de {n.id}
                        <input
                          type="number"
                          min={n.type === 'schedule' ? 60 : 1}
                          max={2592000}
                          value={Number(n.config.seconds || (n.type === 'approval' ? 86400 : 60))}
                          onChange={(e) =>
                            changeNode(n.id, {
                              config: { ...n.config, seconds: Number(e.target.value) },
                            })
                          }
                        />
                      </label>
                    )}
                    {n.type === 'condition' && (
                      <>
                        <label>
                          Campo de input em {n.id}
                          <input
                            value={String(n.config.field || '')}
                            onChange={(e) =>
                              changeNode(n.id, { config: { ...n.config, field: e.target.value } })
                            }
                          />
                        </label>
                        <label>
                          Igual ao texto
                          <input
                            value={String(n.config.equals ?? '')}
                            onChange={(e) =>
                              changeNode(n.id, { config: { ...n.config, equals: e.target.value } })
                            }
                          />
                        </label>
                        <label>
                          Se falso, ir para
                          <select
                            value={n.otherwise || ''}
                            onChange={(e) => changeNode(n.id, { otherwise: e.target.value })}
                          >
                            <option value="">Conectar etapa</option>
                            {editing.draft.nodes
                              .filter((x) => x.id !== n.id)
                              .map((x) => (
                                <option key={x.id} value={x.id}>
                                  {x.id} · {types[x.type]}
                                </option>
                              ))}
                          </select>
                        </label>
                      </>
                    )}
                    {n.type !== 'end' && (
                      <label>
                        Próxima etapa de {n.id}
                        <select
                          value={n.next || ''}
                          onChange={(e) => changeNode(n.id, { next: e.target.value })}
                        >
                          <option value="">Conectar etapa</option>
                          {editing.draft.nodes
                            .filter((x) => x.id !== n.id)
                            .map((x) => (
                              <option key={x.id} value={x.id}>
                                {x.id} · {types[x.type]}
                              </option>
                            ))}
                        </select>
                      </label>
                    )}
                    <button
                      className="secondary"
                      onClick={() =>
                        setEditing({
                          ...editing,
                          draft: {
                            nodes: editing.draft.nodes
                              .filter((x) => x.id !== n.id)
                              .map((x) => ({
                                ...x,
                                ...(x.next === n.id ? { next: undefined } : {}),
                                ...(x.otherwise === n.id ? { otherwise: undefined } : {}),
                              })),
                          },
                        })
                      }
                    >
                      Remover etapa {n.id}
                    </button>
                  </fieldset>
                  <p aria-label={`Conexão de ${n.id}`}>
                    → {n.next || 'Fim'}
                    {n.otherwise ? ` / Se falso → ${n.otherwise}` : ''}
                  </p>
                </li>
              ))}
            </ol>
            {canEdit && (
              <div className="flex flex-wrap gap-3">
                <button
                  className="secondary"
                  disabled={busy || editing.draft.nodes.length >= 50}
                  onClick={() =>
                    setEditing({
                      ...editing,
                      draft: {
                        nodes: [
                          ...editing.draft.nodes,
                          {
                            id: 'step-' + crypto.randomUUID().slice(0, 8),
                            type: 'notification',
                            config: {},
                          },
                        ],
                      },
                    })
                  }
                >
                  Adicionar etapa
                </button>
                <button
                  disabled={busy}
                  onClick={async () => {
                    const w = await action(
                      `/workflows/${editing.id}`,
                      { name: editing.name, draft: editing.draft, revision: editing.revision },
                      'PATCH',
                    );
                    if (w) setEditing(w);
                  }}
                >
                  Salvar rascunho
                </button>
                <button
                  disabled={busy || dirty}
                  onClick={async () => {
                    if (
                      await action(`/workflows/${editing.id}/publish`, {
                        revision: editing.revision,
                      })
                    )
                      setEditing(await apiRequest<Workflow>(`/workflows/${editing.id}`));
                  }}
                >
                  Validar e publicar
                </button>
                <button
                  disabled={busy || !editing.publishedVersion}
                  onClick={async () => {
                    const w = await action(`/workflows/${editing.id}/active`, {
                      active: !editing.active,
                    });
                    if (w) setEditing(w);
                  }}
                >
                  {editing.active ? 'Desativar' : 'Ativar'}
                </button>
              </div>
            )}
          </section>
          {canEdit && (
            <form
              className="card form"
              onSubmit={(e) => {
                e.preventDefault();
                try {
                  const parsed = JSON.parse(input);
                  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
                    throw new Error('Informe um objeto JSON.');
                  void action(`/workflows/${editing.id}/run`, {
                    idempotencyKey: crypto.randomUUID(),
                    input: parsed,
                  });
                } catch {
                  setError('Informe input em formato de objeto JSON.');
                }
              }}
            >
              <label>
                Dados de entrada (JSON)
                <textarea value={input} onChange={(e) => setInput(e.target.value)} />
              </label>
              <button disabled={busy || !editing.active}>Executar manualmente</button>
            </form>
          )}
          <h2>Histórico de execuções</h2>
          {runs.isPending ? (
            <Skeleton />
          ) : runs.isError ? (
            <ErrorState retry={() => runs.refetch()} />
          ) : (
            runs.data.map((r) => (
              <article className="card my-3 min-w-0 break-words" key={r.id}>
                <h3>{states[r.status] || r.status}</h3>
                <p>
                  {new Date(r.createdAt).toLocaleString('pt-BR')} · Tentativas: {r.attempts}
                </p>
                <p className="break-all">Correlation ID: {r.correlationId}</p>
                {r.error && <p role="alert">{r.error}</p>}
                {r.status === 'approval' && (
                  <a href="/app/approvals">Abrir central de aprovações</a>
                )}
                <ol>
                  {r.steps.map((s) => (
                    <li key={s.id}>
                      {s.nodeId}: {states[s.status] || s.status} · tentativa {s.attempt}
                      {s.error ? ` · ${s.error}` : ''}
                    </li>
                  ))}
                </ol>
                {canEdit && ['queued', 'waiting', 'approval'].includes(r.status) && (
                  <button
                    disabled={busy}
                    onClick={() => void action(`/workflows/runs/${r.id}/cancel`, {})}
                  >
                    Cancelar execução
                  </button>
                )}
                {canEdit && r.status === 'failed' && !r.approvalId && (
                  <button
                    disabled={busy}
                    onClick={() => void action(`/workflows/runs/${r.id}/retry`, {})}
                  >
                    Reexecutar etapa com falha
                  </button>
                )}
              </article>
            ))
          )}
        </>
      )}
    </>
  );
}
