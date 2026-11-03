'use client';
import { Stepper } from '@/components/ui/stepper';
import { useEffect, useState, useCallback, use } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../../api-client';
import { beeRoles } from '../../../bee-identity';
import type { Config, Draft, Version } from '../../../../../features/agent-builder/types';
import { BuilderFields } from '../../../../../features/agent-builder/components/builder-fields';
const empty: Config = {
  temperature: 0.5,
  maxOutputTokens: 2048,
  monthlyExecutionLimit: 1000,
  approvalRequired: true,
  instructions: '',
  provider: 'openai',
  model: 'gpt-4.1-mini',
  engine: 'mastra',
  tools: [],
  mascot: 'rainha',
  objective: '',
  tone: 'Profissional e acolhedor',
  restrictions: '',
  context: '',
};
const steps = [
  'Identidade',
  'Papel e personalidade',
  'Inteligência',
  'Conhecimento',
  'Ferramentas',
  'Revisão',
];
export default function Builder({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <BuilderEditor key={id} id={id} />;
}
function BuilderEditor({ id }: { id: string }) {
  const client = useQueryClient();
  const [config, setConfig] = useState<Config>(empty),
    [revision, setRevision] = useState(0),
    [step, setStep] = useState(0),
    [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [ready, setReady] = useState(false);
  const agent = useQuery({
    queryKey: ['agent', id],
    queryFn: () => apiRequest<{ name: string; description: string }>(`/agents/${id}`),
  });
  const history = useQuery({
    queryKey: ['versions', id],
    queryFn: () => apiRequest<Version[]>(`/builder/${id}/versions`),
  });
  useEffect(() => {
    let active = true;
    Promise.all([
      apiRequest<Draft | null>(`/builder/${id}`),
      client.ensureQueryData({
        queryKey: ['agent', id],
        queryFn: () => apiRequest<{ name: string; description: string }>(`/agents/${id}`),
      }),
    ])
      .then(([d, identity]) => {
        if (active) {
          setConfig({
            ...empty,
            name: identity.name,
            description: identity.description || '',
            ...d?.config,
          });
          setRevision(d?.revision ?? 0);
          setReady(true);
        }
      })
      .catch((e) => setError(String(e)));
    return () => {
      active = false;
    };
  }, [id, client]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    const navigate = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest('a[href]') : null;
      if (target && !window.confirm('Há alterações não salvas. Deseja sair sem salvar?')) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    document.addEventListener('click', navigate, true);
    window.addEventListener('beforeunload', warn);
    return () => {
      window.removeEventListener('beforeunload', warn);
      document.removeEventListener('click', navigate, true);
    };
  }, [dirty]);
  function update<K extends keyof Config>(key: K, value: Config[K]) {
    setConfig((c) => ({ ...c, [key]: value }));
    setDirty(true);
    setNotice('');
    setError('');
  }
  const save = useCallback(
    async (version = false) => {
      if (busy || !ready) return;
      setBusy(true);
      setError('');
      try {
        const draft = await apiRequest<Draft>(`/builder/${id}`, {
          method: 'POST',
          body: { config, revision },
        });
        setRevision(draft.revision);
        setDirty(false);
        if (version) {
          const result = await apiRequest<{ revision: number }>(`/builder/${id}/versions`, {
            method: 'POST',
            body: { config, revision: draft.revision },
          });
          setRevision(result.revision);
          await client.invalidateQueries({ queryKey: ['versions', id] });
        }
        setNotice(
          version
            ? 'Versão imutável criada. Ainda não implantada.'
            : 'Rascunho salvo com segurança.',
        );
        await client.invalidateQueries({ queryKey: ['dashboard'] });
      } catch (e) {
        setError(String(e));
      } finally {
        setBusy(false);
      }
    },
    [busy, ready, config, revision, id, client],
  );
  useEffect(() => {
    if (!dirty || busy || !ready || error) return;
    const timer = setTimeout(() => {
      void save();
    }, 1500);
    return () => clearTimeout(timer);
  }, [dirty, busy, ready, error, save]);
  return (
    <>
      <div className="section-heading">
        <div>
          <span className="eyebrow">AGENT BUILDER</span>
          <h1>{agent.data?.name || 'Sua abelhinha'}</h1>
        </div>
        <span className="pill">
          {dirty ? 'Alterações não salvas' : ready ? 'Rascunho' : 'Carregando…'}
        </span>
      </div>
      {error && (
        <div className="card" role="alert">
          {error}
          <p>Em caso de conflito, copie suas alterações antes de recarregar esta página.</p>
        </div>
      )}
      <div className="builder-layout">
        <Stepper steps={steps} current={step} onChange={setStep} disabled={busy} />
        <section className="card">
          <h2>{steps[step]}</h2>
          <BuilderFields
            config={config}
            step={step}
            ready={ready}
            busy={busy}
            update={update}
            save={save}
          />
          <div className="builder-footer">
            <button
              className="secondary"
              disabled={step === 0 || busy}
              onClick={() => setStep((s) => s - 1)}
            >
              Voltar
            </button>
            <button disabled={!ready || busy} onClick={() => save()}>
              {busy ? 'Salvando…' : 'Salvar rascunho'}
            </button>
            {step < 5 && <button onClick={() => setStep((s) => s + 1)}>Continuar</button>}
          </div>
          {notice && <p role="status">{notice}</p>}
        </section>
        <aside className="card builder-preview">
          <img
            src={`/bees/${beeRoles.some((b) => b.key === config.mascot) ? config.mascot : 'rainha'}.png`}
            width="140"
            height="140"
            alt="Prévia da abelhinha"
          />
          <h2>{agent.data?.name}</h2>
          <p className="muted">{config.objective || 'Sua próxima especialista'}</p>
          <span className="pill">Revisão {revision}</span>
          <h3>Histórico</h3>
          {history.isError ? (
            <p role="alert">Falha ao carregar versões.</p>
          ) : history.data?.length ? (
            history.data.map((v) => (
              <details key={v.id}>
                <summary>Versão {v.version}</summary>
                <p>{v.config.changeSummary || 'Sem resumo de alterações.'}</p>
                <details>
                  <summary>Comparar com o rascunho atual</summary>
                  <ul>
                    {(
                      [
                        'name',
                        'description',
                        'mascot',
                        'objective',
                        'instructions',
                        'tone',
                        'restrictions',
                        'provider',
                        'model',
                        'context',
                      ] as (keyof Config)[]
                    )
                      .filter(
                        (key) => v.config[key as keyof Config] !== config[key as keyof Config],
                      )
                      .map((key) => (
                        <li key={key}>
                          <strong>{key}</strong>:{' '}
                          {String(v.config[key as keyof Config] ?? 'Não informado')} →{' '}
                          {String(config[key as keyof Config] ?? 'Não informado')}
                        </li>
                      ))}
                  </ul>
                </details>
                <p className="muted">
                  {new Date(v.createdAt).toLocaleString('pt-BR')} · Autor:{' '}
                  {v.authorSubject?.slice(0, 8) || 'Legado'}
                </p>
                <p className="preserve-text">{v.config.instructions}</p>
                <button
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    setError('');
                    try {
                      const result = await apiRequest<{ status: string }>(`/agents/${id}/publish`, {
                        method: 'POST',
                        body: { versionId: v.id },
                      });
                      setNotice(
                        result.status === 'PENDING'
                          ? 'Implantação solicitada. Acompanhe em Modelos de IA.'
                          : `Versão ${v.version} publicada.`,
                      );
                      await client.invalidateQueries({ queryKey: ['agents'] });
                    } catch (e) {
                      setError(String(e));
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Publicar versão {v.version}
                </button>
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() => {
                    if (!dirty || window.confirm('Substituir alterações locais por esta versão?')) {
                      setConfig({ ...empty, ...v.config });
                      setDirty(true);
                      setNotice('Versão restaurada localmente. Salve como novo rascunho.');
                    }
                  }}
                >
                  Restaurar em rascunho
                </button>
              </details>
            ))
          ) : (
            <p className="muted">Nenhuma versão criada.</p>
          )}
        </aside>
      </div>
    </>
  );
}
