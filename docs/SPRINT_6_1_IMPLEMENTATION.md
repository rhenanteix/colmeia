# Sprint 6.1 — implementação em andamento

## Kanban

Reutiliza Task e AuditEvent. Migration `20261101010000_kanban` acrescenta TaskBoard, TaskColumn e TaskComment; relações compostas protegem vínculos entre organizações. Task recebe prioridade, prazo, etiquetas, revisão, posição e arquivamento.

API em `apps/api/src/modules/tasks/tasks.controller.ts`, registrada pelo WorkspaceModule existente. Criação de quadro e colunas iniciais é transacional. Alteração de tarefa usa lock e comparação de revisão, com auditoria atômica. Responsável é validado na organização com lock de Membership. Contrato legado de PATCH somente de status permanece compatível; novos clientes sempre enviam revisão. Edições ricas sem revisão são rejeitadas.

UI em `apps/web/app/app/tasks/page.tsx`: quadros/colunas, DnD e alternativa por select para teclado/touch, detalhes editáveis, responsável, prioridade, prazo, etiquetas, pesquisa/filtros, comentários, histórico, arquivo/restauração. Polling a cada três segundos para tarefas; dez segundos para quadros.

## Outros módulos

Ainda não implementados nesta etapa. Não confundir o plano com entrega. Fluxos de aprovação/workflow e consumo serão integrados após a validação do Kanban.

## Aprovações (02/11/2026)

ApprovalRequest agora aceita agente opcional, aprovador, tarefa, revisão esperada, estado/coluna de destino, justificativa e timestamp de decisão. Sem tabela duplicada. Criação valida membros/tenant, registra auditoria e notifica o aprovador. Decisão transacional admite somente o aprovador designado (ou administrador em registros legados sem designação). Uma decisão concorrente vence; tarefa alterada desde a solicitação causa rollback. Cancelamento é restrito ao solicitante ou administrador. Expiração é persistida em lotes a cada 30 segundos e durante listagem, com decisão condicional para evitar duplicação de eventos.

Central `/app/approvals` integrada: solicitação, filtros, decisão, cancelamento, justificativa e histórico. Teste de integração aprovado; E2E em andamento. Integração com execução de workflow ainda pendente.

## Workflows determinísticos

Módulo `apps/api/src/modules/workflows` e editor `/app/workflows`. Novas entidades Workflow, WorkflowVersion, WorkflowRun e WorkflowStep; versões imutáveis e rascunho com revisão. Grafo validado sem ciclos, até 50 nós. Etapas: manual, webhook, agendamento por intervalo (mínimo 60s), condição sobre input, tarefa/atribuição, aprovação, status, notificação, espera e fim. Webhook exige segredo e idempotency-key; segredo é retornado somente na criação e armazenado em hash.

BullMQ é consumido por um worker dedicado do módulo dentro do processo API, independente do worker OpenClaw. PostgreSQL guarda o estado e efeitos de cada etapa na mesma transação. Reconciliador de um segundo reenvia estados elegíveis; decisão humana suspende a execução. Três tentativas por falha técnica com backoff, retry manual somente quando elegível. Execuções já iniciadas usam a versão fixada e podem terminar após desativação do workflow; desativação impede novos disparos. Sem cron arbitrário nesta entrega: agendamento por intervalo persistido.

Recuperação após SIGKILL, agendamento vencido, seis falhas em dois ciclos de retry e cancelamento foram testados em `tests/workflows-recovery.integration.mjs`. Não implica teste de carga ou execução de efeitos externos; etapas atuais só alteram dados internos.

## Arquivos e Wiki

Módulo `documents`, adapter LocalDocumentStorage e tela `/app/documents`. KnowledgeDocument reutilizado, com tamanho, MIME, autor, permissão e relações compostas com tarefas/agentes/páginas/pastas. Upload multipart até 10 MiB, allowlist e assinatura de PNG/JPEG/PDF, texto sem NUL; download sempre attachment/octet-stream/nosniff. BFF preserva ArrayBuffer e Content-Disposition. Não há blobs no PostgreSQL. Configure FILE_STORAGE_PATH como volume privado persistente compartilhado entre réplicas.

WikiPage/WikiVersion têm controle de revisão, histórico, restauração que cria nova versão, busca textual, hierarquia sem ciclos e associação ao quadro/projeto existente e agentes. Conteúdo é texto escapado por React, sem HTML executável. Conteúdo privado só é lido pelo autor ou administradores; anexos também respeitam acesso à página associada. Escrita/exclusão são restritas ao autor ou administradores. Pastas são organizadores compartilhados. Não foi criada entidade Project duplicando os quadros existentes.

## Quotas

Camada central `billing/quotas.ts`: limites por plano, lock de Organization e contagem real dentro da transação de criação. Guardas aplicados em agentes, aceitação de convites, workflows, execuções de workflow/IA, arquivos/bytes e criação de organizações como workspaces. WORKSPACE root impede contornar limite criando subworkspaces em cadeia. Recursos comerciais atuais são somados em consultas reais; não há contador simulado. Integrações são contadas a partir de ProviderConnection; não existe endpoint de criação de conectores genéricos nesta aplicação, portanto não há ingresso desse recurso a interceptar. A função central suporta seu limite para futuros ingressos.

Planos iniciais Essencial/Equipe/Empresarial ficam explícitos no catálogo em código, sem preços ou cobrança. São configuração inicial de produto, não preços Stripe. Execuções usam mês UTC; demais limites são capacidade atual. Agentes arquivados deixam de ocupar capacidade. Cancelamento preserva dados e aplica limites Essencial a novas criações.

## Assinaturas internas

Subscription e SubscriptionEvent persistem ciclo e idempotência. Apenas OWNER/ADMIN alteram plano/cancelam/reativam. Troca de plano rejeita capacidade incompatível, mantém auditoria e compara revisão. Trial opcional via BILLING_TRIAL_DAYS (0 por padrão). Provider interno não cobra. Teste de contrato usa fake de pagamento recusado; não representa transação Stripe. Credenciais Stripe ausentes nesta execução; não existe checkout/webhook Stripe homologado.
