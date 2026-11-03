# Desenvolvimento independente dos motores de IA

Execução iniciada em 2026-11-01. Esta matriz registra evidências; presença de código não equivale a homologação. Nenhuma credencial foi alterada e nenhum modelo real foi chamado. Os schemas de teste são `colmeia_p0_test` e `colmeia_p0_e2e`.

| Sprint | Implementado anteriormente | Implementado nesta execução | Testado e aprovado | Parcial ou pendente | Próximos passos |
|---|---|---|---|---|---|
| 1 — Fundação | Sessões persistidas, Argon2, recuperação, organizações, convites, RBAC, dashboard, catálogo, builder, autosave e versões | Serialização de resets concorrentes; consumo de convite condicionado ao hash atual; tipagem estrita; POST de segurança nos formulários | Integração PostgreSQL: autenticação, isolamento, permissões, concorrência de rascunhos, versões imutáveis, organizações, convites, revogação e resets concorrentes. E2E desktop/tablet/mobile: cadastro, cookie, dashboard, autosave/reload, versão, troca de organização, recuperação; CSRF; acessibilidade nos fluxos existentes | Email externo não homologado; testes usam entrega local real. Fallback sem JavaScript homologado nos três tamanhos de tela | Preservar regressões e validar entrega externa quando configurada |
| 2 — Teams | Canais, mensagens, histórico limitado, eventos SSE de agentes, notificações persistidas | DMs privadas, threads com FK composta, menções, notificações transacionais, presença, paginação estável, nomes de autores, SSE de notificações, reconexão de canais e revalidação de sessão nos streams | Integração PostgreSQL: DMs excluem terceiros inclusive ADMIN; acesso cross-tenant negado; respostas cross-channel rejeitadas pela API e FK; notificações privadas e leitura; SSE e interrupção de dados após logout; presença; 105 mensagens paginadas sem duplicação. E2E real entre dois usuários nas três telas | E2E aprovado em desktop/tablet/mobile; presença considera atividade nos últimos 90s e atualiza a cada 30s; SSE consulta PostgreSQL periodicamente, não é pub/sub Redis | Avaliar pub/sub Redis e carga; manter regressões de privacidade |
| 3 — Governança | Aprovações de agentes, auditoria, TenantBudget, policy-engine; BullMQ para operações de runtime | — | Não homologada nesta execução | Workflows determinísticos, agendamentos, webhooks, políticas operacionais e limites configuráveis ainda pendentes | Implementar fila independente dos motores e testar crash/retry/aprovação |
| 4 — Workspace | Tarefas com status; KnowledgeDocument e ProviderConnection no schema | — | Não homologada nesta execução | Kanban completo, arquivos/pastas, Wiki, busca, OAuth, cofre genérico e registry ainda pendentes | Implementar recursos por tenant, armazenamento e contratos de conectores |
| 5 — SaaS | Agregação de uso, Pino, health/readiness PostgreSQL | — | Não homologada nesta execução | Planos, assinatura, quotas, faturamento, relatórios, administração, backups/restauração e monitoramento completo ainda pendentes | Validar credenciais Stripe por presença/modo sem imprimir valores; implementar somente ambiente de teste |

## Arquivos alterados

Sprint 1:
- `apps/api/src/modules/identity/application/auth.service.ts`
- `apps/api/src/modules/identity/application/team.service.ts`
- `apps/api/src/modules/runtime/ai-sdk.adapter.ts` (somente tipo do parâmetro; contrato preservado)
- `apps/web/app/app/conversations/page.tsx` (tipagem)
- `apps/web/app/{login,cadastro,recuperar}/page.tsx`
- `tests/p0.integration.mjs`
- `tests/e2e/p0.spec.ts`

Sprint 2:
- `packages/database/prisma/schema.prisma`
- `packages/database/prisma/migrations/20261101000000_teams_collaboration/migration.sql`
- `apps/api/src/modules/collaboration/channel-access.ts`
- `apps/api/src/modules/collaboration/channels.service.ts`
- `apps/api/src/resources.ts`
- `apps/api/src/product.ts`
- `apps/api/src/bee-collaboration.ts`
- `apps/web/app/app/channels/page.tsx`
- `apps/web/app/app/user-menu.tsx`
- `tests/p0.integration.mjs`
- `tests/e2e/teams.spec.ts`

## Comandos e evidências

- `npm run test:integration`: tentativa inicial bloqueada pelo sandbox; reexecutado com acesso local permitido. 10 migrations aplicadas no schema isolado; 3 cenários de integração aprovados (múltiplas asserções cada).
- `npm run lint`: inicialmente 3 erros preexistentes de `any`, corrigidos; aprovado posteriormente.
- `npm run typecheck`: aprovado nos workspaces API, web e worker.
- `npm test`: 12 testes legados + 16 unitários aprovados. Os unitários preexistentes usam doubles; os novos testes de integração usam PostgreSQL e HTTP reais.
- `npm run build`: aprovado (API, Next.js, worker e geração Prisma).
- `npm run db:generate`: aprovado após alteração do schema.
- `npm run test:e2e`: Chromium gerenciado ausente; usado Chrome instalado com `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e`.
- Primeiro E2E da fundação: 6 aprovados; 3 testes de runtime intencionalmente ignorados, pois exigem fixture de IA e não fazem parte desta homologação.
- E2E Teams inicial detectou rótulo de seletor; corrigido. Uma execução também foi invalidada por rebuild durante o servidor E2E; seus resultados não contam como homologação.
- Screenshots e traces: `test-results/`. Conteúdo é recriado a cada execução Playwright.

O diretório não possui metadados Git acessíveis (`git status` retornou “Not a git repository”). Não foi criado commit.

## Resultado final desta execução

- `npm run lint && npm run typecheck && npm test && npm run build`: aprovado após todas as alterações de aplicação.
- `npm run db:validate`: schema válido.
- `npm run test:integration`: 3 cenários aprovados; inclui revogação de sessão durante stream aberto.
- `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e`: **12 aprovados, 3 ignorados** (somente cenários de runtime que exigem IA/fixture). Nenhuma falha.
- `npm run db:deploy`: aplicado também ao schema local `public`. Havia duas migrations anteriores pendentes (`runtime_conversations`, `gateway_credentials`), aplicadas junto à migration aditiva de Teams. Não foram alterados valores de credenciais.
- Documentação atualizada: `docs/BEE_TEAMS.md`, `docs/REALTIME_BEE_EVENTS.md`, `docs/AGENT_BUILDER.md` e esta matriz.
- **Escopo total ainda incompleto:** as Sprints 3, 4 e 5 não foram implementadas/homologadas nesta execução. Não há bloqueio por motor de IA; são trabalho de produto/infraestrutura pendente.
