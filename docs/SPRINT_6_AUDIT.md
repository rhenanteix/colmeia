# Sprint 6 — auditoria (01/11/2026)

Esta auditoria distingue código existente de homologação. A Sprint 6 **não está concluída**: faltam funcionalidades internas das Sprints 3–5, não apenas integrações externas. Evidências desta execução: `artifacts/sprint-6/` e `test-results/`. Não foi encontrado AGENTS.md; `git status --short` falhou porque este diretório não contém metadados Git. Não foi criado commit.

## Arquitetura observada

npm workspaces: `apps/api` (NestJS modular), `apps/web` (Next App Router/BFF com cookie HttpOnly), `apps/worker` (BullMQ/OpenClaw); packages database, contracts, runtime-core, openclaw-adapter e policy-engine. PostgreSQL guarda identidade, tenants, agentes, versões, mensagens, execuções e auditoria. SSE consulta persistência periodicamente; não usa WebSocket/pubsub Redis. Redis atende operações de provisionamento/deploy de runtime, não workflows empresariais genéricos.

Versões instaladas: Node 22.22.3, npm 10.9.8 (packageManager declara 10.9.2), NestJS 12.3.2, Next 16.4.3, React 19.3.1, TypeScript 5.9.3, Prisma 5.22.0, BullMQ 5.81.5, ioredis 5.11.1, Tailwind 4.3.3, TanStack Query 5.105.0, RHF 7.91.0, Zod 4.6.7, Motion 14.9.0, Vitest 5.0.5, Playwright 1.64.1. Testes atuais usam node:test, Vitest, Supertest e Playwright, não Jest. API tem AI SDK 7.0.159/Mastra 1.81.0. O worker declarava Prisma 7.10.1: fixado em 5.22.0 para compartilhar o cliente gerado.

10 migrations existentes; nenhuma migration nova ou destrutiva nesta sprint. `schema.prisma` válido; migrations aplicadas/verificadas somente nos schemas de teste pelos runners. FKs compostas protegem relações de tenant; não há RLS. Task.assignedTo continua sem FK de Membership; a API agora verifica e bloqueia o vínculo durante a criação. Backup/restore não homologados.

## Matriz funcional

| Módulo / funcionalidade | Implementação | Resultado |
|---|---|---|
| Cadastro/login/logout/reset/refresh/expiração | IMPLEMENTADA E VALIDADA | APROVADO nos cenários locais; email externo BLOQUEADO |
| Organizações, convites, papéis e revogação | IMPLEMENTADA E VALIDADA | APROVADO COM RESSALVAS: cobertura não é exaustiva de toda combinação de papéis |
| Isolamento agentes, canais/DMs, tarefas, notificações, execuções | IMPLEMENTADA E VALIDADA | APROVADO nos cenários IDOR/FK testados; não implica prova de todos os endpoints |
| Dashboard contagens existentes | IMPLEMENTADA E VALIDADA | APROVADO COM RESSALVAS: sem filtro por período, workflows/aprovações/consumo agregados na tela |
| Builder rascunho/autosave/concorrência/versões/arquivo | IMPLEMENTADA E VALIDADA | APROVADO COM RESSALVAS: publicação via fixture é contrato, runtime real não homologado |
| Teams mensagens, DMs, threads, menções, presença e SSE | IMPLEMENTADA E VALIDADA | APROVADO COM RESSALVAS: edição/exclusão de mensagens, gestão/arquivamento de canais ausentes |
| Aprovações decisão/RBAC/expiração/concorrência | PARCIAL | APROVADO COM RESSALVAS no backend; tela sem integração, cancelamento e fluxo de execução pendentes |
| Redis/BullMQ worker | IMPLEMENTADA E VALIDADA | APROVADO COM RESSALVAS: ver relatório; não comprova workflows nem crash recovery |
| Workflows, cron, webhooks empresariais | AUSENTE | REPROVADO no aceite global |
| Tarefas criação/status/atribuição | PARCIAL | APROVADO COM RESSALVAS; sem Kanban completo, prioridade, comentários e histórico na tela |
| Upload/download, Wiki versionada, busca geral | AUSENTE | REPROVADO; KnowledgeDocument no schema não é funcionalidade |
| Catálogo de runtime e cofre OpenClaw | PARCIAL | NÃO TESTADO com gateway real; contratos locais testados |
| OAuth, conectores genéricos/rotação | AUSENTE | REPROVADO; ProviderConnection é somente base de dados |
| Uso persistido por execução | IMPLEMENTADA E VALIDADA | APROVADO COM RESSALVAS via fixture; tela /usage ainda sem integração |
| Planos, assinaturas, Stripe, quotas comerciais | AUSENTE | REPROVADO; não é mero bloqueio de credenciais |
| Quota mensal de execuções por agente | IMPLEMENTADA, NÃO VALIDADA | NÃO TESTADO quanto ao limite concorrente; há lock transacional no código |
| Logs Pino, health, readiness DB | PARCIAL | APROVADO COM RESSALVAS; sem readiness Redis, painel degradado e métricas completas |

## Segurança e riscos

Correções: responsável cross-tenant em tarefas; decisão/auditoria de aprovação agora atômicas; Prisma homogêneo. Ver relatório de segurança. Riscos remanescentes: ausência de quotas comerciais; replay de efeitos externos após crash não provado; listas sem paginação em alguns módulos; SSE com polling e sem teste de carga; estados de runtime não têm garantia contínua de saúde. Não foram feitas chamadas de IA reais nem cobranças.

## Rotas e cobertura

O inventário abaixo é extraído dos controllers atuais. Cobertura funcional provada está nos testes `p0.integration.mjs`, `runtime.integration.mjs` e `tests/e2e`. Não há medição de cobertura por linha. Endpoints sem evidência específica nesta execução: edição de organização (`PATCH /organizations/active`), onboarding GET/POST, edição de identidade via PATCH /agents/:id, listagem de convites (além dos fluxos indiretos), capabilities/status/provision/destroy de runtime, roles e execução real de handoff. Os testes de contrato cobrem conversas/execuções com fixture, não provedores reais.

Telas sem integração: `/app/approvals` e `/app/usage` exibem aviso explícito de pendência; não apresentam dados simulados. Não existem telas de workflows, arquivos, wiki, assinaturas ou conectores genéricos.

### Inventário de controllers

```text
GET    /api/v1/bee-team/roles
SSE    /api/v1/bee-team/channels/:channelId/events
GET    /api/v1/bee-team/channels/:channelId/handoffs
POST   /api/v1/bee-team/channels/:channelId/handoffs
POST   /api/v1/auth/register
POST   /api/v1/auth/login
POST   /api/v1/auth/password-reset/request
POST   /api/v1/auth/password-reset/confirm
GET    /api/v1/auth/me
POST   /api/v1/auth/refresh
POST   /api/v1/auth/logout
POST   /api/v1/auth/switch
GET    /api/v1/team/members
PATCH  /api/v1/team/members/:id
DELETE /api/v1/team/members/:id
GET    /api/v1/team/invitations
POST   /api/v1/team/invitations
POST   /api/v1/team/invitations/accept
POST   /api/v1/team/invitations/:id/revoke
POST   /api/v1/team/invitations/:id/resend
GET    /api/v1/health
GET    /api/v1/health/ready
GET    /api/v1/builder/:agentId
POST   /api/v1/builder/:agentId
GET    /api/v1/builder/:agentId/versions
POST   /api/v1/builder/:agentId/versions
GET    /api/v1/conversations
POST   /api/v1/conversations
GET    /api/v1/conversations/:id
PATCH  /api/v1/conversations/:id
DELETE /api/v1/conversations/:id
GET    /api/v1/conversations/:id/messages
GET    /api/v1/executions
GET    /api/v1/executions/:id
POST   /api/v1/executions/:id/cancel
POST   /api/v1/conversations/:id/stream
GET    /api/v1/onboarding
POST   /api/v1/onboarding
GET    /api/v1/templates
POST   /api/v1/templates
GET    /api/v1/tasks
POST   /api/v1/tasks
PATCH  /api/v1/tasks/:id
SSE    /api/v1/notifications/events
GET    /api/v1/notifications
POST   /api/v1/notifications/:id/read
GET    /api/v1/agents
POST   /api/v1/agents
POST   /api/v1/agents/:id/archive
GET    /api/v1/agents/:id
PATCH  /api/v1/agents/:id
POST   /api/v1/agents/:id/publish
POST   /api/v1/runtimes/:id/destroy
GET    /api/v1/runtimes/capabilities
GET    /api/v1/runtimes/status
POST   /api/v1/runtimes/provision
GET    /api/v1/channels/presence
POST   /api/v1/channels/presence
POST   /api/v1/channels/direct
GET    /api/v1/channels
POST   /api/v1/channels
GET    /api/v1/channels/:id/messages
POST   /api/v1/channels/:id/messages
GET    /api/v1/approvals
POST   /api/v1/approvals/:id/decision
GET    /api/v1/usage/summary
GET    /api/v1/organizations
POST   /api/v1/organizations
PATCH  /api/v1/organizations/active
GET    /api/v1/dashboard
```

### Rotas Next.js

```text
/app/agents/[id]/builder
/app/agents
/app/approvals
/app/channels
/app/conversations
/app/executions
/app/models
/app
/app/settings
/app/tasks
/app/team
/app/templates
/app/usage
/cadastro
/convite
/login
/onboarding
/
/recuperar
```

### Migrations existentes

- `20261031040236_colmeia`
- `20261031090000_p0_sessions_drafts`
- `20261031091000_invitation_revocation`
- `20261031092000_template_scope`
- `20261031093000_p0_integrity`
- `20261031094000_agent_identity`
- `20261031095000_tenant_integrity`
- `20261031100000_runtime_conversations`
- `20261031110000_gateway_credentials`
- `20261101000000_teams_collaboration`

### Scripts npm

Auditoria de scripts: `package.json`. Existiam format:check, lint, typecheck, test, build, db:validate, test:integration, test:e2e e test:runtime. Adicionado `test:queue`, que exige as migrations no schema colmeia_p0_test (execute test:integration antes). CI recebeu Redis e os testes de contratos/fila; execução remota do CI não foi realizada.
