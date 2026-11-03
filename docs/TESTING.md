# Relatório de testes P0 — 31/10/2026

## Comandos

```bash
npm run db:validate
npm run db:generate
npm run db:deploy
npm run db:migrate
npm run db:seed
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npm run test:integration
PLAYWRIGHT_CHANNEL=chrome npm run test:e2e
npm audit
```

Prisma, migrations, seed, format, lint, tipos e build foram executados. `migrate dev` retornou banco sincronizado; a comparação final schema/banco, após o reforço de FKs, não indicou divergências. Sete migrations versionadas, sem reset.

## Cobertura de comportamento

- **12 testes legados**: políticas e regressões estruturais. Não substituem os testes funcionais.
- **10 unitários Vitest**: credencial ausente, assinatura inválida, sessão expirada, sessão de outro usuário, membership revogado, papel real do banco, escrita por VIEWER, recurso de outro tenant, configuração inválida e conflito sem escrita parcial.
- **1 suíte Supertest com PostgreSQL real**: cadastro, senha inválida, duplicidade, login incorreto/correto, logout, renovação, reset de uso único, sessões revogadas/expiradas, organizações/alternância, RBAC, alteração de papel, proprietário protegido, remoção de membro, canais/mensagens isolados, templates privados, convites concorrentes/reenvio/revogação/aceite, rascunhos concorrentes, versões imutáveis, publicação bloqueada e arquivamento. Também tenta escrita cruzada diretamente no banco e exige erro de FK.
- **6 E2E Playwright**: três jornadas completas (desktop, tablet e mobile) e três testes de CSRF. A jornada cobre cadastro, cookie HttpOnly/SameSite, ausência de token em sessionStorage, dashboard real, busca de páginas, tabela de membros, criação, salvamento/reabertura de rascunho, versão, configuração/alternância de organização, logout, recuperação por link e login com nova senha. Captura erros do console e verifica ausência de overflow horizontal no builder.
- **Axe WCAG A/AA**: dashboard e builder nos três viewports; zero violações na rodada aprovada. Não é certificação de acessibilidade completa.

## Ambiente e isolamento

`test:integration` cria/aplica migrations no schema `colmeia_p0_test` e inicia API na porta 4200. `test:e2e` usa schema `colmeia_p0_e2e`, API 4300 e Next de produção 3100. Ambos encerram seus próprios processos, usam segredo de teste e desabilitam webhook externo. Emails ficam em diretórios privados temporários. Os registros de QA são preservados nesses schemas para diagnóstico.

Execute build antes do E2E. O runner não reinicia nem reutiliza servidor externo. Para Linux/CI: `npx playwright install --with-deps chromium` e `npm run test:e2e`. Neste macOS o Chromium novo não é suportado; Chrome instalado funcionou com `PLAYWRIGHT_CHANNEL=chrome`.

Capturas e traces: `test-results/`. CI publica evidências por sete dias; traces podem conter dados e cookies de QA, portanto o pipeline usa exclusivamente credenciais isoladas.

## Limites

Sem envio de email externo, execução OpenClaw, teste de carga, Safari/Firefox ou validação manual com leitores de tela. A configuração do workflow foi atualizada, mas o serviço GitHub Actions não foi acionado nesta sessão. A primeira rodada de smoke tests anterior aos runners isolados deixou contas `p0-*`/`browser-*` no banco de desenvolvimento, sem remover dados existentes.
