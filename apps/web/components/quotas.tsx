'use client';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../app/app/api-client';
import { Skeleton, ErrorState } from './ui/feedback';
const labels: Record<string, string> = {
  users: 'Usuários',
  agents: 'Agentes',
  workflows: 'Workflows',
  executions: 'Execuções no mês',
  storage: 'Armazenamento (bytes)',
  files: 'Arquivos',
  workspaces: 'Espaços de trabalho',
  integrations: 'Integrações',
};
export function Quotas() {
  const query = useQuery({
    queryKey: ['quotas'],
    queryFn: () =>
      apiRequest<{
        plan: string;
        quotas: {
          resource: string;
          used: number;
          limit: number;
          available: number;
          percent: number;
          alert: string | null;
        }[];
      }>('/billing/quotas'),
    refetchInterval: 5000,
  });
  if (query.isPending) return <Skeleton />;
  if (query.isError) return <ErrorState retry={() => query.refetch()} />;
  return (
    <section>
      <h2>Quotas do plano {query.data.plan}</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {query.data.quotas.map((q) => (
          <article className="card min-w-0" key={q.resource}>
            <h3>{labels[q.resource]}</h3>
            <p>
              {q.used.toLocaleString('pt-BR')} de {q.limit.toLocaleString('pt-BR')} · {q.percent}%
            </p>
            <progress
              className="w-full"
              aria-label={`Consumo de ${labels[q.resource]}`}
              value={q.used}
              max={q.limit}
            />
            <p>Disponível: {q.available.toLocaleString('pt-BR')}</p>
            {q.alert && (
              <p role="status">{q.alert === 'limit' ? 'Limite atingido' : 'Próximo do limite'}</p>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
