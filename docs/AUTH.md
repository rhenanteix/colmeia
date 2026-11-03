# Autenticação e autorização

O navegador recebe somente cookie `colmeia_session`, HttpOnly, SameSite=Lax, Secure em produção, Path=/ e duração de 8h. Tokens não são armazenados em localStorage/sessionStorage. O BFF remove tokens dos corpos de login/cadastro/switch/refresh e rejeita mutações sem Origin igual à origem do Next. A API aceita Bearer para clientes de servidor.

Cada JWT contém sub, organizationId, jti, emissor, audiência e expiração. JwtGuard verifica assinatura, sessão no PostgreSQL, expiração/revogação, usuário e membership atual. Alterar role ou remover membership tem efeito imediato, sem confiar no papel declarado pelo cliente. Cookies sozinhos não autorizam operações.

Login usa Argon2id; hashes scrypt existentes continuam verificáveis para compatibilidade. Logout revoga a sessão. Renovação consome a sessão anterior por compare-and-set e emite outra. O shell solicita renovação a cada 30 minutos. A recuperação usa PasswordResetToken com SHA-256, validade de 30 minutos, consumo atômico e revogação das sessões/tokens anteriores. Respostas de solicitação são idênticas para email existente e inexistente; falhas de entrega são registradas sem token ou email.

## Matriz

| Ação | OWNER | ADMIN | MEMBER | VIEWER |
| --- | --- | --- | --- | --- |
| Ver dashboard/agentes/histórico | Sim | Sim | Sim | Sim |
| Criar/editar agente e rascunho | Sim | Sim | Sim | Não |
| Criar versão de configuração | Sim | Sim | Sim | Não |
| Solicitar publicação | Sim | Sim | Não | Não |
| Editar organização | Sim | Sim | Não | Não |
| Convidar/gerenciar membros | Sim | Sim | Não | Não |

MEMBER pode editar todos os agentes da organização ativa. OWNER é protegido contra remoção/rebaixamento pelo fluxo de membros. Transferência de propriedade não está implementada. Qualquer usuário autenticado pode criar uma organização e torna-se seu OWNER.

CORS restrito a WEB_ORIGIN. Rate limit de autenticação: 15 requisições/minuto por rota/IP; consulta de sessão e limite geral: 120. O armazenamento do limiter é local ao processo; em múltiplas réplicas será necessário armazenamento distribuído e configuração confiável dos proxies. Pino não registra headers de credenciais nem corpos; query strings são omitidas.

Email de desenvolvimento fica em diretório privado, sem imprimir tokens no console. Webhook real é configurável, mas depende de credenciais e homologação do operador. Não há outbox/retry assíncrono de email neste ciclo.
