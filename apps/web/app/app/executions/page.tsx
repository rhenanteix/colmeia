'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../api-client';
type Execution = {
  id: string;
  agent: { name: string };
  status: string;
  engine: string;
  model: string;
  createdAt: string;
  inputTokens: number;
  outputTokens: number;
  error: string | null;
};
export default function Executions() {
  const [id, setId] = useState('');
  const list = useQuery({
    queryKey: ['executions'],
    queryFn: () => apiRequest<Execution[]>('/executions'),
    refetchInterval: 5000,
  });
  const detail = useQuery({
    queryKey: ['execution', id],
    queryFn: () =>
      apiRequest<{ events: { id: string; type: string; payload: unknown }[] }>(`/executions/${id}`),
    enabled: Boolean(id),
  });
  return (
    <>
      <span className="eyebrow">ATIVIDADE REAL</span>
      <h1>Execuções</h1>
      {list.isPending && <p role="status">Carregando…</p>}
      {list.isError && <p role="alert">Falha ao carregar execuções.</p>}
      {list.data?.length === 0 && (
        <div className="card">
          <h2>Ainda não há execuções</h2>
          <p>Publique uma abelhinha e envie uma mensagem para acompanhar os resultados aqui.</p>
        </div>
      )}
      {list.data?.map((e) => (
        <article className="card" key={e.id}>
          <h2>{e.agent.name}</h2>
          <p>
            {e.status} · {e.engine} · {e.model}
          </p>
          <p>
            {new Date(e.createdAt).toLocaleString('pt-BR')} · {e.inputTokens + e.outputTokens}{' '}
            tokens
          </p>
          {e.error && <p role="alert">{e.error}</p>}
          <button className="secondary" onClick={() => setId(e.id)}>
            Ver eventos
          </button>
          {id === e.id &&
            (detail.isError ? (
              <p role="alert">Falha ao carregar eventos.</p>
            ) : (
              detail.data?.events.map((event) => (
                <details key={event.id}>
                  <summary>{event.type}</summary>
                  <pre>{JSON.stringify(event.payload, null, 2)}</pre>
                </details>
              ))
            ))}
        </article>
      ))}
    </>
  );
}
