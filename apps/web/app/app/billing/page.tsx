'use client';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Quotas } from '../../../components/quotas';
import { Skeleton, ErrorState } from '../../../components/ui/feedback';
import { apiRequest } from '../api-client';
type Subscription = {
  planId: string;
  status: string;
  paymentStatus: string;
  revision: number;
  trialEndsAt: string | null;
};
const states: Record<string, string> = {
  active: 'Ativa',
  cancelled: 'Cancelada',
  past_due: 'Pagamento pendente',
  trialing: 'Em avaliação',
  trial_expired: 'Avaliação encerrada',
};
const eventNames: Record<string, string> = {
  'subscription.created': 'Assinatura criada',
  'subscription.change': 'Plano alterado',
  'subscription.cancel': 'Assinatura cancelada',
  'subscription.reactivate': 'Assinatura reativada',
  'subscription.trial_expired': 'Avaliação encerrada',
  'payment.failed': 'Pagamento recusado',
};
export default function Billing() {
  const client = useQueryClient();
  const me = useQuery({
    queryKey: ['me'],
    queryFn: () => apiRequest<{ role: string }>('/auth/me'),
  });
  const plans = useQuery({
    queryKey: ['plans'],
    queryFn: () =>
      apiRequest<{ id: string; name: string; limits: Record<string, number> }[]>('/billing/plans'),
  });
  const data = useQuery({
    queryKey: ['subscription'],
    queryFn: () =>
      apiRequest<{
        subscription: Subscription;
        events: { id: string; type: string; createdAt: string }[];
      }>('/billing/subscription'),
  });
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const admin = ['OWNER', 'ADMIN'].includes(me.data?.role || '');
  async function command(action: string, planId?: string) {
    if (!data.data) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await apiRequest('/billing/subscription', {
        method: 'POST',
        body: {
          action,
          ...(planId ? { planId } : {}),
          revision: data.data.subscription.revision,
          idempotencyKey: crypto.randomUUID(),
        },
      });
      await Promise.all([
        client.invalidateQueries({ queryKey: ['subscription'] }),
        client.invalidateQueries({ queryKey: ['quotas'] }),
      ]);
      setNotice('Assinatura atualizada.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao alterar assinatura.');
      await client.invalidateQueries({ queryKey: ['subscription'] });
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <h1>Plano e limites</h1>
      <div className="card">
        <p>Gestão interna de planos. Nenhuma cobrança é realizada.</p>
        <p className="muted">Stripe não configurado e não homologado.</p>
      </div>
      {notice && <p role="status">{notice}</p>}
      {error && <p role="alert">{error}</p>}
      {data.isPending ? (
        <Skeleton />
      ) : data.isError ? (
        <ErrorState retry={() => data.refetch()} />
      ) : (
        <section className="card my-4">
          <h2>Assinatura da organização</h2>
          <p>
            Plano:{' '}
            {plans.data?.find((p) => p.id === data.data.subscription.planId)?.name ||
              data.data.subscription.planId}
          </p>
          <p>Estado: {states[data.data.subscription.status] || data.data.subscription.status}</p>
          <p>
            Pagamento:{' '}
            {data.data.subscription.paymentStatus === 'not_required'
              ? 'Não exigido (modo interno)'
              : data.data.subscription.paymentStatus === 'trial'
                ? 'Período de avaliação'
                : data.data.subscription.paymentStatus}
          </p>
          {data.data.subscription.trialEndsAt && (
            <p>
              Avaliação até {new Date(data.data.subscription.trialEndsAt).toLocaleString('pt-BR')}
            </p>
          )}
          {admin && (
            <div className="flex flex-wrap gap-3">
              {data.data.subscription.status === 'cancelled' ||
              data.data.subscription.status === 'trial_expired' ||
              data.data.subscription.status === 'past_due' ? (
                <button disabled={busy} onClick={() => void command('reactivate')}>
                  Reativar assinatura
                </button>
              ) : (
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() => {
                    if (
                      window.confirm(
                        'Cancelar a assinatura? Os limites do plano Essencial passam a valer e seus dados serão preservados.',
                      )
                    )
                      void command('cancel');
                  }}
                >
                  Cancelar assinatura
                </button>
              )}
            </div>
          )}
          <details>
            <summary>Histórico da assinatura</summary>
            {data.data.events.map((e) => (
              <p key={e.id}>
                {eventNames[e.type] || e.type} · {new Date(e.createdAt).toLocaleString('pt-BR')}
              </p>
            ))}
          </details>
        </section>
      )}
      {plans.isPending ? (
        <Skeleton />
      ) : plans.isError ? (
        <ErrorState retry={() => plans.refetch()} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {plans.data.map((p) => (
            <article className="card" key={p.id}>
              <h2>{p.name}</h2>
              <p>
                {p.limits.users} usuários · {p.limits.agents} agentes · {p.limits.workflows}{' '}
                workflows
              </p>
              <p>
                {p.limits.executions.toLocaleString('pt-BR')} execuções por mês ·{' '}
                {(p.limits.storage / 1024 / 1024).toLocaleString('pt-BR')} MiB
              </p>
              {admin && (
                <button
                  disabled={busy || !data.data || data.data.subscription.planId === p.id}
                  onClick={() => void command('change', p.id)}
                >
                  Selecionar {p.name}
                </button>
              )}
            </article>
          ))}
        </div>
      )}
      <Quotas />
    </>
  );
}
