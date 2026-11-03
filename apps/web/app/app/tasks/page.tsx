'use client';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../api-client';
import { Skeleton, ErrorState, EmptyState } from '../../../components/ui/feedback';
type Task = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  boardId: string | null;
  columnId: string | null;
  priority: string;
  assignedTo: string | null;
  dueAt: string | null;
  labels: string[];
  revision: number;
  archivedAt: string | null;
};
type Board = {
  id: string;
  name: string;
  columns: { id: string; name: string; position: number }[];
};
type Member = { id: string; user: { id: string; name: string | null; email: string } };
const priorities = { low: 'Baixa', normal: 'Normal', high: 'Alta', urgent: 'Urgente' };
const activityLabels: Record<string, string> = {
  'task.created': 'Tarefa criada',
  'task.moved': 'Tarefa movimentada',
  'task.updated': 'Tarefa atualizada',
  'task.commented': 'Comentário adicionado',
};
const legacyColumns = [
  { id: 'todo', name: 'A fazer' },
  { id: 'doing', name: 'Em andamento' },
  { id: 'done', name: 'Concluída' },
];
export default function Tasks() {
  const client = useQueryClient();
  const [boardId, setBoardId] = useState('');
  const [search, setSearch] = useState('');
  const [priority, setPriority] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [archived, setArchived] = useState(false);
  const params = new URLSearchParams({
    boardId: boardId || 'none',
    q: search,
    priority,
    assignedTo,
    archived: String(archived),
  });
  const tasks = useQuery({
    queryKey: ['tasks', params.toString()],
    queryFn: () => apiRequest<Task[]>(`/tasks?${params}`),
    refetchInterval: 3000,
  });
  const boards = useQuery({
    queryKey: ['task-boards'],
    queryFn: () => apiRequest<Board[]>('/tasks/boards'),
    refetchInterval: 10000,
  });
  const members = useQuery({
    queryKey: ['members'],
    queryFn: () => apiRequest<Member[]>('/team/members'),
  });
  const me = useQuery({
    queryKey: ['me'],
    queryFn: () => apiRequest<{ role: string }>('/auth/me'),
  });
  const canEdit = ['OWNER', 'ADMIN', 'MEMBER'].includes(me.data?.role || '');
  const [title, setTitle] = useState('');
  const [boardName, setBoardName] = useState('');
  const [columnName, setColumnName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [dragging, setDragging] = useState<Task | null>(null);
  const board = boards.data?.find((b) => b.id === boardId);
  const columns = board?.columns ?? legacyColumns;
  const task = tasks.data?.find((t) => t.id === selected);
  const comments = useQuery({
    queryKey: ['task-comments', selected],
    queryFn: () =>
      apiRequest<{ id: string; body: string; authorSubject: string; createdAt: string }[]>(
        `/tasks/${selected}/comments`,
      ),
    enabled: !!selected,
    refetchInterval: 5000,
  });
  const history = useQuery({
    queryKey: ['task-history', selected],
    queryFn: () =>
      apiRequest<
        { id: string; action: string; actorSubject: string; createdAt: string; metadata: unknown }[]
      >(`/tasks/${selected}/history`),
    enabled: !!selected,
    refetchInterval: 5000,
  });
  const [comment, setComment] = useState('');
  function person(id: string | null) {
    const member = members.data?.find((m) => m.user.id === id);
    return member
      ? member.user.name || member.user.email
      : id
        ? 'Membro removido'
        : 'Sem responsável';
  }
  async function action(
    path: string,
    body: unknown,
    method: 'POST' | 'PATCH' = 'POST',
    message = 'Operação concluída.',
  ) {
    if (busy) return false;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await apiRequest(path, { method, body });
      await Promise.all([
        client.invalidateQueries({ queryKey: ['tasks'] }),
        client.invalidateQueries({ queryKey: ['task-boards'] }),
        client.invalidateQueries({ queryKey: ['task-comments'] }),
        client.invalidateQueries({ queryKey: ['task-history'] }),
      ]);
      setNotice(message);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível salvar.');
      await client.invalidateQueries({ queryKey: ['tasks'] });
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function update(t: Task, changes: Record<string, unknown>) {
    return action(
      `/tasks/${t.id}`,
      { revision: t.revision, ...changes },
      'PATCH',
      'Tarefa atualizada.',
    );
  }
  async function move(t: Task, destination: string) {
    await update(t, boardId ? { columnId: destination } : { status: destination });
  }
  return (
    <>
      <h1>Tarefas</h1>
      <p className="muted">
        Organize a equipe em quadros. Alterações são sincronizadas a cada três segundos.
      </p>
      <div className="card grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label>
          Quadro
          <select
            value={boardId}
            onChange={(e) => {
              setBoardId(e.target.value);
              setSelected(null);
            }}
          >
            <option value="">Tarefas gerais</option>
            {boards.data?.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Pesquisar tarefas
          <input value={search} onChange={(e) => setSearch(e.target.value)} maxLength={200} />
        </label>
        <label>
          Prioridade
          <select value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option value="">Todas</option>
            {Object.entries(priorities).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Responsável
          <select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}>
            <option value="">Todos</option>
            {members.data?.map((m) => (
              <option key={m.user.id} value={m.user.id}>
                {m.user.name || m.user.email}
              </option>
            ))}
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={archived}
            onChange={(e) => setArchived(e.target.checked)}
          />{' '}
          Mostrar arquivadas
        </label>
      </div>
      {(boards.isError || members.isError) && (
        <p role="alert">Falha ao carregar quadros ou equipe. Recarregue a página.</p>
      )}
      {canEdit && (
        <>
          <form
            className="card flex flex-wrap items-end gap-3"
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                await action(
                  '/tasks',
                  { title: title.trim(), ...(boardId ? { boardId } : {}) },
                  'POST',
                  'Tarefa criada.',
                )
              )
                setTitle('');
            }}
          >
            <label className="min-w-0 flex-1">
              Nova tarefa
              <input
                required
                minLength={2}
                maxLength={200}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={busy}
              />
            </label>
            <button disabled={busy || title.trim().length < 2}>Adicionar</button>
          </form>
          <details className="card">
            <summary>Gerenciar quadros e colunas</summary>
            <form
              className="form"
              onSubmit={async (e) => {
                e.preventDefault();
                if (await action('/tasks/boards', { name: boardName })) setBoardName('');
              }}
            >
              <label>
                Nome do novo quadro
                <input
                  required
                  minLength={2}
                  maxLength={100}
                  value={boardName}
                  onChange={(e) => setBoardName(e.target.value)}
                />
              </label>
              <button disabled={busy}>Criar quadro</button>
            </form>
            {board && (
              <>
                <form
                  key={board.id}
                  className="form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const data = new FormData(e.currentTarget);
                    void action(`/tasks/boards/${board.id}`, { name: data.get('name') }, 'PATCH');
                  }}
                >
                  <label>
                    Nome do quadro
                    <input
                      name="name"
                      defaultValue={board.name}
                      required
                      minLength={2}
                      maxLength={100}
                    />
                  </label>
                  <button disabled={busy}>Renomear quadro</button>
                </form>
                <form
                  className="form"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (
                      await action(`/tasks/boards/${board.id}/columns`, {
                        name: columnName,
                        position: board.columns.length,
                      })
                    )
                      setColumnName('');
                  }}
                >
                  <label>
                    Nova coluna
                    <input
                      required
                      minLength={2}
                      maxLength={100}
                      value={columnName}
                      onChange={(e) => setColumnName(e.target.value)}
                    />
                  </label>
                  <button disabled={busy}>Criar coluna</button>
                </form>
                {board.columns.map((col) => (
                  <form
                    key={col.id}
                    className="form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const data = new FormData(e.currentTarget);
                      void action(
                        `/tasks/columns/${col.id}`,
                        { name: data.get('name'), position: Number(data.get('position')) },
                        'PATCH',
                      );
                    }}
                  >
                    <label>
                      Nome da coluna {col.name}
                      <input
                        name="name"
                        defaultValue={col.name}
                        required
                        minLength={2}
                        maxLength={100}
                      />
                    </label>
                    <label>
                      Ordem de {col.name}
                      <input
                        type="number"
                        min={0}
                        max={1000}
                        name="position"
                        defaultValue={col.position}
                        required
                      />
                    </label>
                    <button disabled={busy}>Salvar coluna {col.name}</button>
                  </form>
                ))}
              </>
            )}
          </details>
        </>
      )}
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {tasks.isPending ? (
        <Skeleton />
      ) : tasks.isError ? (
        <ErrorState retry={() => tasks.refetch()} />
      ) : (
        <>
          {!tasks.data.length && (
            <EmptyState title="Nenhuma tarefa cadastrada">
              <p>Nenhuma tarefa corresponde aos filtros atuais.</p>
            </EmptyState>
          )}
          <div className="grid min-w-0 gap-4 lg:grid-cols-3">
            {columns.map((col) => (
              <section
                key={col.id}
                aria-label={`Coluna ${col.name}`}
                className="card min-w-0"
                onDragOver={(e) => {
                  if (canEdit && !busy) e.preventDefault();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragging && canEdit && !busy) void move(dragging, col.id);
                  setDragging(null);
                }}
              >
                <h2>{col.name}</h2>
                {tasks.data
                  .filter((t) => (boardId ? t.columnId : t.status) === col.id)
                  .map((t) => (
                    <article
                      key={t.id}
                      draggable={canEdit && !busy}
                      onDragStart={() => setDragging(t)}
                      onDragEnd={() => setDragging(null)}
                      className="card my-3 min-w-0 break-words"
                    >
                      <strong>{t.title}</strong>
                      <p>
                        {person(t.assignedTo)} · {priorities[t.priority as keyof typeof priorities]}
                      </p>
                      {t.dueAt && (
                        <p>
                          Prazo:{' '}
                          {new Date(t.dueAt).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                        </p>
                      )}
                      {!!t.labels.length && <p>Etiquetas: {t.labels.join(', ')}</p>}
                      <label>
                        Status de {t.title}
                        <select
                          value={boardId ? t.columnId || '' : t.status}
                          disabled={!canEdit || busy}
                          onChange={(e) => void move(t, e.target.value)}
                        >
                          {columns.map((c) => (
                            <option value={c.id} key={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        className="secondary"
                        onClick={() => {
                          setSelected(t.id);
                          setComment('');
                        }}
                      >
                        Detalhes de {t.title}
                      </button>
                    </article>
                  ))}
              </section>
            ))}
          </div>
        </>
      )}
      {task && (
        <section className="card my-4" aria-label="Detalhes da tarefa">
          <h2>{task.title}</h2>
          <button className="secondary" onClick={() => setSelected(null)}>
            Fechar detalhes
          </button>
          <form
            key={`${task.id}:${task.revision}`}
            className="form"
            onSubmit={(e) => {
              e.preventDefault();
              const data = new FormData(e.currentTarget);
              void update(task, {
                title: data.get('title'),
                description: data.get('description'),
                assignedTo: data.get('assignedTo') || null,
                priority: data.get('priority'),
                dueAt: data.get('dueAt') ? `${data.get('dueAt')}T12:00:00.000Z` : null,
                labels: String(data.get('labels'))
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean),
              });
            }}
          >
            <fieldset disabled={!canEdit || busy} className="grid gap-3">
              <label>
                Título
                <input
                  name="title"
                  defaultValue={task.title}
                  required
                  minLength={2}
                  maxLength={200}
                />
              </label>
              <label>
                Descrição
                <textarea
                  name="description"
                  defaultValue={task.description || ''}
                  maxLength={2000}
                />
              </label>
              <label>
                Responsável da tarefa
                <select name="assignedTo" defaultValue={task.assignedTo || ''}>
                  <option value="">Sem responsável</option>
                  {members.data?.map((m) => (
                    <option key={m.user.id} value={m.user.id}>
                      {m.user.name || m.user.email}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Prioridade da tarefa
                <select name="priority" defaultValue={task.priority}>
                  {Object.entries(priorities).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Prazo
                <input type="date" name="dueAt" defaultValue={task.dueAt?.slice(0, 10) || ''} />
              </label>
              <label>
                Etiquetas separadas por vírgula
                <input name="labels" defaultValue={task.labels.join(', ')} maxLength={800} />
              </label>
              <button>Salvar detalhes</button>
            </fieldset>
          </form>
          {canEdit && (
            <button
              disabled={busy}
              onClick={async () => {
                if (await update(task, { archived: !task.archivedAt })) setSelected(null);
              }}
            >
              {task.archivedAt ? 'Restaurar tarefa' : 'Arquivar tarefa'}
            </button>
          )}
          <h3>Comentários</h3>
          {comments.isPending ? (
            <Skeleton />
          ) : comments.isError ? (
            <ErrorState retry={() => comments.refetch()} />
          ) : (
            comments.data.map((c) => (
              <div className="card" key={c.id}>
                <strong>{person(c.authorSubject)}</strong>
                <p className="whitespace-pre-wrap break-words">{c.body}</p>
                <time>{new Date(c.createdAt).toLocaleString('pt-BR')}</time>
              </div>
            ))
          )}
          {canEdit && (
            <form
              className="form"
              onSubmit={async (e) => {
                e.preventDefault();
                if (await action(`/tasks/${task.id}/comments`, { body: comment })) setComment('');
              }}
            >
              <label>
                Novo comentário
                <textarea
                  required
                  maxLength={4000}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                />
              </label>
              <button disabled={busy || !comment.trim()}>Comentar</button>
            </form>
          )}
          <h3>Histórico de atividades</h3>
          {history.isPending ? (
            <Skeleton />
          ) : history.isError ? (
            <ErrorState retry={() => history.refetch()} />
          ) : (
            history.data.map((h) => (
              <div key={h.id} className="card">
                <p>
                  {activityLabels[h.action] || h.action} · {person(h.actorSubject)} ·{' '}
                  {new Date(h.createdAt).toLocaleString('pt-BR')}
                </p>
              </div>
            ))
          )}
        </section>
      )}
    </>
  );
}
