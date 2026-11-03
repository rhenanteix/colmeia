'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../api-client';
import { beeRoles } from '../bee-identity';
type Template = {
  id: string;
  name: string;
  category: string;
  description: string;
  config: { mascot?: string } & Record<string, unknown>;
};
export default function Templates() {
  const [busy, setBusy] = useState(''),
    [error, setError] = useState('');
  const query = useQuery({
    queryKey: ['templates'],
    queryFn: () => apiRequest<Template[]>('/templates'),
  });
  async function create(t: Template) {
    setBusy(t.id);
    try {
      const agent = await apiRequest<{ id: string }>('/agents', {
        method: 'POST',
        body: { name: t.name, description: t.description, templateId: t.id },
      });
      location.assign(`/app/agents/${agent.id}/builder`);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy('');
    }
  }
  return (
    <>
      <span className="eyebrow">UM BOM COMEÇO</span>
      <h1>Especialistas para sua colmeia</h1>
      <p className="muted">Escolha um ponto de partida e adapte as instruções à sua empresa.</p>
      {query.isPending && <p role="status">Carregando templates…</p>}
      {(query.isError || error) && (
        <p role="alert">{error || 'Não foi possível carregar o catálogo.'}</p>
      )}
      <div className="grid">
        {query.data?.map((t) => (
          <article className="card" key={t.id}>
            <img
              src={`/bees/${beeRoles.some((b) => b.key === t.config.mascot) ? t.config.mascot : 'rainha'}.png`}
              alt=""
              width="90"
              height="90"
            />
            <span className="pill">{t.category}</span>
            <h2>{t.name}</h2>
            <p className="muted">{t.description}</p>
            <button disabled={!!busy} onClick={() => create(t)}>
              {busy === t.id ? 'Criando…' : 'Usar template'}
            </button>
          </article>
        ))}
      </div>
      {query.data?.length === 0 && <p>Nenhum template disponível.</p>}
    </>
  );
}
