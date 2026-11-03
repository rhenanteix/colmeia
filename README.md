# Colmeia

Monorepo existente da Ribeira Connect: Next.js App Router, NestJS modular e PostgreSQL/Prisma. Mascotes oficiais preservados em `apps/web/public/bees`.

## Executar localmente

Requisitos: Node.js 22.22+, npm 10+, PostgreSQL acessível. Redis é necessário para workflows determinísticos e para o worker de operações OpenClaw; autenticação, Kanban, documentos e billing interno não dependem de IA.

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

Configure `DATABASE_URL` e `AUTH_JWT_SECRET` (pelo menos 32 caracteres aleatórios) em `.env`. O script da API carrega esse arquivo automaticamente. Frontend: http://localhost:3000. API: http://localhost:4000/api/v1. Swagger: http://localhost:4000/api/docs.

O frontend encaminha requisições pela rota própria `/api/backend`. Configure `API_INTERNAL_URL` no ambiente do processo Next se a API não estiver em `http://localhost:4000/api/v1`. Essa variável é privada; não exponha segredo em `NEXT_PUBLIC_*`.

## Fluxos disponíveis

- Cadastro com Argon2id, login, cookie HttpOnly, expiração, renovação e logout com revogação no banco.
- Recuperação com token hasheado de uso único e revogação das sessões anteriores.
- Organizações, alternância de workspace, edição de nome/slug, membros, convites, reenvio e revogação.
- Dashboard com contagens e auditoria reais, catálogo de agentes com busca/filtros, templates oficiais.
- Builder com seis etapas, seleção de mascote, rascunhos persistentes com revisão, versões imutáveis e restauração para rascunho.
- Publicação de versões via adapters Mastra/AI SDK/OpenClaw; disponibilidade real depende da configuração e saúde do runtime. Publicado não significa operacional.

## Emails

Sem `MAIL_WEBHOOK_URL`, em desenvolvimento, emails são arquivos privados em `os.tmpdir()/colmeia-mail` (ou `MAIL_DEV_DIRECTORY`). Eles contêm links sensíveis; não devem ser versionados ou publicados. Em produção configure um endpoint HTTPS de email transacional com `MAIL_WEBHOOK_URL` e `MAIL_WEBHOOK_TOKEN`. Contrato: POST JSON `{to, subject, text}`, autorização Bearer; sucesso HTTP 2xx. A entrega externa precisa ser homologada com seu provedor.

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

Os runners criam schemas `colmeia_p0_test` e `colmeia_p0_e2e` na conexão PostgreSQL configurada, usam portas 4200/4300/3100 e encerram seus próprios servidores. Não use uma conexão de produção para testes. Execute build antes do E2E. Registros de QA são preservados nos schemas de testes para diagnóstico.

Veja [estado e limites](IMPLEMENTATION_STATE.md), [relatório de testes](docs/TESTING.md), [autenticação](docs/AUTH.md), [arquitetura](docs/ARCHITECTURE.md) e [pendências](TASKS.md).

## Homologação Sprint 6

Resultado global **incompleto**: ver [auditoria](docs/SPRINT_6_AUDIT.md), [testes](docs/SPRINT_6_TEST_REPORT.md), [segurança](docs/SPRINT_6_SECURITY_REPORT.md), [UX](docs/SPRINT_6_UX_REVIEW.md), [bloqueios](docs/SPRINT_6_BLOCKERS.md) e [contratos propostos da Sprint 7](docs/SPRINT_7_READINESS.md).

Após `npm run test:integration`, execute `npm run test:queue` para validar Redis e o worker real em fila isolada (sem chamadas de IA/Docker). `npm run test:runtime` valida contratos com fixture HTTP local identificada; não homologa provedores reais. Evidências locais em `artifacts/sprint-6/` e screenshots em `test-results/`. Não executar esses runners contra conexão de produção.


## Sprint 6.1 — processos empresariais

- `/app/tasks`: quadros, colunas, responsáveis, prioridades, prazos, etiquetas, comentários, histórico, drag-and-drop e arquivo/restauração.
- `/app/approvals`: solicitações, aprovador, prazo, decisão/justificativa, cancelamento e expiração persistida.
- `/app/workflows`: editor de etapas conectadas, rascunho/versionamento, publicação, ativação, disparo manual/webhook/agendamento por intervalo, histórico, cancelamento e retry elegível. Sem LLM.
- `/app/documents`: arquivos em disco privado e Wiki com versões, busca e restauração. Conteúdo de Wiki é texto, sem HTML executável.
- `/app/billing`: planos, quotas reais, trial opcional, troca de plano, cancelamento e reativação **internos, sem cobrança**. Stripe não está implementado/homologado.
- `/app/usage`: consumo operacional, histórico, quotas e ledger real de IA; nenhuma estimativa de tokens/custos.

Aplique `npm run db:deploy` após atualizar o código e reinicie API/web. As cinco migrations da Sprint 6.1 são incrementais; não execute reset. Configure `REDIS_URL`, `WORKFLOW_QUEUE_NAME` e `FILE_STORAGE_PATH`. A fila recebe um sufixo derivado do banco/schema, isolando testes de outros ambientes. O consumidor de workflows roda com a API; `dev:worker` continua dedicado ao OpenClaw. Rascunhos/documentos podem ser usados sem Redis, mas executar workflows exige Redis.

`FILE_STORAGE_PATH` deve apontar para volume privado persistente, compartilhado entre réplicas; prefira caminho absoluto. O padrão `.colmeia-storage` é relativo à raiz do monorepo. Backup dos documentos deve incluir volume e banco. Uploads aceitos: PDF, PNG, JPEG, TXT, Markdown e CSV, até 10 MiB. Downloads são anexos. A validação de formato não é antivírus.

Planos iniciais estão em `apps/api/src/modules/billing/quotas.ts`, sem preços definidos. Limites de execuções usam mês UTC; demais quotas são capacidade atual. Workspaces pertencem a um grupo raiz para evitar contorno do limite por criação em cadeia; cada organização mantém os próprios dados/assinatura. `BILLING_TRIAL_DAYS=0` desativa trial; quando configurado (até 90), novas organizações começam em avaliação do plano Equipe. Integrações genéricas não ganham conectores nesta sprint; ProviderConnection é contado e a guarda central está pronta para seus futuros ingressos.

Webhook de workflow: `POST /api/v1/workflow-webhooks/:id`, headers `x-workflow-secret` e `idempotency-key`, corpo `{"input":{...}}`. Guarde o segredo retornado na criação; o banco guarda somente seu hash. Duplicatas com a mesma chave retornam a execução existente. Desativar impede novos disparos; execuções iniciadas continuam até finalizar ou serem canceladas.

Relatórios: [plano](docs/SPRINT_6_1_PLAN.md), [implementação](docs/SPRINT_6_1_IMPLEMENTATION.md), [testes](docs/SPRINT_6_1_TEST_REPORT.md) e [bloqueios/limites](docs/SPRINT_6_1_BLOCKERS.md). `test:integration` cobre também documentos, quotas, assinaturas e recuperação após SIGKILL (porta adicional 4205). `test:e2e` aceita filtros, por exemplo `npm run test:e2e -- workflows.spec.ts`, e reinicia a API entre viewports, mantendo o rate limit habilitado.
