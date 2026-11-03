'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import Link from 'next/link';
import { useEffect } from 'react';
import { apiRequest } from './api-client';
type Notification = { id: string; title: string; body: string | null; readAt: string | null };
export function UserMenu() {
  const client = useQueryClient();
  const me = useQuery({
    queryKey: ['me'],
    queryFn: () => apiRequest<{ user: { name: string; email: string } }>('/auth/me'),
  });
  const notifications = useQuery({
    queryKey: ['notifications'],
    queryFn: () => apiRequest<Notification[]>('/notifications'),
  });
  useEffect(() => {
    const stream = new EventSource('/api/backend/notifications/events');
    stream.onmessage = (event) => {
      try {
        client.setQueryData(['notifications'], JSON.parse(event.data));
      } catch {
        /* Retry on the next snapshot. */
      }
    };
    return () => stream.close();
  }, [client]);
  const read = useMutation({
    mutationFn: (id: string) => apiRequest(`/notifications/${id}/read`, { method: 'POST' }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['notifications'] }),
  });
  const unread = notifications.data?.filter((n) => !n.readAt).length || 0;
  return (
    <div className="user-menu">
      <details className="notification-menu">
        <summary aria-label={`Notificações, ${unread} não lidas`}>
          <Bell size={18} />
          {unread > 0 && <span className="pill">{unread}</span>}
        </summary>
        <section className="card notification-panel">
          <h3>Notificações</h3>
          {notifications.isPending ? (
            <p role="status">Carregando…</p>
          ) : notifications.isError ? (
            <p role="alert">Falha ao carregar.</p>
          ) : notifications.data?.length ? (
            notifications.data.map((n) => (
              <article key={n.id}>
                <strong>{n.title}</strong>
                <p>{n.body}</p>
                {!n.readAt && (
                  <button disabled={read.isPending} onClick={() => read.mutate(n.id)}>
                    Marcar como lida
                  </button>
                )}
              </article>
            ))
          ) : (
            <p className="muted">Você está em dia. Nenhuma notificação.</p>
          )}
          {read.isError && <p role="alert">Não foi possível atualizar.</p>}
        </section>
      </details>
      <Link
        href="/app/settings"
        className="user-avatar"
        aria-label={`Configurações de ${me.data?.user.name || 'usuário'}`}
      >
        {me.data?.user.name?.slice(0, 2).toLocaleUpperCase() || '…'}
      </Link>
    </div>
  );
}
