# Estado de implementação — 31/10/2026

## Implementado

- Monorepo preservado; Next 16.4.3, Nest 12.3.2, Node 22.22+, Prisma/PostgreSQL.
- Cadastro Argon2id, login, sessões no banco, BFF com cookie HttpOnly/Secure, CSRF por Origin, expiração, renovação e logout.
- Recuperação com token hasheado de uso único e revogação das sessões; email privado de desenvolvimento e webhook HTTPS configurável.
- Organizações, alternância, edição, convites/aceite/reenvio/revogação, gestão de membros e matriz RBAC explícita.
- Dashboard com métricas e auditoria reais; TanStack Query; navegação ativa, breadcrumbs, command menu, notificações e menu mobile.
- Builder em seis etapas, identidade e mascote persistidos, limites desejados e aprovação humana, rascunhos com revisão/conflito, snapshots imutáveis com autor/data, resumo, comparação e restauração.
- Catálogo com busca/filtros/ordenação/paginação local; arquivamento preserva histórico e bloqueia novos repasses.
- Oito templates oficiais; templates customizados isolados por organização. Criação de agente/rascunho/auditoria transacional.
- Componentes shadcn/Radix integrados aos formulários, feedback, tabela de membros, busca e confirmação. Tailwind, Lucide e Motion; mascotes oficiais preservados.
- Serviços separados para identidade, equipe, builder, agentes, runtime, canais, aprovações, consumo, organizações e dashboard.
- Pino com remoção de dados sensíveis, validação de entrada, rate limiting, ESLint, Prettier e TypeScript strict.
- Sete migrations totais: sessões/tokens, revogação, templates privados, identidade e integridade multi-tenant. FKs compostas protegem rascunhos, mensagens, execuções, uso, aprovações, operações e repasses; todas as entidades de organização têm vínculos referenciais.

## Validação

Resultados e comandos estão em `docs/TESTING.md`. Foram executados build, Prisma, migrations, formatação, lint, tipos, 12 testes legados, 10 unitários Vitest, integração Supertest/PostgreSQL e seis E2E Playwright. Axe verificou dashboard/builder em desktop, tablet e mobile. Capturas reais foram inspecionadas. A auditoria de dependências retornou zero vulnerabilidades após as atualizações.

## Dependências externas e limites

- OpenClaw operacional não está integrado. Publicação retorna conflito; nenhuma execução/implantação é simulada. RAG e ferramentas operacionais permanecem explicitamente indisponíveis.
- Entrega real de email precisa de `MAIL_WEBHOOK_URL`/`MAIL_WEBHOOK_TOKEN` e homologação com o provedor. Os testes usam exclusivamente o adaptador privado local.
- Rate limiter é local ao processo. Deploy com múltiplas réplicas precisa de armazenamento distribuído e configuração confiável dos proxies. Entrega de email é síncrona, sem outbox/retry durável.
- RLS não foi ativado: isolamento é aplicado pelos guards/consultas e reforçado por FKs compostas. Não houve homologação de produção ou testes de carga.
- QA de navegador usa Chrome em três viewports; não equivale a certificação completa WCAG, teste manual com leitores de tela ou homologação Safari/Firefox.
- Salvamento é manual com controle de concorrência e avisos; autosave não foi habilitado.

## Falhas corrigidas durante a execução

Testes sensíveis a espaços, JWT sem revogação, token no sessionStorage, dashboard estático, sobrescrita de rascunhos, templates privados globais, mascote não persistido, API sem carga de .env, dependências vulneráveis, navegação mobile excessiva, limitação indevida de consultas de sessão, refetch após logout e favicon ausente.

Chromium distribuído pelo Playwright não suporta macOS 13 ARM desta máquina; testes executados com Chrome instalado (`PLAYWRIGHT_CHANNEL=chrome`). A referência visual externa não abriu na ferramenta; a identidade existente no projeto orientou o redesign.
