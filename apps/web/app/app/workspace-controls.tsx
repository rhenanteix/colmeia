'use client';
import { useEffect } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { apiRequest, ApiError } from './api-client';
type Me = {
  activeOrganizationId: string;
  user: { name: string; memberships: { organization: { id: string; name: string } }[] };
};
export function WorkspaceControls() {
  const client = useQueryClient();
  const me = useQuery({
    queryKey: ['me'],
    queryFn: () => apiRequest<Me>('/auth/me'),
    retry: false,
  });
  useEffect(() => {
    if (me.error instanceof ApiError && me.error.status === 401) location.replace('/login');
  }, [me.error]);
  useEffect(() => {
    const timer = window.setInterval(() => {
      apiRequest('/auth/refresh', { method: 'POST' }).catch(() =>
        client.invalidateQueries({ queryKey: ['me'] }),
      );
    }, 30 * 60_000);
    return () => window.clearInterval(timer);
  }, [client]);
  const change = useMutation({
    mutationFn: (organizationId: string) =>
      apiRequest('/auth/switch', { method: 'POST', body: { organizationId } }),
    onSuccess: () => {
      location.assign('/app');
    },
  });
  const logout = useMutation({
    mutationFn: () => apiRequest('/auth/logout', { method: 'POST' }),
    onSuccess: () => {
      location.assign('/login');
    },
  });
  return (
    <div className="workspace-controls">
      <label htmlFor="workspace">Organização ativa</label>
      <select
        id="workspace"
        disabled={!me.data || change.isPending}
        value={me.data?.activeOrganizationId || ''}
        onChange={(e) => change.mutate(e.target.value)}
      >
        {!me.data && <option>Carregando…</option>}
        {me.data?.user.memberships.map((m) => (
          <option key={m.organization.id} value={m.organization.id}>
            {m.organization.name}
          </option>
        ))}
      </select>
      <button className="secondary" disabled={logout.isPending} onClick={() => logout.mutate()}>
        Sair
      </button>
      {(change.isError || logout.isError || me.isError) && (
        <p role="alert">Não foi possível concluir. Tente novamente.</p>
      )}
    </div>
  );
}
