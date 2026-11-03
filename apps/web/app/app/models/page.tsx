'use client';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../api-client';
type Runtime = {
  id: string;
  status: string;
  checkedAt: string | null;
  error: string | null;
  operations: { id: string; operation: string; status: string; error: string | null }[];
};
export default function ModelsPage() {
  const client = useQueryClient();
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const capabilities = useQuery({
    queryKey: ['runtime-capabilities'],
    queryFn: () =>
      apiRequest<{ defaultModel: string; providers: { id: string; configured: boolean }[] }>(
        '/runtimes/capabilities',
      ),
  });
  const runtimes = useQuery({
    queryKey: ['runtimes'],
    queryFn: () => apiRequest<Runtime[]>('/runtimes/status'),
    refetchInterval: 5000,
  });
  async function action(path: string) {
    setBusy(true);
    setError('');
    try {
      await apiRequest(path, { method: 'POST', body: {} });
      await client.invalidateQueries({ queryKey: ['runtimes'] });
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <span className="eyebrow">INTELIGÊNCIA DA COLMEIA</span>
      <h1>Modelos e ambientes</h1>
      {(error || capabilities.isError || runtimes.isError) && (
        <p role="alert">{error || 'Falha ao carregar configurações.'}</p>
      )}
      <div className="grid">
        <section className="card">
          <h2>Conexões de IA</h2>
          <p>Modelo inicial: {capabilities.data?.defaultModel || 'Carregando…'}</p>
          {capabilities.data?.providers.map((p) => (
            <p key={p.id}>
              <strong>{p.id}</strong> ·{' '}
              {p.configured ? 'Credencial configurada' : 'Aguardando credencial do administrador'}
            </p>
          ))}
          <p className="muted">
            As credenciais ficam no servidor. Uma conexão configurada precisa ser validada em uma
            execução.
          </p>
        </section>
        <section className="card">
          <h2>Ambiente dedicado</h2>
          <p>Um espaço isolado para suas abelhinhas OpenClaw.</p>
          <button disabled={busy} onClick={() => void action('/runtimes/provision')}>
            {busy ? 'Solicitando…' : 'Provisionar ou recuperar ambiente'}
          </button>
          <p className="muted">Requer infraestrutura configurada pelo administrador.</p>
        </section>
      </div>
      {runtimes.data?.map((r) => (
        <section className="card" key={r.id}>
          <h2>Ambiente {r.id.slice(0, 8)}</h2>
          <span className="pill">{r.status}</span>
          {r.checkedAt && <p>Verificado em {new Date(r.checkedAt).toLocaleString('pt-BR')}</p>}
          {r.error && <p role="alert">{r.error}</p>}
          {r.operations.map((o) => (
            <p key={o.id}>
              {o.operation.startsWith('deploy:') ? 'Publicação de agente' : o.operation} ·{' '}
              {o.status}
              {o.error && ` — ${o.error}`}
            </p>
          ))}
          {r.status !== 'DESTROYED' && (
            <button
              className="secondary"
              disabled={busy}
              onClick={() => {
                if (
                  window.confirm(
                    'Desativar este ambiente? As abelhinhas OpenClaw ficarão indisponíveis.',
                  )
                )
                  void action(`/runtimes/${r.id}/destroy`);
              }}
            >
              Desativar ambiente
            </button>
          )}
        </section>
      ))}
    </>
  );
}
