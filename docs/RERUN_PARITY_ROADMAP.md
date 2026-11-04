# Roteiro de paridade funcional com Rerun AI coworkers

> Documento de diagnóstico e roadmap. Não representa a implementação das funcionalidades listadas. A classificação abaixo separa evidência de código, documentação e homologação externa.
>
> Referências comparadas: [Colmeia](https://github.com/rhenanteix/colmeia) e [Rerun AI coworkers](https://github.com/rerun-build/rerun). Este documento descreve capacidades de produto; não propõe copiar código, marca, textos ou identidade visual do Rerun.

## Resumo executivo

O Colmeia já possui uma fundação de plataforma empresarial multiagente: autenticação e organizações, builder e versões de agentes, conversas com streaming, execução via adapters, colaboração entre agentes, tarefas, workflows e documentos descritos no repositório. O Rerun oferece uma experiência mais completa de “colegas de trabalho” autônomos: um Foreman que interpreta pedidos, agentes com memória e skills próprias, ferramentas e conexões, trabalho agendado, aprovações que pausam e retomam execuções e um board para acompanhar a equipe.

A maior distância não está em trocar Next.js/NestJS/PostgreSQL por outra stack. Está em completar e comprovar os fluxos operacionais de agentes: configuração → publicação real → execução com ferramentas → memória/skills → automação → aprovação e retomada → monitoramento e recuperação.

**Recomendação:** primeiro reconciliar os relatórios contraditórios do Colmeia e homologar um ciclo completo com runtime real. Depois avançar por fatias verticais, começando com uma ferramenta real e segura. Deixar o browser/computer virtual para uma fase posterior, condicionada à demanda.

## Como interpretar o diagnóstico

- **Existe:** há evidência direta em código ou nos documentos atuais consultados.
- **Parcial / verificar:** existem componentes ou relatos de implementação, mas a evidência disponível não comprova o fluxo completo nem sua homologação atual.
- **Gap evidenciado:** a documentação ou o código consultado registra ausência ou limitação concreta.
- **Não confirmado:** não foi possível concluir com as evidências consultadas; não significa necessariamente que inexista código.

O próprio Colmeia registra resultados diferentes entre documentos de estado. Assim, itens contraditórios ficam como **“revalidar”**, em vez de serem declarados ausentes ou prontos.

## Matriz dos 10 temas

| # | Tema | Evidência no Colmeia | Comparação com Rerun | Estado para paridade | Prioridade sugerida |
|---|---|---|---|---|---|
| 1 | Delegação em linguagem natural | Existem conversas, builder, agentes, tarefas e colaboração. O material consultado não comprova um fluxo de pedido livre que produza plano e inicie trabalho com aprovação. | O README do Rerun descreve o Foreman entrevistando o usuário, planejando equipe e construindo os coworkers. | Gap funcional a investigar/implementar. | P2 |
| 2 | Orquestrador de agentes | `apps/api/src/modules/bee-teams/` e `BeeExecutor` são a base de colaboração. `docs/SPRINT_7_READINESS.md` descreve coordenação/Rainha como proposta futura e registra `CoordinationSession` ausente naquele diagnóstico. | O Foreman e as ferramentas de delegação/chamada entre agentes são parte central do produto Rerun. | Parcial; não há evidência de orquestração completa comprovada. | P2 |
| 3 | Ciclo completo do agente | `apps/api/src/modules/runtime/runtime.service.ts` registra adapters Mastra, AI SDK e OpenClaw e publicação baseada em versão. `apps/api/src/modules/conversations/conversations.service.ts` persiste execução, eventos, streaming, cancelamento e uso. | O Rerun engine integra configuração, execução, CLI, reconciliação e monitoramento operacional. | Base existente; publicação/runtime real precisam homologação. | P0 |
| 4 | Skills | O builder guarda instruções e versões; não foi comprovado um sistema de skills carregadas sob demanda equivalente ao Rerun. | O Rerun documenta `SKILL.md`, referências, carregamento por relevância e edição via app/API. | Gap não confirmado por auditoria completa; validar e depois implementar se ausente. | P2 |
| 5 | Memória e conhecimento | Existem documentos/Wiki descritos na Sprint 6.1. `IMPLEMENTATION_STATE.md` registra RAG indisponível. `docs/AGENT_BUILDER.md` descreve upload/RAG como indisponível no diagnóstico daquela versão. | O engine Rerun mantém memória por agente, busca textual/semântica e dados por coworker/workspace. | Gap concreto em memória/RAG segundo os documentos consultados; status atual deve ser revalidado. | P1 |
| 6 | Ferramentas, integrações e MCP | `apps/api/src/modules/runtime/tools.ts` consultado define `date_time`, `calculator`, `organization_info` e `agent_info`. `apps/api/src/modules/runtime/openclaw.adapter.ts` recusa configuração com ferramentas. A auditoria marca OAuth/conectores genéricos como ausentes. | Rerun documenta catálogo de serviços/apps, MCP e Composio, com conexão por coworker. | Gap importante evidenciado; integração OpenClaw e conectores reais exigem validação. | P1 |
| 7 | Agendamentos, webhooks e automações de agente | O README e `docs/SPRINT_6_1_IMPLEMENTATION.md` descrevem workflows com webhooks/agendamento. `docs/SPRINT_6_BLOCKERS.md` os registra como ausentes em outra auditoria. Não foi comprovado aqui que schedules e triggers iniciem execuções autônomas de agente no mesmo sentido do Rerun. | O Rerun tem schedules e webhook triggers próprios do agente, com novas sessões e histórico de execução. | Revalidar workflow existente e identificar especificamente o gap de automação de agente. | P1 |
| 8 | Aprovação humana e retomada | Há `ApprovalRequest` e fluxos descritos na Sprint 6.1. `docs/SPRINT_6_AUDIT.md` e `docs/SPRINT_7_READINESS.md` registram integração de aprovação com execução/retomada como parcial ou pendente. | Rerun pausa o run, notifica, recebe decisão e continua ou termina a execução. | Parcial; comprovar pausa real antes de qualquer efeito e retomada após a decisão. | P1 |
| 9 | Board e monitoramento | Colmeia tem dashboard, páginas de agentes, conversas, execuções, canais e tarefas. O relatório de Sprint 6 diz que dashboard/uso têm ressalvas e métricas/filtros incompletos. | Rerun oferece board de coworkers, Boxes e tarefas, mais Monitoring/Logs. | Base de UI existe; agregar estado do agente, tarefas, execução e aprovações em uma visão operacional. | P2 |
| 10 | Runtime, segurança, deploy e operação | Existem NestJS, PostgreSQL/Prisma, Redis/BullMQ, worker e documentação OpenClaw. Os relatórios registram homologação real, crash recovery, backup/restauração, métricas e operação multi-réplica como pendências ou ressalvas. | Rerun separa app e engine, fornece CLI, migrations do data-dir, health/doctor, pairing e Docker Compose. | Arquitetura Colmeia é apropriada à sua stack; fechar gaps de confiabilidade e comprovar deploy. | P0 |

## Diagnóstico detalhado e critérios de aceite

### 1. Experiência de delegação em linguagem natural

**Já existe:** conversas com agentes e superfícies de tarefas/workflows aparecem no produto.

**Falta ou não foi comprovado:** fluxo de entrada de uma solicitação geral que esclareça requisitos, gere um plano visível, selecione capacidades/agentes e conduza a execução com acompanhamento.

**Fatia recomendada:** criar uma proposta de plano sem efeitos externos. Permitir confirmar, editar ou cancelar; a execução posterior deve ter um ID de correlação.

**Aceite:** pedido → plano revisável → confirmação explícita → tarefas/execuções rastreáveis. Reenvio do mesmo pedido não deve iniciar ações duplicadas.

### 2. Orquestrador (Foreman/Rainha)

**Já existe:** colaboração/handoff entre agentes e contratos de runtime/eventos. `docs/SPRINT_7_READINESS.md` descreve a política de roteamento da Rainha como proposta, incluindo agente elegível, carga e desempate estável.

**Falta ou não foi comprovado:** planejamento e coordenação autônoma ponta a ponta, atribuição tipada a agentes, dependências e proteção completa contra loops.

**Fatia recomendada:** começar com roteamento determinístico para um conjunto pequeno de capacidades; usar o modelo para interpretar/planear, mas deixar a autorização no backend.

**Aceite:** plano multi-etapas com responsável, resultado e estado; nenhuma tarefa cruza organizações; ciclos e número excessivo de delegações são recusados.

### 3. Ciclo completo do agente

**Já existe:** `RuntimeService` resolve adapters e publicação por versão. `ConversationsService` cria execução, persiste mensagens/eventos, emite streaming, aceita cancelamento e grava usage.

**Risco concreto:** documentos registram que publicar não garante runtime operacional e que testes com fixtures não equivalem a chamadas reais. `OpenClawAdapter.validateConfig` rejeita ferramentas não vazias.

**Fatia recomendada:** teste controlado de ponta a ponta para cada motor suportado, incluindo runtime indisponível, cancelamento, timeout e recuperação.

**Aceite:** agente aparece como operacional apenas quando o runtime correspondente foi validado; versão publicada é imutável; execução registra versão, modelo, provedor, estado final e falha segura.

### 4. Skills

**Já existe:** builder com instruções, versões e histórico descrito em `docs/AGENT_BUILDER.md`.

**Gap:** não há comprovação, nos arquivos consultados, de skill como procedimento independente com descrição de ativação, referências e carregamento sob demanda.

**Fatia recomendada:** validar se algum modelo atual já implementa isso. Se não, criar skill scoped por agente, versionada, com tamanho e permissões definidos; não copiar o formato/implementação do Rerun sem desenho próprio.

**Aceite:** agente carrega apenas skills permitidas e pertinentes; edição concorrente é detectada; teste comprova isolamento entre tenants.

### 5. Memória e conhecimento

**Já existe:** módulos de documentos e Wiki foram descritos na implementação Sprint 6.1.

**Gap documentado:** `IMPLEMENTATION_STATE.md` marca RAG indisponível; `docs/AGENT_BUILDER.md` registra que o conteúdo textual do builder não é ingestão de documentos.

**Fatia recomendada:** primeiro separar memória do agente, conhecimento da organização e histórico de conversa. Depois implementar busca textual controlada; embeddings podem ser etapa posterior.

**Aceite:** resultados indicam fonte, respeitam ACL/tenant, desaparecem quando o acesso é revogado e não entram em contexto sem permissão. Definir retenção e exclusão.

### 6. Ferramentas, integrações e MCP

**Já existe:** contrato de tools e runtime; ferramentas básicas em `apps/api/src/modules/runtime/tools.ts`; adapter OpenClaw e worker de runtime.

**Gaps evidenciados:** o catálogo consultado é pequeno; auditoria registra OAuth/conectores genéricos ausentes; o adapter OpenClaw recusa ferramentas na configuração.

**Fatia recomendada:** construir infraestrutura de ferramenta comum e conectar uma integração prioritária em sandbox antes de ampliar o catálogo. Ferramentas devem ter permissões, escopos, timeout, limites e nível de risco.

**Aceite:** credencial nunca aparece em prompt, conversa, resposta ou log; ferramenta desativada é recusada pelo servidor; chamadas externas são rastreáveis e idempotentes quando necessário.

### 7. Agendamento, webhooks e runs autônomos

**Já existe segundo docs:** workflows determinísticos, webhooks e agendamento são descritos em `README.md` e `docs/SPRINT_6_1_IMPLEMENTATION.md`.

**Contradição:** `docs/SPRINT_6_BLOCKERS.md` diz que workflows/agendamentos/webhooks empresariais estão ausentes; `docs/SPRINT_6_AUDIT.md` também registra workflows como ausentes naquele relatório.

**Fatia recomendada:** reconciliar documentação e testar o código atual. Separar workflow de negócio de schedule/trigger que inicia uma execução autônoma de agente.

**Aceite:** trigger autenticado cria uma execução de agente em sessão própria, deduplica reentrega, persiste resultado e sobrevive a reinício do worker.

### 8. Aprovação e retomada

**Já existe segundo docs:** modelos e UI de aprovação aparecem na implementação Sprint 6.1.

**Contradição/risco:** auditoria e readiness indicam que ligação com execução, cancelamento ou retomada ainda é parcial.

**Fatia recomendada:** provar uma ação não destrutiva em sandbox: run pausa → decisão autorizada → run retoma; rejeição/expiração finaliza sem executar o efeito.

**Aceite:** somente um decisor válido pode resolver; corridas geram decisão única; execução pausada sobrevive ao restart; ação externa ocorre apenas após aprovação.

### 9. Board e monitoramento

**Já existe:** dashboard, páginas de agentes, conversas, execuções, canais e tarefas.

**Falta ou precisa revalidar:** visão agregada e em tempo real de saúde de agentes, atividade atual, automações, aprovações e falhas. A auditoria registra dashboard com filtros/métricas incompletos.

**Fatia recomendada:** painel por organização que agrega dados reais existentes, com links para execução e ação segura de pause/cancel onde suportado.

**Aceite:** estados exibidos vêm de API/runtime real, têm atualização robusta e não usam dados fictícios como status operacional; RBAC é aplicado nas rotas de controle.

### 10. Runtime, segurança, deploy e operação

**Já existe:** modularização NestJS, PostgreSQL/Prisma, Redis/BullMQ, worker de runtime, health routes e documentação Docker/OpenClaw.

**Pendências documentadas:** validação real de OpenClaw/provedores, readiness de Redis, crash recovery, backups/restauração, rate limit distribuído e teste de carga. A lista exata deve ser atualizada por evidência atual.

**Fatia recomendada:** matriz de dependências/health, reconciliação de runs abandonados, teste de restart em schema isolado e roteiro de backup/restauração.

**Aceite:** nenhum job é marcado como concluído sem efeito confirmado; retries não duplicam efeitos; readiness identifica dependências indisponíveis; secrets e dados pessoais são redigidos.

## Roadmap proposto

| Etapa | Escopo | Critério de saída |
|---|---|---|
| 0 — Baseline verificável | Reconciliar README, IMPLEMENTATION_STATE, TASKS e relatórios Sprint 6/6.1/7. Rodar verificações atuais. | Matriz única com implementação, testes e integrações reais separados. |
| 1 — Run real e observável | Validar agente publicado → conversa → streaming → histórico → cancelamento → estado final com um provedor real de teste. | Fluxo reproduzível; erros e estado de runtime são verdadeiros. |
| 2 — Uma ferramenta real | Implementar um conector/tarefa de negócio escolhidos pelo produto, sandbox, escopo mínimo e aprovação quando necessário. | Tool testada com autenticação real de sandbox, sem vazamento e com auditoria. |
| 3 — Aprovação/retomada | Integrar aprovação a uma execução de agente, incluindo restart e corrida de decisões. | A ação não ocorre antes da aprovação e a execução pode retomar. |
| 4 — Skills e memória | Skills versionadas, memória scoped e busca documental autorizada. | Testes de tenant, proveniência, exclusão e recuperação aprovados. |
| 5 — Automações de agente | Schedules e webhooks de agent runs, com idempotência e fila recuperável. | Reentrega e restart não duplicam nem perdem execuções. |
| 6 — Orquestração | Planejamento, delegação e execução multipasso, com limites e intervenção. | Cenário de teste coordena mais de um agente com histórico completo. |
| 7 — Board operacional | Estado real de agentes/runs/tasks/approvals e ações de controle autorizadas. | Desktop/mobile, acessibilidade e estados de falha testados. |
| 8 — Browser/computer, condicional | Browser isolado, visualização e takeover humano, somente se houver demanda validada. | Revisão de segurança, isolamento e operação antes de habilitar para clientes. |
| 9 — Operação/self-host | Deploy limpo, TLS, migrations, backup/restore, observabilidade e upgrade. | Procedimento reproduzido em ambiente isolado e documentado. |

## Decisões de produto que devem ser confirmadas antes de implementações maiores

1. Qual motor deve ser o primeiro caminho de produção: Mastra, AI SDK ou OpenClaw?
2. Qual integração real tem prioridade para o MVP — por exemplo WhatsApp oficial, CRM, email ou sistema interno?
3. O Foreman/Rainha deve criar agentes automaticamente ou somente selecionar agentes previamente aprovados?
4. Memória de agentes pode ser gravada automaticamente ou sempre exige revisão?
5. Browser/computer virtual é requisito do produto ou pode ficar fora do primeiro roadmap?
6. Billing/Stripe e multi-tenant comercial pertencem ao MVP ou podem ficar em etapa posterior?

## Divergências documentais que precisam de atualização

Há incompatibilidade entre o estado listado em:

- `README.md`, que descreve funcionalidades da Sprint 6.1 como workflows, documentos, Wiki e quotas;
- `docs/SPRINT_6_1_IMPLEMENTATION.md`, que relata implementação desses módulos;
- `docs/SPRINT_6_AUDIT.md` e `docs/SPRINT_6_BLOCKERS.md`, que registram lacunas correspondentes;
- `IMPLEMENTATION_STATE.md`, que registra runtime OpenClaw operacional e RAG como indisponíveis;
- `docs/SPRINT_7_READINESS.md`, que apresenta coordenação e algumas relações de tarefas/aprovações como futuras ou pendentes.

Antes de usar a matriz para planejar engenharia, atualize cada documento conforme código e testes atuais. Não apague histórico: marque o relatório antigo como superseded/desatualizado e aponte para o status atual.

## Licenciamento e identidade

O Colmeia tem licença MIT; Rerun está sob AGPL-3.0. Este roteiro recomenda implementar capacidades equivalentes de forma independente, sem copiar código, nome, logotipo, textos ou design proprietário. Revise licenças de novas dependências. Se o produto passar a distribuir ou operar código AGPL, obtenha análise apropriada sobre as obrigações aplicáveis.

## Próxima ação recomendada

Executar a Etapa 0 e iniciar a Etapa 1 somente após fixar os resultados atuais de build, typecheck, testes, runtime e provedor externo. Não implementar as dez frentes em um único PR.
