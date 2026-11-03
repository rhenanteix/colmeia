'use client';
import { useEffect, useState } from 'react';
import { getJson, postJson } from '../app/api-client';
const steps = [
  'Workspace',
  'Contexto',
  'Agentes',
  'Computador',
  'Inteligência artificial',
  'Ferramentas',
  'Equipe',
  'Finalizar',
];
export default function Onboarding() {
  const [step, S] = useState(0),
    [context, C] = useState(''),
    [error, E] = useState('');
  const token = () => '';
  useEffect(() => {
    getJson<{ step: number; context?: { description?: string } } | null>('/onboarding', token())
      .then((d) => {
        if (d) {
          S(d.step);
          C(d.context?.description || '');
        }
      })
      .catch((e) => E(String(e)));
  }, []);
  async function next() {
    try {
      const n = Math.min(8, step + 1);
      await postJson('/onboarding', token(), { step: n, context: { description: context } });
      S(n);
      if (n === 8) location.href = '/app';
    } catch (e) {
      E(String(e));
    }
  }
  return (
    <main className="onboarding-page">
      <div className="brand">⬡ Colmeia</div>
      <p className="muted">Configuração inicial · {Math.min(step + 1, 8)} de 8</p>
      <progress
        className="onboarding-progress"
        value={Math.min(step + 1, 8)}
        max={8}
        aria-label="Progresso da configuração"
      />
      <div className="card">
        <h1>{steps[Math.min(step, 7)]}</h1>
        <p>
          {
            [
              'Configure sua organização',
              'Descreva o negócio e os objetivos dos agentes',
              'Crie seus agentes no Agent Builder',
              'Computador virtual: recurso futuro, pode avançar',
              'Configure modelos na central de IA após o onboarding',
              'Conecte ferramentas quando disponíveis',
              'Convide seus colegas pela área Equipe',
              'Seu workspace está pronto',
            ][Math.min(step, 7)]
          }
        </p>
        {step === 1 && (
          <textarea
            aria-label="Sobre sua empresa"
            value={context}
            onChange={(e) => C(e.target.value)}
            placeholder="Sobre sua empresa"
          />
        )}
        {error && <p role="alert">{error}</p>}
        <div className="row" style={{ marginTop: 20 }}>
          <button onClick={next}>{step >= 7 ? 'Finalizar' : 'Continuar'}</button>
          <button className="secondary" onClick={() => (location.href = '/app')}>
            Ir ao workspace
          </button>
        </div>
      </div>
    </main>
  );
}
