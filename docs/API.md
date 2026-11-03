# API P0

Base `/api/v1`. Swagger em `/api/docs`. O frontend usa `/api/backend`, que encaminha para a API com a sessão HttpOnly. Todas as rotas abaixo, exceto cadastro/login/recuperação/health, exigem sessão válida.

| Método | Rota | Comportamento |
| --- | --- | --- |
| POST | /auth/register | name, email, password (12–128), organizationName |
| POST | /auth/login | email, password |
| GET | /auth/me | Usuário, memberships, organização ativa e papel |
| POST | /auth/logout | Revoga sessão atual |
| POST | /auth/refresh | Consome sessão e emite outra |
| POST | /auth/switch | organizationId; exige membership |
| POST | /auth/password-reset/request | email; resposta genérica |
| POST | /auth/password-reset/confirm | token, password |
| GET/POST | /organizations | Lista próprias / cria organização com name e slug |
| PATCH | /organizations/active | Edita name e slug; OWNER/ADMIN |
| GET | /team/members | Membros do tenant |
| PATCH/DELETE | /team/members/:id | Altera papel (role e email) / remove; proprietário protegido |
| GET/POST | /team/invitations | Lista / cria (email e role) |
| POST | /team/invitations/:id/resend | Rotaciona token e reenvia |
| POST | /team/invitations/:id/revoke | Revoga convite pendente |
| POST | /team/invitations/accept | token; email autenticado deve coincidir |
| GET | /dashboard | organization, stats, agents, activity |
| GET/POST | /agents | Lista / cria com name, description?, mascot?, templateId? |
| GET/PATCH | /agents/:id | Consulta / edita identidade |
| POST | /agents/:id/archive | Soft delete preservando histórico |
| GET | /templates | Oficiais e personalizados do tenant |
| GET/POST | /builder/:agentId | Recupera / salva config e revision |
| GET/POST | /builder/:agentId/versions | Histórico / snapshot validado do rascunho salvo |
| POST | /agents/:id/publish | 409 enquanto OpenClaw não estiver integrado |

Conflitos de revisão retornam 409, referências a agentes de outro tenant retornam 404, papel insuficiente retorna 403, sessão inválida retorna 401. Create/save retornam 201. Campos desconhecidos em DTOs de transporte são rejeitados. A configuração de rascunho preserva chaves extensíveis; campos conhecidos são validados quanto ao tipo e tamanho.

Rotas preexistentes de canais, tarefas, aprovações, consumo e Bee Teams permanecem disponíveis. Elas não representam integração operacional completa com OpenClaw.

## Sprint 6 — estabilização (01/11/2026)

- `POST /tasks`: `assignedTo`, quando informado, deve ser UUID de usuário com Membership na organização ativa. UUID inválido ou responsável externo retorna 400; VIEWER retorna 403. Criação e `task.created` são transacionais; a verificação bloqueia a membership durante a criação. Payload permanece `{title, description?, assignedTo?}`.
- `POST /approvals/:id/decision`: exige OWNER/ADMIN e decision `approved` ou `rejected`. A escrita exige tenant correspondente, pending e expiresAt futuro. Expirada, inexistente, externa ou já decidida retorna 409; decisão inválida 400. Decisão e auditoria são uma transação. Aprovação aqui não dispara automaticamente workflow.
- `Agent.status=ACTIVE` significa configuração publicada. A interface usa “Publicado”; não certifica disponibilidade contínua do provedor.
- Inventário completo e limites de cobertura: [SPRINT_6_AUDIT.md](SPRINT_6_AUDIT.md).
