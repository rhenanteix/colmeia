'use client';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../api-client';
import { Skeleton, ErrorState } from '../../../components/ui/feedback';
type Wiki = {
  id: string;
  title: string;
  content: string;
  visibility: string;
  revision: number;
  ownerId: string;
  parentId: string | null;
  agentId: string | null;
  boardId: string | null;
};
type File = {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  ownerId: string;
  visibility: string;
  wikiId: string | null;
};
export default function Documents() {
  const client = useQueryClient();
  const [search, setSearch] = useState('');
  const [folder, setFolder] = useState('');
  const [selected, setSelected] = useState<Wiki | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const me = useQuery({
    queryKey: ['me'],
    queryFn: () => apiRequest<{ role: string; user: { id: string } }>('/auth/me'),
  });
  const pages = useQuery({
    queryKey: ['wiki', search],
    queryFn: () => apiRequest<Wiki[]>(`/documents/wiki?q=${encodeURIComponent(search)}`),
  });
  const files = useQuery({
    queryKey: ['files', folder],
    queryFn: () => apiRequest<File[]>(`/documents/files?folderId=${folder}`),
  });
  const folders = useQuery({
    queryKey: ['folders'],
    queryFn: () => apiRequest<{ id: string; name: string }[]>('/documents/folders'),
  });
  const agents = useQuery({
    queryKey: ['document-agents'],
    queryFn: () => apiRequest<{ id: string; name: string }[]>('/agents'),
  });
  const tasks = useQuery({
    queryKey: ['document-tasks'],
    queryFn: () => apiRequest<{ id: string; title: string }[]>('/tasks'),
  });
  const boards = useQuery({
    queryKey: ['task-boards'],
    queryFn: () => apiRequest<{ id: string; name: string }[]>('/tasks/boards'),
  });
  const versions = useQuery({
    queryKey: ['wiki-versions', selected?.id],
    queryFn: () =>
      apiRequest<{ revision: number; title: string; content: string }[]>(
        `/documents/wiki/${selected?.id}/versions`,
      ),
    enabled: !!selected,
  });
  const canWrite = ['OWNER', 'ADMIN', 'MEMBER'].includes(me.data?.role || '');
  const canEdit = (ownerId: string) =>
    canWrite && (['OWNER', 'ADMIN'].includes(me.data?.role || '') || ownerId === me.data?.user.id);
  async function refresh() {
    await Promise.all(
      ['wiki', 'files', 'folders', 'wiki-versions'].map((key) =>
        client.invalidateQueries({ queryKey: [key] }),
      ),
    );
  }
  async function action(
    path: string,
    body?: unknown,
    method: 'POST' | 'PATCH' | 'DELETE' = 'POST',
  ) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await apiRequest<Wiki>(path, { method, body });
      await refresh();
      setNotice('Operação concluída.');
      return result;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao salvar.');
      return null;
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <h1>Arquivos e Wiki</h1>
      <p className="muted">Documentos da equipe com permissões e versões.</p>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      <section className="card my-4">
        <h2>Arquivos</h2>
        <label>
          Pasta
          <select value={folder} onChange={(e) => setFolder(e.target.value)}>
            <option value="">Todas</option>
            {folders.data?.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </label>
        {canWrite && (
          <>
            <form
              className="form"
              onSubmit={async (e) => {
                e.preventDefault();
                const form = e.currentTarget;
                if (await action('/documents/folders', { name: new FormData(form).get('name') }))
                  form.reset();
              }}
            >
              <label>
                Nova pasta
                <input name="name" minLength={2} maxLength={100} required />
              </label>
              <button disabled={busy}>Criar pasta</button>
            </form>
            <form
              className="form"
              onSubmit={async (e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const data = new FormData(form);
                for (const [key, value] of [...data.entries()]) if (value === '') data.delete(key);
                setBusy(true);
                setError('');
                setNotice('');
                try {
                  const response = await fetch('/api/backend/documents/files', {
                    method: 'POST',
                    body: data,
                  });
                  const result = await response.json();
                  if (!response.ok)
                    throw new Error(
                      Array.isArray(result.message)
                        ? result.message.join('. ')
                        : result.message || 'Falha no upload.',
                    );
                  await refresh();
                  form.reset();
                  setNotice('Arquivo enviado.');
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Falha no upload.');
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label>
                Arquivo (até 10 MiB)
                <input
                  type="file"
                  name="file"
                  required
                  accept=".pdf,.png,.jpg,.jpeg,.txt,.md,.csv"
                />
              </label>
              <label>
                Pasta de destino
                <select name="folderId" defaultValue="">
                  <option value="">Sem pasta</option>
                  {folders.data?.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Permissão do arquivo
                <select name="visibility">
                  <option value="organization">Organização</option>
                  <option value="private">Privado (autor e administradores)</option>
                </select>
              </label>
              <label>
                Anexar à página Wiki
                <select name="wikiId">
                  <option value="">Sem página</option>
                  {pages.data?.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Associar à tarefa
                <select name="taskId">
                  <option value="">Sem tarefa</option>
                  {tasks.data?.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Agente do arquivo
                <select name="agentId">
                  <option value="">Sem agente</option>
                  {agents.data?.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </label>
              <button disabled={busy}>Enviar arquivo</button>
            </form>
          </>
        )}
        {files.isPending ? (
          <Skeleton />
        ) : files.isError ? (
          <ErrorState retry={() => files.refetch()} />
        ) : files.data.length ? (
          files.data.map((f) => (
            <div className="card my-2 break-words" key={f.id}>
              <a href={`/api/backend/documents/files/${f.id}/download`}>{f.name}</a>
              <p>
                {f.size.toLocaleString('pt-BR')} bytes · {f.mimeType} ·{' '}
                {f.visibility === 'private' ? 'Privado' : 'Organização'}
              </p>
              {canEdit(f.ownerId) && (
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() => {
                    if (window.confirm(`Excluir ${f.name}?`))
                      void action(`/documents/files/${f.id}`, undefined, 'DELETE');
                  }}
                >
                  Excluir {f.name}
                </button>
              )}
            </div>
          ))
        ) : (
          <p>Nenhum arquivo encontrado.</p>
        )}
      </section>
      <section className="card">
        <h2>Wiki</h2>
        <label>
          Buscar na Wiki
          <input value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
        {pages.isPending ? (
          <Skeleton />
        ) : pages.isError ? (
          <ErrorState retry={() => pages.refetch()} />
        ) : (
          <div className="flex flex-wrap gap-2">
            {pages.data.map((p) => (
              <button className="secondary" key={p.id} onClick={() => setSelected(p)}>
                {p.title} · v{p.revision}
              </button>
            ))}
          </div>
        )}
        <button className="secondary" onClick={() => setSelected(null)}>
          Nova página Wiki
        </button>
        {(canWrite || selected) && (
          <form
            key={`${selected?.id}:${selected?.revision}`}
            className="form"
            onSubmit={async (e) => {
              e.preventDefault();
              const data = new FormData(e.currentTarget);
              const body = {
                title: data.get('title'),
                content: data.get('content'),
                visibility: data.get('visibility'),
                parentId: data.get('parentId') || null,
                agentId: data.get('agentId') || null,
                boardId: data.get('boardId') || null,
                ...(selected ? { revision: selected.revision } : {}),
              };
              const saved = await action(
                selected ? `/documents/wiki/${selected.id}` : '/documents/wiki',
                body,
                selected ? 'PATCH' : 'POST',
              );
              if (saved) setSelected(saved);
            }}
          >
            <fieldset
              disabled={busy || (selected ? !canEdit(selected.ownerId) : !canWrite)}
              className="grid gap-3"
            >
              <label>
                Título da página
                <input
                  name="title"
                  defaultValue={selected?.title || ''}
                  minLength={2}
                  maxLength={200}
                  required
                />
              </label>
              <label>
                Conteúdo
                <textarea
                  name="content"
                  defaultValue={selected?.content || ''}
                  rows={8}
                  maxLength={50000}
                />
              </label>
              <label>
                Permissão da página
                <select name="visibility" defaultValue={selected?.visibility || 'organization'}>
                  <option value="organization">Organização</option>
                  <option value="private">Privada (autor e administradores)</option>
                </select>
              </label>
              <label>
                Página superior
                <select name="parentId" defaultValue={selected?.parentId || ''}>
                  <option value="">Raiz</option>
                  {pages.data
                    ?.filter((p) => p.id !== selected?.id)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Projeto (quadro)
                <select name="boardId" defaultValue={selected?.boardId || ''}>
                  <option value="">Sem projeto</option>
                  {boards.data?.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Agente da página
                <select name="agentId" defaultValue={selected?.agentId || ''}>
                  <option value="">Sem agente</option>
                  {agents.data?.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </label>
              <button>{selected ? 'Salvar página' : 'Criar página'}</button>
            </fieldset>
          </form>
        )}
        {selected && (
          <>
            <h3>Conteúdo publicado</h3>
            <div className="whitespace-pre-wrap break-words">{selected.content}</div>
            <h3>Anexos</h3>
            {files.data
              ?.filter((f) => f.wikiId === selected.id)
              .map((f) => (
                <p key={f.id}>
                  <a href={`/api/backend/documents/files/${f.id}/download`}>{f.name}</a>
                </p>
              ))}
            <h3>Versões</h3>
            {versions.isPending ? (
              <Skeleton />
            ) : versions.isError ? (
              <ErrorState retry={() => versions.refetch()} />
            ) : (
              versions.data.map((v) => (
                <details className="card" key={v.revision}>
                  <summary>
                    Versão {v.revision} · {v.title}
                  </summary>
                  <p className="whitespace-pre-wrap break-words">{v.content}</p>
                  {canEdit(selected.ownerId) && v.revision !== selected.revision && (
                    <button
                      disabled={busy}
                      onClick={async () => {
                        const restored = await action(`/documents/wiki/${selected.id}/restore`, {
                          revision: selected.revision,
                          version: v.revision,
                        });
                        if (restored) setSelected(restored);
                      }}
                    >
                      Restaurar versão {v.revision}
                    </button>
                  )}
                </details>
              ))
            )}
          </>
        )}
      </section>
      {(folders.isError || tasks.isError || agents.isError || boards.isError) && (
        <p role="alert">
          Não foi possível carregar uma das listas de associações. Recarregue a página.
        </p>
      )}
    </>
  );
}
