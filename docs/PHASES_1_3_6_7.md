# Escopo entregue e limites de homologação

## Fase 1
Código de cadastro/login local com scrypt e JWT de 8h, seleção de tenant verificada em membership, convites com tokens de uso único, recuperação de senha (token apenas em log de desenvolvimento), esquema Prisma e infraestrutura existente. **Não homologado em banco real**; para produção migrar a autenticação para sessão em cookie HttpOnly, configurar SMTP, rate limit, MFA e política de senhas.

## Fase 3
API de rascunho de agentes, templates, versões existentes, tela Builder e configuração conceitual de modelo. Sem deploy real OpenClaw, BYOK operacional ou RAG.

## Fase 6
Landing existente, cadastro, login, onboarding persistente, dashboard existente, gestão de equipe, tarefas. Checkout, faturamento e suporte não implementados.

## Fase 7
Canais/mensagens persistentes, equipe, convites, tarefas e notificações via API. Não há realtime, menções automáticas, roteamento de agentes ou chats com runtime real.

## Execução
1. Copie `.env.example` para `.env` e defina segredo JWT >=32 caracteres.
2. Inicie PostgreSQL e Redis conforme `infrastructure/docker/docker-compose.yml`.
3. `npm install` (requer internet)
4. `npm run db:generate` e `npm run db:migrate`
5. `npm run dev:api` e `npm run dev:web`
6. Abra `/cadastro`, registre empresa e acesse `/app`.

**Aviso:** não execute em produção sem instalar dependências, compilar, migrar banco, testar fluxos e realizar auditoria de segurança.
