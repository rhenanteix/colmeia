# Colmeia P0 — controle de entrega

## Implementado

- [x] Cadastro/login, Argon2id, sessões HttpOnly e revogação.
- [x] Expiração/renovação, recuperação de senha e proteção CSRF.
- [x] Organizações, workspaces, membros, convites e RBAC.
- [x] Dashboard real, auditoria, cache e navegação responsiva.
- [x] Design system shadcn/Radix com tokens e componentes integrados.
- [x] Builder, mascotes, configurações, rascunhos concorrentes, versões e restauração.
- [x] Templates isolados e seed oficial idempotente.
- [x] Arquivamento e publicação indisponível comunicados corretamente.
- [x] Serviços extraídos dos controllers centrais.
- [x] Migrations e constraints multi-tenant, sem reset do banco.
- [x] Testes unitários, PostgreSQL real, E2E e verificações axe.
- [x] Pipeline CI atualizado com integração e navegador.

## Antes de produção

- [ ] Configurar e homologar o provedor de email transacional.
- [ ] Homologar infraestrutura, proxy e limites de requisições; adotar armazenamento distribuído se houver múltiplas réplicas.
- [ ] Testar carga, backups/restauração, acessibilidade manual e navegadores adicionais.
- [ ] Definir política operacional de retry/outbox para entrega de emails.

## Integrações futuras previstas no produto

- OpenClaw, implantação efetiva, ferramentas externas, RAG, filas duráveis da colaboração e billing completo. Não estão simulados como recursos operacionais.
