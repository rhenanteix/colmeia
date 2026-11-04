# Colmeia

Monorepo existente da Ribeira Connect: Next.js App Router, NestJS modular e PostgreSQL/Prisma. Mascotes oficiais preservados em `apps/web/public/bees`.

## Executar localmente

Requisitos: Node.js 22.22+, npm 10+, PostgreSQL acessível. Redis é necessário para workflows determinísticos e para o worker de operações OpenClaw; autenticação, Kanban, documentos e billing interno não dependem de Redis.

```bash
cp .env.example .env # somente no primeiro setup; não sobrescreva credenciais existentes
npm install
npm run db:generate
npm run db:deploy
npm run db:seed
npm run dev:api
# em outro terminal
npm run dev:web
```

Configure `DATABASE_URL` e `AUTH_JWT_SECRET` (pelo menos 32 caracteres aleatórios) em `.env`. O script da API carrega esse arquivo automaticamente. Frontend: http://localhost:3000. API: http://localhost:4000/api/v1. O frontend encaminha requisições pela rota própria `/api/backend`. Configure `API_INTERNAL_URL` no ambiente do processo Next se a API não estiver em `http://localhost:4000/api/v1`.

## Fluxos disponíveis

- Cadastro com Argon2id, login, cookie HttpOnly, expiração, renovação e logout com revogação no banco.
- Recuperação com token hasheado de uso único e revogação das sessões anteriores.
- Organizações, alternância de workspace, edição de nome/slug, membros, convites, reenvio e revogação.
- Dashboard com contagens e auditoria reais, catálogo de agentes com busca/filtros, templates oficiais.
- Builder com seis etapas, seleção de mascote, rascunhos persistentes com revisão, versões imutáveis e restauração para rascunho.
- Publicação de versões via adapters Mastra/AI SDK/OpenClaw; disponibilidade real depende da configuração e saúde do runtime. Publicado não significa operacional.

## Emails

Sem `MAIL_WEBHOOK_URL`, em desenvolvimento, emails são arquivos privados em `os.tmpdir()/colmeia-mail` (ou `MAIL_DEV_DIRECTORY`). Eles contêm links sensíveis; não devem ser versionados ou publicados.

## Verificação

```bash
npm run format
npm run format:check
npm run lint
npm run typecheck
npm test
npm run db:validate
npm run build
npm run test:integration
npx playwright install chromium
npm run test:e2e
```

Neste macOS o Chromium atual do Playwright não é suportado. Com Google Chrome instalado, use `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e`.

Os runners criam schemas `colmeia_p0_test` e `colmeia_p0_e2e` na conexão PostgreSQL configurada, usam portas 4200/4300/3100 e encerram seus próprios servidores. Não use uma conexão de produção nos testes.

Veja [estado e limites](IMPLEMENTATION_STATE.md), [relatório de testes](docs/TESTING.md), [autenticação](docs/AUTH.md), [arquitetura](docs/ARCHITECTURE.md) e [pendências](TASKS.md).

## Homologação Sprint 6

Resultado global **incompleto**: ver [auditoria](docs/SPRINT_6_AUDIT.md), [testes](docs/SPRINT_6_TEST_REPORT.md), [segurança](docs/SPRINT_6_SECURITY_REPORT.md), [UX](docs/SPRINT_6_UX_REVIEW.md), [bloqueios](docs/SPRINT_6_BLOCKERS.md) e [prontidão](docs/SPRINT_7_READINESS.md).

Após `npm run test:integration`, execute `npm run test:queue` para validar Redis e o worker real em fila isolada (sem chamadas de IA/Docker). `npm run test:runtime` valida contratos com fixture HTTP local; não comprova disponibilidade externa. `npm run test:openclaw` valida a integração OpenClaw no ambiente próprio.

## Sprint 6.1 — processos empresariais

- `/app/tasks`: quadros, colunas, responsáveis, prioridades, prazos, etiquetas, comentários, histórico, drag-and-drop e arquivo/restauração.
- `/app/approvals`: solicitações, aprovador, prazo, decisão/justificativa, cancelamento e expiração persistida.
- `/app/workflows`: editor de etapas conectadas, rascunho/versionamento, publicação, ativação, disparo manual/webhook/agendamento por intervalo, histórico, cancelamento e retry elegível. Sem chamadas de IA.
- `/app/documents`: arquivos em disco privado e Wiki com versões, busca e restauração. Conteúdo de Wiki é texto, sem HTML executável.
- `/app/billing`: planos, quotas reais, trial opcional, troca de plano, cancelamento e reativação **internos, sem cobrança**. Stripe não está implementado/homologado.
- `/app/usage`: consumo operacional, histórico, quotas e ledger real de IA; nenhuma estimativa de tokens/custos.

Aplique `npm run db:deploy` após atualizar o código e reinicie API/web. As migrations da Sprint 6.1 são incrementais; não execute reset. Configure `REDIS_URL`, `WORKFLOW_QUEUE_NAME` e `FILE_STORAGE_PATH` conforme `.env.example` e `docs/DEPLOYMENT.md`. Use volume privado e persistente para arquivos.

Webhook de workflow: `POST /api/v1/workflow-webhooks/:id`, headers `x-workflow-secret` e `idempotency-key`, corpo `{"input":{...}}`. Guarde o segredo retornado na criação; o banco guarda somente o hash.

Relatórios: [plano](docs/SPRINT_6_1_PLAN.md), [implementação](docs/SPRINT_6_1_IMPLEMENTATION.md), [testes](docs/SPRINT_6_1_TEST_REPORT.md) e [bloqueios/limites](docs/SPRINT_6_1_BLOCKERS.md). Verifique as datas e o estado atual dos relatórios: alguns foram produzidos em etapas diferentes e podem divergir.

## Comparação e roadmap de paridade funcional

Veja [`docs/RERUN_PARITY_ROADMAP.md`](docs/RERUN_PARITY_ROADMAP.md) para a matriz de capacidades, evidências, gaps, prioridades e critérios de aceite para aproximar o Colmeia do Rerun AI coworkers. O documento é um plano; não afirma que os recursos futuros estejam implementados.
