'use client';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../api-client';
import { Skeleton, ErrorState, EmptyState } from '../../../components/ui/feedback';
type Approval = {
  id: string;
  operation: string;
  status: string;
  approverId: string | null;
  requestedBy: string;
  expiresAt: string;
  reason: string | null;
  decidedBy: string | null;
  decidedAt: string | null;
  taskId: string | null;
};
const statuses: Record<string, string> = {
  pending: 'Pendentes',
  approved: 'Aprovadas',
  rejected: 'Rejeitadas',
  expired: 'Expiradas',
  cancelled: 'Canceladas',
};
export default function Approvals() {
  const client = useQueryClient();
  const approvals = useQuery({
    queryKey: ['approvals'],
    queryFn: () => apiRequest<Approval[]>('/approvals'),
    refetchInterval: 5000,
  });
  const me = useQuery({
    queryKey: ['me'],
    queryFn: () => apiRequest<{ role: string; user: { id: string } }>('/auth/me'),
  });
  const members = useQuery({
    queryKey: ['members'],
    queryFn: () =>
      apiRequest<{ id: string; role: string; user: { id: string; name: string; email: string } }[]>(
        '/team/members',
      ),
  });
  const tasks = useQuery({
    queryKey: ['approval-tasks'],
    queryFn: () => apiRequest<{ id: string; title: string; boardId: string | null }[]>('/tasks'),
  });
  const boards = useQuery({
    queryKey: ['task-boards'],
    queryFn: () =>
      apiRequest<{ id: string; columns: { id: string; name: string }[] }[]>('/tasks/boards'),
  });
  const [status, setStatus] = useState('pending');
  const [search, setSearch] = useState('');
  const [taskId, setTaskId] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const history = useQuery({
    queryKey: ['approval-history', selected],
    queryFn: () =>
      apiRequest<{ id: string; action: string; createdAt: string; actorSubject: string }[]>(
        `/approvals/${selected}/history`,
      ),
    enabled: !!selected,
  });
  const task = tasks.data?.find((t) => t.id === taskId);
  const columns = boards.data?.find((b) => b.id === task?.boardId)?.columns;
  const canWrite = ['OWNER', 'ADMIN', 'MEMBER'].includes(me.data?.role || '');
  const admin = ['OWNER', 'ADMIN'].includes(me.data?.role || '');
  function person(id: string | null) {
    const m = members.data?.find((m) => m.user.id === id);
    return m?.user.name || m?.user.email || (id ? 'Membro removido' : 'Administradores');
  }
  async function action(path: string, body: unknown) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await apiRequest(path, { method: 'POST', body });
      await Promise.all([
        client.invalidateQueries({ queryKey: ['approvals'] }),
        client.invalidateQueries({ queryKey: ['approval-history'] }),
        client.invalidateQueries({ queryKey: ['tasks'] }),
        client.invalidateQueries({ queryKey: ['notifications'] }),
      ]);
      setNotice('Operação concluída.');
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao salvar.');
      return false;
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <h1>Aprovações</h1>
      <p className="muted">Decisões humanas com prazo, responsável e histórico.</p>
      {canWrite && (
        <details className="card">
          <summary>Nova solicitação</summary>
          <form
            className="form"
            onSubmit={async (e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const data = new FormData(form);
              const target = String(data.get('target') || '');
              if (
                await action('/approvals', {
                  operation: data.get('operation'),
                  approverId: data.get('approverId'),
                  expiresAt: new Date(String(data.get('expiresAt'))).toISOString(),
                  ...(taskId ? { taskId } : {}),
                  ...(target
                    ? task?.boardId
                      ? { targetColumnId: target }
                      : { targetStatus: target }
                    : {}),
                })
              ) {
                form.reset();
                setTaskId('');
              }
            }}
          >
            <label>
              Solicitação
              <input name="operation" required minLength={2} maxLength={200} />
            </label>
            <label>
              Aprovador
              <select name="approverId" required>
                <option value="">Escolha um membro</option>
                {members.data
                  ?.filter((m) => m.role !== 'VIEWER')
                  .map((m) => (
                    <option key={m.user.id} value={m.user.id}>
                      {m.user.name || m.user.email}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Prazo para decisão
              <input type="datetime-local" name="expiresAt" required />
            </label>
            <label>
              Tarefa associada
              <select value={taskId} onChange={(e) => setTaskId(e.target.value)}>
                <option value="">Sem tarefa</option>
                {tasks.data?.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            </label>
            {task && (
              <label>
                Ao aprovar, mover para
                <select name="target" key={taskId}>
                  <option value="">Manter estado atual</option>
                  {task.boardId ? (
                    columns?.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="todo">A fazer</option>
                      <option value="doing">Em andamento</option>
                      <option value="done">Concluída</option>
                    </>
                  )}
                </select>
              </label>
            )}
            {(members.isError || tasks.isError || boards.isError) && (
              <p role="alert">Falha ao carregar equipe ou tarefas.</p>
            )}
            <button disabled={busy || members.isPending}>Solicitar aprovação</button>
          </form>
        </details>
      )}
      <div className="card grid gap-3 sm:grid-cols-2">
        <label>
          Estado
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Todos</option>
            {Object.entries(statuses).map(([value, label]) => (
              <option value={value} key={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Pesquisar solicitações
          <input value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
      </div>
      {notice && <p role="status">{notice}</p>}
      {error && <p role="alert">{error}</p>}
      {approvals.isPending ? (
        <Skeleton />
      ) : approvals.isError ? (
        <ErrorState retry={() => approvals.refetch()} />
      ) : (
        <>
          {!approvals.data.filter(
            (a) =>
              (!status || a.status === status) &&
              a.operation.toLowerCase().includes(search.toLowerCase()),
          ).length && (
            <EmptyState title="Nenhuma solicitação encontrada">
              <p>Ajuste os filtros ou crie uma solicitação.</p>
            </EmptyState>
          )}
          {approvals.data
            .filter(
              (a) =>
                (!status || a.status === status) &&
                a.operation.toLowerCase().includes(search.toLowerCase()),
            )
            .map((a) => {
              const canDecide =
                canWrite &&
                a.status === 'pending' &&
                (a.approverId ? a.approverId === me.data?.user.id : admin);
              return (
                <article key={a.id} className="card my-3 min-w-0 break-words">
                  <h2>{a.operation}</h2>
                  <p>
                    {statuses[a.status]} · Aprovador: {person(a.approverId)}
                  </p>
                  <p>Prazo: {new Date(a.expiresAt).toLocaleString('pt-BR')}</p>
                  <p>Solicitante: {person(a.requestedBy)}</p>
                  {a.reason && <p>Justificativa: {a.reason}</p>}
                  {a.decidedAt && (
                    <p>
                      Decisão: {person(a.decidedBy)} ·{' '}
                      {new Date(a.decidedAt).toLocaleString('pt-BR')}
                    </p>
                  )}
                  {canDecide && (
                    <form
                      className="form"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const data = new FormData(e.currentTarget);
                        const submitter = (e.nativeEvent as SubmitEvent)
                          .submitter as HTMLButtonElement;
                        void action(`/approvals/${a.id}/decision`, {
                          decision: submitter.value,
                          reason: data.get('reason'),
                        });
                      }}
                    >
                      <label>
                        Justificativa para {a.operation}
                        <textarea name="reason" required maxLength={2000} />
                      </label>
                      <div className="flex flex-wrap gap-3">
                        <button name="decision" value="approved" disabled={busy}>
                          Aprovar
                        </button>
                        <button
                          name="decision"
                          value="rejected"
                          className="secondary"
                          disabled={busy}
                        >
                          Rejeitar
                        </button>
                      </div>
                    </form>
                  )}
                  {canWrite &&
                    a.status === 'pending' &&
                    (admin || a.requestedBy === me.data?.user.id) && (
                      <form
                        className="form"
                        onSubmit={(e) => {
                          e.preventDefault();
                          void action(`/approvals/${a.id}/cancel`, {
                            reason: new FormData(e.currentTarget).get('reason'),
                          });
                        }}
                      >
                        <label>
                          Motivo do cancelamento de {a.operation}
                          <input name="reason" required minLength={2} maxLength={2000} />
                        </label>
                        <button className="secondary" disabled={busy}>
                          Cancelar solicitação
                        </button>
                      </form>
                    )}
                  <button
                    className="secondary"
                    onClick={() => setSelected(selected === a.id ? null : a.id)}
                  >
                    Histórico de {a.operation}
                  </button>
                  {selected === a.id &&
                    (history.isPending ? (
                      <Skeleton />
                    ) : history.isError ? (
                      <ErrorState retry={() => history.refetch()} />
                    ) : (
                      history.data.map((h) => (
                        <p key={h.id}>
                          {h.action === 'approval.created'
                            ? 'Criada'
                            : statuses[h.action.replace('approval.', '')] || h.action}{' '}
                          · {person(h.actorSubject)} ·{' '}
                          {new Date(h.createdAt).toLocaleString('pt-BR')}
                        </p>
                      ))
                    ))}
                </article>
              );
            })}
        </>
      )}
    </>
  );
}
