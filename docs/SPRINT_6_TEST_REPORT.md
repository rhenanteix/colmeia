# Sprint 6 — evidências de testes (01/11/2026)

Não há aceite global da Sprint 6. Testes aprovados certificam os cenários descritos, não funcionalidades ausentes. Logs em `artifacts/sprint-6/`; captura do browser em `test-results/`.

| Comando | Resultado desta execução |
|---|---|
| git status --short | Falhou: diretório não é repositório Git |
| node --version / npm --version | 22.22.3 / 10.9.8 |
| npm ls --depth=0 | Inventário inicial coletado; revelou Prisma divergente |
| npm ls @prisma/client --depth=1 | Árvore final API/database/worker em 5.22.0 compartilhado |
| npm run check | Aprovado: schema, formatação, lint, typecheck, 12 testes legados, 16 unitários e build |
| npm run typecheck | Reexecutado após correção final da instalação do worker; aprovado |
| npm run test:integration | 4 aprovados, 0 falhas, 0 ignorados |
| npm run test:runtime | 3 aprovados, 0 falhas; fixture explícita de provedor, PostgreSQL/HTTP reais |
| npm run test:queue | Aprovado com worker real + Redis + PostgreSQL |
| PLAYWRIGHT_CHANNEL=chrome npm run test:e2e | Ver resultado final abaixo |

## Novos cenários

- Tarefa com responsável externo recusada; tarefa própria criada e auditada; listagem/mutação entre Empresa A/B negadas; VIEWER sem escrita.
- Aprovação de outro tenant recusada; MEMBER/VIEWER não decidem; valor inválido e expiração recusados; corrida approved/rejected admite somente um vencedor e um evento.
- Worker consome fila real, ignora operação já concluída, deduplica jobId e executa três tentativas com backoff em operação inválida; falha permanente fica no banco/Redis. Não prova provisionamento Docker, efeitos externos, recorrência ou recuperação após crash.
- Novo E2E de tarefas: criar, mudar estado, recarregar, validar persistência, largura e acessibilidade nos três viewports.

## Falhas encontradas e resolvidas

- format:check inicial falhou em next-env.d.ts, gerado pelo Next. Arquivo gerado excluído do formatador; código-fonte continua verificado.
- Primeira integração bloqueada pelo sandbox ao conectar PostgreSQL. Reexecução autorizada passou; sem alterações ao schema public.
- Prisma 7 aninhado não foi removido por npm install. Manifest/lock alinhados e cópia antiga preservada fora do workspace; resolução 5.22.0 e worker real verificados.
- Primeiro E2E novo de tarefas usou request isolado do contexto do navegador, que não recebia cookie. Correção usa context.request. A asserção de persistência foi preservada.

## Limites

Unitários usam doubles; legados incluem verificações estáticas. Integração usa DB real. Fixture de IA é exclusivamente contrato, não resposta real de agente em produto. Testes default de runtime no browser são ignorados sem fixture/configuração específica. Não foram executados `test:live`/`test:openclaw`, cobranças Stripe, teste de carga, backup/restore ou CI remoto. Teste de quota concorrente comercial inexiste porque o módulo inexiste; quota mensal do agente está no código mas precisa de cenário dedicado.

## Arquivos alterados

- `.prettierignore`, `.env.example`, `package.json`, `package-lock.json`, `.github/workflows/ci.yml`, `apps/worker/package.json`.
- `apps/api/src/product.ts`, `apps/api/src/modules/collaboration/approvals.service.ts`.
- `apps/web/app/app/tasks/page.tsx`, `apps/web/app/app/agents/page.tsx`, `apps/web/app/app/page.tsx`.
- `tests/p0.integration.mjs`, `tests/e2e/tasks.spec.ts`, `scripts/test-queue.mjs`.
- `README.md`, `docs/API.md`, `docs/DATABASE.md` e os seis relatórios SPRINT_6/SPRINT_7.
- Artefatos locais de build/teste gerados. Sem Git, lista baseada nas alterações desta sessão, não em diff versionado.

## Resultado final

- Playwright: **15 aprovados, 3 ignorados, 0 falhas**, 48,1 s, desktop/tablet/mobile. Ignorados: cenário de runtime em cada viewport, condicionado à fixture específica.
- Formatação e ESLint reexecutados após os ajustes finais: aprovados (`format-final.log`, `lint-final.log`).
- Typecheck final aprovado nos três apps (`typecheck-final.log`).
- Worker real revalidado após alinhamento efetivo de Prisma: aprovado (`queue.log`).
- Build completo aprovado em `check.log`; E2E executou esse build. As mudanças posteriores à compilação web foram testes/documentação/CI e resolução do Prisma do worker, recompilado e executado pelo teste de fila.
- `e2e-initial.log` preserva as falhas da preparação inicial do teste; `e2e.log` contém a execução corrigida.
- **Sprint 6 global: REPROVADO nos critérios ainda ausentes. Sprint 7: contratos propostos documentados, implementação extensa não liberada pela homologação.**
