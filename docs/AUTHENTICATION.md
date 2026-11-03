# Autenticação

A implementação existente usa Argon2id, JWT curto associado a sessão persistida e membership consultada a cada requisição. O BFF entrega cookie HttpOnly, SameSite=Lax e Secure em produção. Operações com cookie exigem Origin do próprio frontend. O token não fica em localStorage/sessionStorage.

Renovação revoga a sessão anterior. Logout e recuperação de senha revogam sessões no banco. Tokens de recuperação e convites são hasheados, temporários e de uso único. Email usa adaptador privado de desenvolvimento ou webhook HTTPS configurado.

Conversas, execuções, publicação e runtimes usam JwtGuard e RBAC no NestJS. VIEWER pode consultar, mas não criar mensagens nem iniciar/cancelar execuções. OWNER/ADMIN publicam e provisionam. O frontend não é uma fronteira de autorização.

Veja `AUTH.md` para os fluxos originais. O rate limiting existente é por processo; múltiplas réplicas exigem armazenamento distribuído. Sessões são verificadas na abertura do stream; não há revalidação contínua da sessão durante uma geração limitada a 90 segundos.
