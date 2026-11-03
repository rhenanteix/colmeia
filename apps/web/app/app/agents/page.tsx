'use client';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../api-client';
import { beeRoles } from '../bee-identity';
import { Skeleton, ErrorState, EmptyState } from '../../../components/ui/feedback';
type Agent = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  mascot: string;
  updatedAt: string;
};
export default function Agents() {
  const client = useQueryClient();
  const [archiveId, setArchiveId] = useState<string | null>(null);
  const query = useQuery({ queryKey: ['agents'], queryFn: () => apiRequest<Agent[]>('/agents') });
  const me = useQuery({
    queryKey: ['me'],
    queryFn: () => apiRequest<{ role: string }>('/auth/me'),
  });
  const canEdit = ['OWNER', 'ADMIN', 'MEMBER'].includes(me.data?.role || '');
  const [name, setName] = useState(''),
    [description, setDescription] = useState(''),
    [mascot, setMascot] = useState('atendimento'),
    [search, setSearch] = useState(''),
    [status, setStatus] = useState(''),
    [sort, setSort] = useState('recent'),
    [page, setPage] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await apiRequest('/agents', { method: 'POST', body: { name, description, mascot } });
      setName('');
      setDescription('');
      await client.invalidateQueries();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  async function archive(id: string) {
    setBusy(true);
    try {
      await apiRequest(`/agents/${id}/archive`, { method: 'POST' });
      setArchiveId(null);
      toast.success('Abelhinha arquivada. O histórico foi preservado.');
      await client.invalidateQueries();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  const filtered = (query.data || [])
    .filter(
      (a) =>
        (!status || a.status === status) &&
        (a.name + ' ' + a.description).toLocaleLowerCase().includes(search.toLocaleLowerCase()),
    )
    .sort((a, b) =>
      sort === 'name'
        ? a.name.localeCompare(b.name)
        : new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
  return (
    <div className="agents-page">
      <ConfirmDialog
        open={!!archiveId}
        onOpenChange={(open) => {
          if (!open) setArchiveId(null);
        }}
        title="Arquivar abelhinha?"
        description="Novos repasses serão bloqueados. Configuração e histórico serão preservados."
        busy={busy}
        onConfirm={() => {
          if (archiveId) archive(archiveId);
        }}
      />
      <span className="eyebrow">SEUS ESPECIALISTAS</span>
      <h1>
        Monte sua <span className="honey-text">colmeia.</span>
      </h1>
      <p className="muted">
        Cada abelhinha tem seu papel. Escolha um <Link href="/app/templates">template</Link> ou
        comece com uma ideia sua.
      </p>
      {canEdit && (
        <form className="agent-create card" onSubmit={create}>
          <div className="agent-create-preview">
            <img src={`/bees/${mascot}.png`} width="130" height="130" alt="Prévia da abelhinha" />
            <small>{beeRoles.find((b) => b.key === mascot)?.role}</small>
          </div>
          <fieldset className="form builder-fields" disabled={busy}>
            <h2>Adicionar uma abelhinha</h2>
            <label>
              Especialidade
              <select value={mascot} onChange={(e) => setMascot(e.target.value)}>
                {beeRoles.map((b) => (
                  <option key={b.key} value={b.key}>
                    {b.name} — {b.role}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Nome do agente
              <Input
                required
                minLength={2}
                maxLength={100}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label>
              O que essa abelhinha faz?
              <Textarea
                maxLength={1000}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>
            <Button disabled={busy || name.trim().length < 2}>
              {busy ? 'Criando…' : 'Criar agente'}
            </Button>
          </fieldset>
        </form>
      )}
      {error && <p role="alert">{error}</p>}
      <div className="section-heading">
        <h2>Agentes cadastrados</h2>
        <span className="muted">{query.data?.length ?? '…'} agentes</span>
      </div>
      <div className="grid">
        <label>
          Buscar abelhinha
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
          />
        </label>
        <label>
          Estado
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(0);
            }}
          >
            <option value="">Todos</option>
            <option value="DRAFT">Rascunhos</option>
            <option value="ACTIVE">Publicados</option>
            <option value="ARCHIVED">Arquivados</option>
          </select>
        </label>
        <label>
          Ordenar
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="recent">Atualizados recentemente</option>
            <option value="name">Nome</option>
          </select>
        </label>
      </div>
      {query.isPending ? (
        <Skeleton />
      ) : query.isError ? (
        <ErrorState retry={() => query.refetch()} />
      ) : filtered.length ? (
        <div className="bee-roster">
          {filtered.slice(page * 12, (page + 1) * 12).map((a) => (
            <article className="roster-card" key={a.id}>
              <Link href={`/app/agents/${a.id}/builder`}>
                <img
                  src={`/bees/${beeRoles.some((b) => b.key === a.mascot) ? a.mascot : 'exploradora'}.png`}
                  width="90"
                  height="90"
                  alt=""
                />
                <h3>{a.name}</h3>
                <p className="muted">{a.description || 'Configurar função'}</p>
              </Link>
              <span className="pill">
                {a.status === 'DRAFT'
                  ? 'Rascunho'
                  : a.status === 'ARCHIVED'
                    ? 'Arquivado'
                    : a.status === 'ACTIVE'
                      ? 'Publicado'
                      : 'Suspenso'}
              </span>
              {canEdit && a.status !== 'ARCHIVED' && (
                <Button className="secondary" disabled={busy} onClick={() => setArchiveId(a.id)}>
                  Arquivar
                </Button>
              )}
            </article>
          ))}
        </div>
      ) : (
        <EmptyState title="Nenhuma abelhinha encontrada">
          <p className="muted">Crie uma especialista ou ajuste os filtros.</p>
        </EmptyState>
      )}
      {filtered.length > 12 && (
        <div className="row">
          <Button disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            Anterior
          </Button>
          <span>Página {page + 1}</span>
          <Button
            disabled={(page + 1) * 12 >= filtered.length}
            onClick={() => setPage((p) => p + 1)}
          >
            Próxima
          </Button>
        </div>
      )}
    </div>
  );
}
