# Sprint 6.1 — plano baseado na auditoria

Diagnóstico em 01/11/2026. Lidos SPRINT_6_AUDIT e SPRINT_6_TEST_REPORT e inspecionados schema Prisma, controllers, serviços, UI e runners existentes. Não há AGENTS.md nem metadados Git neste workspace.

## Ordem e lacunas reais

1. **Kanban:** reutilizar Task e AuditEvent; faltam quadros/colunas, metadados, comentários, arquivo, pesquisa, DnD, histórico e concorrência. Preservar contratos de criação/status existentes. Novas relações devem usar chaves compostas de tenant. Validar no PostgreSQL e navegador.
2. **Aprovações:** reutilizar ApprovalRequest, ApprovalsService e Notification; agentId obrigatório impede aprovações independentes. Faltam criação, aprovador, justificativa, cancelamento, expiração persistida, UI e retomada de processo.
3. **Workflows:** módulo empresarial inexistente. Criar definições/versionamento e execução determinística persistida; aproveitar BullMQ/Redis, com idempotência transacional, retomada e limites de passos. Não utilizar motores de IA.
4. **Arquivos/Wiki:** KnowledgeDocument existente não possui upload nem conteúdo versionado. Reutilizar entidade; implementar adapter de armazenamento fora do banco e Wiki com permissões e histórico.
5. **Quotas:** TenantBudget limita custo de IA, não recursos comerciais. Implementar limites centrais e reservas/locks nas operações de criação, incluindo serviços existentes.
6. **Assinaturas:** módulo billing contém apenas UsageService. Catálogo, assinatura e eventos ausentes. Testar regras com contratos; Stripe somente sandbox, jamais cobrança real.
7. **Consumo:** UsageLedgerEntry guarda consumo de IA; UI desconectada. Acrescentar agregações operacionais reais e integrar quotas/assinaturas, sem inventar tokens.
8. **Homologação integrada:** webhook → tarefa atribuída → aprovação/notificação → retomada → status/auditoria/consumo, sem IA. Testar isolamento, RBAC, concorrência, retry, recuperação e layouts; executar migrations, lint, typecheck e build.

## Critério de evidência

Código, teste executado e aprovação são estados distintos. Registrar resultados e falhas nos relatórios, sem herdar homologação da Sprint 6. Executar migrations nos schemas isolados usados pelos runners; não alterar dados do schema principal para testes.

## Decisão técnica para workflows

Motor determinístico separado dos agentes. Definição em grafo acíclico (até 50 nós), versão imutável publicada e execução com contexto, revisão, idempotency key, histórico de etapas e correlation ID. BullMQ despacha; PostgreSQL é a fonte de estado. Efeitos internos de cada etapa e avanço são confirmados na mesma transação. Um reconciliador reenfileira estados elegíveis após reinício e acompanha aprovação/espera; aprovação suspensa não mantém job em execução. Agendamento por intervalo persistido e webhook com segredo e chave de idempotência. Sem execução arbitrária de código nem chamadas a LLM.
