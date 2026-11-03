# Banco de dados

PostgreSQL + Prisma 5.22. Schema versionado em `packages/database/prisma/schema.prisma`; migrations aditivas em `migrations/`. Use `db:deploy` para aplicar migrations existentes sem reset. `db:migrate` cria migrations de desenvolvimento e não deve ser usado em produção.

O ciclo adicionou Session, PasswordResetToken, revogação de Invitation, escopo de templates, revisão de AgentDraft e identidade persistida do Agent. Versões recebem createdAt e authorSubject. Sessões e tokens pertencem a User por FK; convites pertencem à organização; rascunhos usam FK composta (agentId, organizationId), impedindo vínculo cruzado entre tenants.

Rascunhos usam updateMany condicionado à revisão, com incremento atômico em transação. Criar versão trava a revisão do rascunho antes de obter próximo número, e a constraint (agentId, version) preserva unicidade. As rotas não alteram snapshots de AgentVersion. Arquivamento altera status, preservando dados e auditoria.

Templates oficiais usam organizationId nulo. Templates customizados existentes com prefixo `custom-` foram associados ao tenant pelo identificador legado. O seed é idempotente e contém os oito mascotes oficiais. Não adiciona agentes, métricas ou usuários fictícios ao produto.

Integração usa schema `colmeia_p0_test`; E2E usa `colmeia_p0_e2e`, na mesma instância configurada em DATABASE_URL. Os runners nunca resetam o schema public. Antes da introdução dos runners isolados, o primeiro smoke test criou contas QA `p0-*` e `browser-*` no banco de desenvolvimento; elas foram preservadas para evitar apagar dados sem revisão.

A migration final adiciona FKs de organização às entidades legadas e FKs compostas para canais/mensagens, agentes/execuções, aprovações, uso, operações e handoffs. Foi aplicada em transação sem exclusão de dados. Isolamento é aplicado na API e por integridade referencial, sem RLS. Campos legados de reset em User foram preservados por compatibilidade, mas o fluxo novo usa PasswordResetToken.

## Extensão multimotor (01/11/2026)

Migrations incrementais `20261031100000_runtime_conversations` e `20261031110000_gateway_credentials` adicionam Conversation, ConversationMessage, ExecutionEvent, RuntimeDeployment e campos de versão/modelo/solicitante/uso/cancelamento em AgentExecution. RuntimeInstance recebe endpoint privado, token criptografado, erro e verificação de saúde. Os dados P0 são preservados.

Eventos têm sequência única por execução. Mensagens têm UUID estável; requestId evita execução duplicada por organização. As relações compostas reforçam o isolamento do tenant. RuntimeDeployment separa versão criada, implantação pendente/falha e agente ativo.

## Sprint 6

Nenhuma migration adicionada ou executada contra public nesta rodada. Os runners verificaram as dez migrations nos schemas isolados `colmeia_p0_test`, `colmeia_p0_e2e` e `colmeia_runtime_test`. Teste de fila usa `colmeia_p0_test`, fila UUID própria e chave de criptografia efêmera. Dados de QA e filas são preservados, sem reset/flush. Backup/restore não homologados. Prisma do worker fixado em 5.22.0, alinhado ao generator/API. `Task.assignedTo` é validado transacionalmente na API, sem mudança de FK ou dados históricos.
