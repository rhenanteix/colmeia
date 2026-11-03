'use client';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../api-client';
import { Quotas } from '../../../components/quotas';
import { Skeleton, ErrorState } from '../../../components/ui/feedback';
type Usage = {
  events: number;
  inputTokens: number;
  outputTokens: number;
  costMicros: string;
  operational: {
    tasks: number;
    archivedTasks: number;
    workflows: number;
    executions: number;
    files: number;
    storageBytes: number;
    wikiPages: number;
    executionStates: { status: string; count: number }[];
  };
  agents: {
    id: string;
    name: string;
    aiEvents: number;
    inputTokens: number;
    outputTokens: number;
    costMicros: string;
    files: number;
    storageBytes: number;
    wikiPages: number;
  }[];
  history: { id: string; action: string; createdAt: string; resourceId: string | null }[];
};
const names: Record<string, string> = {
  'task.created': 'Tarefa criada',
  'task.moved': 'Tarefa movimentada',
  'file.uploaded': 'Arquivo enviado',
  'file.deleted': 'Arquivo excluído',
  'wiki.updated': 'Wiki atualizada',
  'workflow.completed': 'Workflow concluído',
  'workflow.cancelled': 'Workflow cancelado',
  'workflow.schedule.blocked': 'Agendamento bloqueado',
  'approval.approved': 'Solicitação aprovada',
  'approval.rejected': 'Solicitação rejeitada',
};
const states: Record<string, string> = {
  queued: 'Na fila',
  waiting: 'Em espera',
  approval: 'Aguardando aprovação',
  completed: 'Concluídas',
  failed: 'Falharam',
  cancelled: 'Canceladas',
};
export default function UsagePage() {
  const query = useQuery({
    queryKey: ['usage'],
    queryFn: () => apiRequest<Usage>('/usage/summary'),
    refetchInterval: 5000,
  });
  return (
    <>
      <h1>Consumo</h1>
      <p className="muted">
        Dados persistidos da organização ativa. Atualização a cada cinco segundos.
      </p>
      {query.isPending ? (
        <Skeleton />
      ) : query.isError ? (
        <ErrorState retry={() => query.refetch()} />
      ) : (
        <>
          <h2>Consumo operacional</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ['Tarefas ativas', query.data.operational.tasks],
              ['Tarefas arquivadas', query.data.operational.archivedTasks],
              ['Workflows', query.data.operational.workflows],
              ['Execuções de workflows', query.data.operational.executions],
              ['Arquivos', query.data.operational.files],
              ['Armazenamento em bytes', query.data.operational.storageBytes],
              ['Páginas Wiki', query.data.operational.wikiPages],
            ].map(([label, value]) => (
              <article className="card" key={String(label)}>
                <h3>{label}</h3>
                <p>{Number(value).toLocaleString('pt-BR')}</p>
              </article>
            ))}
          </div>
          <div className="card my-3">
            <h3>Estado das execuções</h3>
            {query.data.operational.executionStates.length ? (
              query.data.operational.executionStates.map((s) => (
                <p key={s.status}>
                  {states[s.status] || s.status}: {s.count}
                </p>
              ))
            ) : (
              <p>Nenhuma execução registrada.</p>
            )}
          </div>
          <h2>Consumo de IA</h2>
          <div className="card">
            {query.data.events ? (
              <>
                <p>{query.data.events} medições registradas</p>
                <p>
                  Tokens de entrada: {query.data.inputTokens.toLocaleString('pt-BR')} · Tokens de
                  saída: {query.data.outputTokens.toLocaleString('pt-BR')}
                </p>
                <p>Custo registrado em micros: {query.data.costMicros}</p>
              </>
            ) : (
              <p>Ainda não há medições de IA. Nenhum token ou custo foi estimado.</p>
            )}
          </div>
          <h2>Consumo por agente</h2>
          {query.data.agents.length ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {query.data.agents.map((a) => (
                <article className="card" key={a.id}>
                  <h3>{a.name}</h3>
                  <p>
                    {a.files} arquivos · {a.storageBytes.toLocaleString('pt-BR')} bytes ·{' '}
                    {a.wikiPages} páginas Wiki
                  </p>
                  {a.aiEvents ? (
                    <p>
                      {a.inputTokens.toLocaleString('pt-BR')} tokens de entrada ·{' '}
                      {a.outputTokens.toLocaleString('pt-BR')} de saída · {a.costMicros} micros
                      registrados
                    </p>
                  ) : (
                    <p>Sem medições de IA para este agente.</p>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <p>Nenhum agente cadastrado.</p>
          )}
          <h2>Histórico de utilização</h2>
          <p className="muted">Últimos 100 eventos operacionais dos últimos 30 dias.</p>
          {query.data.history.length ? (
            <ol className="card">
              {query.data.history.map((h) => (
                <li key={h.id}>
                  {names[h.action] || h.action} · {new Date(h.createdAt).toLocaleString('pt-BR')}
                </li>
              ))}
            </ol>
          ) : (
            <p>Nenhum evento operacional no período.</p>
          )}
        </>
      )}
      <Quotas />
    </>
  );
}
