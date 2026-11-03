'use client';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../api-client';
type Invitation = {
  id: string;
  email: string;
  role: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  expiresAt: string;
};
export default function Team() {
  const client = useQueryClient();
  const [email, setEmail] = useState(''),
    [role, setRole] = useState('MEMBER'),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState('');
  const me = useQuery({
    queryKey: ['me'],
    queryFn: () => apiRequest<{ role: string }>('/auth/me'),
  });
  const admin = ['OWNER', 'ADMIN'].includes(me.data?.role || '');
  const members = useQuery({
    queryKey: ['members'],
    queryFn: () =>
      apiRequest<{ id: string; role: string; user: { name: string; email: string } }[]>(
        '/team/members',
      ),
  });
  const invitations = useQuery({
    queryKey: ['invitations'],
    queryFn: () => apiRequest<Invitation[]>('/team/invitations'),
    enabled: admin,
  });
  async function action(
    path: string,
    body?: unknown,
    method: 'POST' | 'PATCH' | 'DELETE' = 'POST',
  ) {
    setBusy(true);
    setNotice('');
    try {
      await apiRequest(path, { method, body });
      await client.invalidateQueries();
      setNotice('Operação concluída.');
    } catch (e) {
      setNotice(String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeader eyebrow="PESSOAS E PERMISSÕES" title="Sua equipe" />
      {members.isPending ? (
        <p role="status">Carregando membros…</p>
      ) : members.isError ? (
        <p role="alert">Falha ao carregar membros.</p>
      ) : (
        <DataTable
          rows={members.data}
          caption="Membros da organização ativa"
          columns={[
            {
              key: 'name',
              header: 'Pessoa',
              render: (m) => (
                <>
                  <strong>{m.user.name}</strong>
                  <p className="muted">{m.user.email}</p>
                </>
              ),
            },
            {
              key: 'role',
              header: 'Papel',
              render: (m) =>
                admin && m.role !== 'OWNER' ? (
                  <label className="text-sm">
                    Permissão de {m.user.name}
                    <select
                      value={m.role}
                      disabled={busy}
                      onChange={(e) =>
                        action(
                          `/team/members/${m.id}`,
                          { role: e.target.value, email: m.user.email },
                          'PATCH',
                        )
                      }
                    >
                      <option value="ADMIN">Administrador</option>
                      <option value="MEMBER">Membro</option>
                      <option value="VIEWER">Leitor</option>
                    </select>
                  </label>
                ) : (
                  <Badge variant="secondary">{m.role}</Badge>
                ),
            },
            {
              key: 'actions',
              header: 'Ações',
              render: (m) =>
                admin && m.role !== 'OWNER' ? (
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => {
                      if (window.confirm('Remover este membro da organização?'))
                        action(`/team/members/${m.id}`, undefined, 'DELETE');
                    }}
                  >
                    Remover
                  </Button>
                ) : (
                  <span className="muted">Proprietário protegido</span>
                ),
            },
          ]}
        />
      )}
      {admin && (
        <>
          <h2>Convidar colega</h2>
          <form
            className="card form"
            onSubmit={(e) => {
              e.preventDefault();
              action('/team/invitations', { email, role });
            }}
          >
            <label>
              Email
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label>
              Papel
              <select value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="ADMIN">Administrador</option>
                <option value="MEMBER">Membro</option>
                <option value="VIEWER">Leitor</option>
              </select>
            </label>
            <button disabled={busy}>Enviar convite</button>
          </form>
          <h2>Convites</h2>
          {invitations.isError && <p role="alert">Falha ao carregar convites.</p>}
          {invitations.data?.map((i) => (
            <div className="card" key={i.id}>
              <strong>{i.email}</strong>
              <p>
                {i.role} ·{' '}
                {i.acceptedAt
                  ? 'Aceito'
                  : i.revokedAt
                    ? 'Revogado'
                    : new Date(i.expiresAt) < new Date()
                      ? 'Expirado'
                      : 'Pendente'}
              </p>
              {!i.acceptedAt && !i.revokedAt && (
                <div className="row">
                  <button
                    disabled={busy}
                    onClick={() => action(`/team/invitations/${i.id}/resend`)}
                  >
                    Reenviar
                  </button>
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={() => {
                      if (window.confirm('Revogar este convite?'))
                        action(`/team/invitations/${i.id}/revoke`);
                    }}
                  >
                    Revogar
                  </button>
                </div>
              )}
            </div>
          ))}
        </>
      )}
      {notice && <p role="status">{notice}</p>}
    </>
  );
}
