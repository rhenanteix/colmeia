# Sprint 6 — segurança

## Correções

1. **Atribuição de tarefa fora do tenant**: POST /tasks aceitava qualquer string em assignedTo. Agora aceita UUID de membro da organização, com consulta e lock FOR SHARE na transação de criação/auditoria. Outro tenant recebe 400 sem revelar dados. Regressão real PostgreSQL/HTTP passou. Não foi criada FK nem alterado dado legado; remoção posterior de membro pode deixar atribuição histórica.
2. **Auditoria não atômica de aprovação**: updateMany e AuditEvent eram independentes. Agora estão na mesma transação. Status pending e expiresAt são condições da escrita, preservando exclusão mútua. Teste real de decisões concorrentes: uma 201, outra 409 e exatamente um evento; expirada não grava decisão/evento. OWNER/ADMIN exigidos, MEMBER/VIEWER negados.
3. **Dependência do worker**: Prisma 7 declarado junto a generator 5.22 podia quebrar instalações limpas. Manifest/lockfile alinhados ao Prisma 5.22.0; árvore e worker real verificados.

## Evidências e limites

- Guard lê Membership e Session atuais; não confia no papel do JWT. Testes validam assinatura inválida, sessão expirada/revogada e mudança de papel.
- IDOR testado entre organizações em agentes, builder, tarefas, canais/DMs, aprovações e conversas/execuções (estas com fixture de provedor).
- FKs rejeitam mensagem/execução de outro tenant e thread de outro canal.
- SSE revalida sessão e deixa de entregar dados após logout; DM exclui terceiros inclusive ADMIN.
- BFF rejeita escrita cross-origin; cookie HttpOnly/SameSite Lax. Formulário sem JS não põe senha na URL.
- DTO whitelist/forbidNonWhitelisted e Prisma parametrizado presentes. Mensagens renderizadas como texto; não foi executada uma bateria completa de payloads XSS/injeção.
- Throttler global presente (120/min); teste de saturação não executado. Upload não existe, portanto não homologado.
- Pino redige autorização/cookies/body e retira query string do URL. Não foi feita inspeção de logs de produção.
- Nenhum valor de .env foi impresso ou alterado. Duplicações e comentários incorretos removidos apenas de .env.example.

## Pendências relevantes

Não há quotas comerciais de agentes/usuários/armazenamento/workflows; não expor essas promessas como aplicadas. Approvals ainda não implementam ciclo empresarial completo nem retomada de execução. Backups, restore, carga, RLS, crash/replay externo, OAuth, rotação de conectores e upload seguro não homologados. Auditoria de dependências do npm variou durante a resolução; não equivale a análise completa da cadeia de suprimentos. Não há alegação de ausência de todas as vulnerabilidades.
