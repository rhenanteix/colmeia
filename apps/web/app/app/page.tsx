'use client';
import { motion, useReducedMotion } from 'motion/react';
import { Skeleton, ErrorState } from '../../components/ui/feedback';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from './api-client';
import { BeeScene } from '../../components/brand/bee-scene';
import { beeFor } from './bee-identity';
type Dashboard = {
  organization: { name: string };
  stats: {
    total: number;
    drafts: number;
    active: number;
    members: number;
    executions: number;
    failures: number;
  };
  agents: {
    id: string;
    name: string;
    description: string | null;
    status: string;
    mascot: string;
  }[];
  activity: { id: string; action: string; createdAt: string }[];
};
const labels: Record<string, string> = {
  'agent.created': 'Abelhinha criada',
  'agent.draft.saved': 'Rascunho salvo',
  'agent.version.created': 'Versão criada',
  'team.invited': 'Convite enviado',
  'organization.updated': 'Organização atualizada',
  'organization.created': 'Organização criada',
};
export default function Dashboard() {
  const reducedMotion = useReducedMotion();
  const query = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => apiRequest<Dashboard>('/dashboard'),
  });
  if (query.isPending) return <Skeleton label="Preparando sua colmeia…" />;
  if (query.isError)
    return (
      <ErrorState title="Não foi possível carregar sua colmeia" retry={() => query.refetch()} />
    );
  const d = query.data;
  return (
    <motion.div
      initial={{ opacity: reducedMotion ? 1 : 0 }}
      animate={{ opacity: 1 }}
      className="dashboard"
    >
      <div className="dashboard-hero">
        <div>
          <span className="eyebrow">SEU WORKSPACE · {d.organization.name}</span>
          <h1>
            Boas ideias.
            <br />
            <span>Uma colmeia inteira.</span>
          </h1>
          <p>
            Organize especialistas, dê forma às suas ideias e construa o próximo passo com sua
            equipe.
          </p>
          <Link className="honey-button" href="/app/agents">
            Criar abelhinha ↗
          </Link>
        </div>
        <BeeScene compact />
      </div>
      <div className="grid stats">
        {[
          ['Abelhinhas', d.stats.total],
          ['Em rascunho', d.stats.drafts],
          ['Agentes publicados', d.stats.active],
          ['Pessoas na equipe', d.stats.members],
          ['Execuções', d.stats.executions],
          ['Execuções com erro', d.stats.failures],
        ].map(([label, value]) => (
          <div className="card" key={label}>
            <span className="muted">{label}</span>
            <strong className="stat-value">{value}</strong>
          </div>
        ))}
      </div>
      <div className="section-heading">
        <h2>Minhas abelhinhas</h2>
        <Link href="/app/agents">Ver todas ↗</Link>
      </div>
      {d.agents.length ? (
        <div className="grid">
          {d.agents.map((a) => (
            <Link className="card agent-summary" key={a.id} href={`/app/agents/${a.id}/builder`}>
              <img src={`/bees/${a.mascot || beeFor(a.name)}.png`} width="64" height="64" alt="" />
              <span className="pill">
                {a.status === 'DRAFT'
                  ? 'Rascunho'
                  : a.status === 'ACTIVE'
                    ? 'Publicado'
                    : a.status === 'ARCHIVED'
                      ? 'Arquivado'
                      : 'Suspenso'}
              </span>
              <h3>{a.name}</h3>
              <p className="muted">{a.description || 'Pronta para ganhar uma especialidade.'}</p>
            </Link>
          ))}
        </div>
      ) : (
        <div className="card">
          <h3>Sua primeira especialista começa aqui</h3>
          <p className="muted">Escolha uma abelhinha e configure seu papel.</p>
          <Link className="honey-button" href="/app/agents">
            Criar primeiro agente
          </Link>
        </div>
      )}
      <div className="dashboard-actions">
        <section className="card">
          <span className="eyebrow">O QUE ACONTECEU</span>
          <h2>Atividade recente</h2>
          {d.activity.length ? (
            <ul className="activity-list">
              {d.activity.map((e) => (
                <li key={e.id}>
                  <span>{labels[e.action] || e.action}</span>
                  <time dateTime={e.createdAt}>
                    {new Date(e.createdAt).toLocaleString('pt-BR')}
                  </time>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">As atividades da equipe aparecerão aqui.</p>
          )}
        </section>
        <section className="card">
          <span className="eyebrow">PRÓXIMOS PASSOS</span>
          <h2>Faça sua colmeia crescer</h2>
          <p>
            <Link href="/app/agents">
              {d.stats.total ? '✓' : '1.'} Criar sua primeira abelhinha ↗
            </Link>
          </p>
          <p>
            <Link href="/app/team">{d.stats.members > 1 ? '✓' : '2.'} Convidar sua equipe ↗</Link>
          </p>
          <p>
            <Link href="/app/settings">3. Configurar sua organização ↗</Link>
          </p>
          <p className="muted">Execução de agentes depende da integração com o runtime.</p>
        </section>
      </div>
    </motion.div>
  );
}
