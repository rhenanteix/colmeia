'use client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import type { Config, TextConfigKey, UpdateConfig } from '../types';
import { beeRoles } from '../../../app/app/bee-identity';
export function BuilderFields({
  config,
  step,
  ready,
  busy,
  update,
  save,
}: {
  config: Config;
  step: number;
  ready: boolean;
  busy: boolean;
  update: UpdateConfig;
  save: (version?: boolean) => Promise<void>;
}) {
  const field = (key: TextConfigKey, label: string, multiline = false) => (
    <label>
      {label}
      {multiline ? (
        <Textarea
          rows={5}
          value={config[key] || ''}
          onChange={(e) => update(key, e.target.value)}
        />
      ) : (
        <Input value={config[key] || ''} onChange={(e) => update(key, e.target.value)} />
      )}
    </label>
  );
  return (
    <fieldset disabled={!ready || busy} className="builder-fields">
      {step === 0 && (
        <>
          {field('name', 'Nome da abelhinha')}
          {field('description', 'Descrição')}
          <p className="muted">Escolha a identidade visual da sua especialista.</p>
          <div className="mascot-picker">
            {beeRoles.map((b) => (
              <Button
                key={b.key}
                className={config.mascot === b.key ? 'selected-mascot' : 'secondary'}
                aria-pressed={config.mascot === b.key}
                onClick={() => update('mascot', b.key)}
              >
                <img src={`/bees/${b.key}.png`} width="56" height="56" alt="" />
                <span>{b.name}</span>
              </Button>
            ))}
          </div>
          {field('objective', 'Especialidade e objetivo')}
        </>
      )}
      {step === 1 && (
        <>
          {field('instructions', 'Instruções de atuação', true)}
          {field('tone', 'Tom de voz')}
          {field('restrictions', 'Restrições e regras', true)}
        </>
      )}
      {step === 2 && (
        <>
          <label>
            Modo de execução
            <select value={config.engine} onChange={(e) => update('engine', e.target.value)}>
              <option value="mastra">Assistente empresarial (recomendado)</option>
              <option value="ai-sdk">Conversa direta</option>
              <option value="openclaw">Ambiente dedicado (OpenClaw)</option>
            </select>
          </label>
          <label>
            Provedor
            <select value={config.provider} onChange={(e) => update('provider', e.target.value)}>
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
            </select>
          </label>
          {field('model', 'Identificador do modelo')}
          <label>
            Variação desejada das respostas (0 a 2)
            <Input
              type="number"
              min={0}
              max={2}
              step={0.1}
              value={config.temperature ?? 0.5}
              onChange={(e) => update('temperature', Number(e.target.value))}
            />
          </label>
          <label>
            Limite de tokens por resposta
            <Input
              type="number"
              min={1}
              max={16384}
              step={1}
              value={config.maxOutputTokens ?? 2048}
              onChange={(e) => update('maxOutputTokens', Number(e.target.value))}
            />
          </label>
          <label>
            Limite de execuções por mês
            <Input
              type="number"
              min={1}
              max={1000000}
              step={1}
              value={config.monthlyExecutionLimit ?? 1000}
              onChange={(e) => update('monthlyExecutionLimit', Number(e.target.value))}
            />
          </label>
          <p className="muted">
            Limites e parâmetros desejados. Sua compatibilidade e aplicação serão verificadas quando
            o runtime estiver conectado.
          </p>
          <p className="muted">
            A configuração será salva. Conexão, credenciais e execução ainda dependem do runtime.
          </p>
        </>
      )}
      {step === 3 && (
        <>
          {field('context', 'Conhecimento e contexto do negócio', true)}
          <p className="muted">
            Upload e indexação de documentos ainda indisponíveis. Nenhum documento será ingerido
            nesta etapa.
          </p>
        </>
      )}
      {step === 4 && (
        <>
          <h3>Ferramentas com acesso controlado</h3>
          {[
            ['date_time', 'Data e hora'],
            ['calculator', 'Calculadora'],
            ['organization_info', 'Nome da organização'],
            ['agent_info', 'Identidade do agente'],
          ].map(([key, label]) => (
            <label key={key}>
              <input
                type="checkbox"
                checked={config.tools.includes(key)}
                onChange={(e) =>
                  update(
                    'tools',
                    e.target.checked
                      ? [...config.tools, key]
                      : config.tools.filter((t) => t !== key),
                  )
                }
              />{' '}
              {label}
            </label>
          ))}
          <label htmlFor="approval-required">
            Exigir aprovação humana antes de operações externas
          </label>
          <Switch
            id="approval-required"
            checked={config.approvalRequired ?? true}
            onCheckedChange={(value) => update('approvalRequired', value)}
          />
          <p className="muted">
            Política salva para integrações futuras. Nenhuma ferramenta recebe acesso por alterar
            esta opção.
          </p>
          <p className="muted">
            Apenas as ferramentas selecionadas são habilitadas no servidor. Ferramentas com efeitos
            externos permanecem indisponíveis.
          </p>
        </>
      )}
      {step === 5 && (
        <>
          {field('changeSummary', 'Resumo desta versão')}
          <dl>
            <dt>Objetivo</dt>
            <dd>{config.objective || 'Não informado'}</dd>
            <dt>Modelo</dt>
            <dd>
              {config.provider} · {config.model || 'Pendente'}
            </dd>
            <dt>Instruções</dt>
            <dd className="preserve-text">{config.instructions || 'Pendente'}</dd>
            <dt>Tom</dt>
            <dd>{config.tone}</dd>
            <dt>Restrições</dt>
            <dd>{config.restrictions || 'Não informadas'}</dd>
            <dt>Limites desejados</dt>
            <dd>
              {config.maxOutputTokens ?? 2048} tokens por resposta ·{' '}
              {config.monthlyExecutionLimit ?? 1000} execuções por mês
            </dd>
            <dt>Aprovação humana</dt>
            <dd>
              {config.approvalRequired !== false ? 'Obrigatória' : 'Não solicitada na configuração'}
            </dd>
            <dt>Contexto</dt>
            <dd>{config.context || 'Não informado'}</dd>
          </dl>
          <Button
            onClick={() => save(true)}
            disabled={config.instructions.trim().length < 10 || !config.model.trim()}
          >
            Salvar e criar versão
          </Button>
          <p className="muted">
            Publique a versão pelo histórico após configurar as credenciais no servidor. Criar uma
            versão não inicia a execução.
          </p>
        </>
      )}
    </fieldset>
  );
}
