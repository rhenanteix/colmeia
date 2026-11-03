# Sprint 7 — prontidão e contratos propostos

**NÃO PRONTA para implementação extensa.** Fundação e colaboração têm evidências locais; a Sprint 6 global não passou devido às lacunas de produto enumeradas em SPRINT_6_BLOCKERS.md. Este documento prepara contratos de design, sem anunciar endpoints ou entidades não implementados.

## Reuso de nomenclatura

| Conceito solicitado | Modelo existente / decisão |
|---|---|
| AgentTask | Estender Task, não criar segunda tabela de tarefas |
| TaskAssignment | Task.assignedTo hoje representa usuário; futura relação tipada de responsável deve distinguir usuário/agente, tenant e histórico |
| Delegation | Reusar BeeHandoff para delegação a agente; hoje exige canal e executa via runtime. Não reutilizar como execução determinística sem separar transporte/executor |
| AgentEvent | AgentEvent já existe em runtime.types.ts; ExecutionEvent persiste sequência. Preservar eventos atuais; adicionar tipos de coordenação versionados |
| AgentExecution | Reusar AgentExecution; engine/model/provider já são opcionais, mas o executor atual depende do runtime |
| ApprovalRequest | Reusar a entidade, acrescentar ligação verificável a tarefa/execução e ciclo de cancelamento/retomada |
| CoordinationSession | Ausente; futura entidade tenant-scoped, sem migration nesta sprint |

## Envelope dos comandos (proposta v1)

```ts
type CoordinationCommand = {
  schemaVersion: 1;
  requestId: string; // UUID, idempotente por tenant + operação
  taskId?: string;
  expectedRevision?: number; // obrigatório para mutações concorrentes
};
```

organizationId e actorSubject vêm da sessão/Principal, nunca de payload livre. O job persiste organizationId e referencia registro com FK composta; o consumidor recarrega a autorização e o estado antes de qualquer efeito. Falta de sessão/papel/permissão não pode ser suprida pela Rainha.

| Operação | Entrada específica | Resultado / regra |
|---|---|---|
| Criar tarefa | title, description, priority | Task em todo; auditoria + chave idempotente na transação |
| Atribuir | responsável `{ kind: 'user' \| 'agent', id }` | validar tenant, papel e elegibilidade; guardar histórico |
| Delegar | taskId, canal, targetAgentId, instruction | BeeHandoff ligado à Task; impedir ciclos e limite de saltos |
| Registrar evento | executionId, sequence, type, payload permitido | ExecutionEvent append-only; unicidade execução/sequence; sem segredos |
| Solicitar aprovação | operation, referência da ação, expiresAt | ApprovalRequest pending; não executar efeito antes de decisão válida |
| Atualizar status | estado esperado, destino, revision | CAS; 409 em conflito; evento/auditoria na transação |
| Concluir | resultado/referência validada | done somente após efeito confirmado; replay devolve resultado persistido |
| Histórico | taskId, cursor, limit | paginação estável `(createdAt,id)` por tenant; referências privadas respeitam ACL |

Erros: 400 payload/transição inválida, 401 sessão inválida, 403 papel insuficiente, 404 recurso ausente/inacessível, 409 revisão/estado conflitante, 503 executor indisponível. Não duplicar efeito em retry; usar outbox transacional antes de publicar na fila e chave idempotente no consumidor/integração. Definir timeout, cancelamento, expiração, DLQ e reprocessamento auditável antes de habilitar automações.

## Rainha determinística

Rainha deve ser política de roteamento: departamento explícito → responsáveis elegíveis → menor carga → desempate por ID estável. Sem agente elegível: aguardar atribuição humana. Ação sensível: solicitar aprovação e bloquear execução. Sem modelo de IA necessário. O mascote rainha atual não implementa esse coordenador.

## Gate de entrada

Concluir workflows, aprovação ligada à ação, workspace e quotas; testar múltiplos consumidores/retries/crash, FK/IDOR, autorização em canais privados e UI nos três viewports. Exigir testes de idempotência de efeitos reais antes de declarar execução exatamente uma vez. Aplicar migrations aditivas com plano de backup e validar dados legados antes de adicionar constraints. Contratos acima ainda precisam ser implementados e homologados.
