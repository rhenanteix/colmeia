# Segurança — pendências bloqueantes para produção

1. Implementar login OIDC/JWKS, emissão e rotação de sessões; checar membership ativa no banco em toda request.
2. Provisionar e testar runtime OpenClaw em sandbox isolado; não expor daemon Docker nem gateway sem autenticação.
3. RLS com política e contexto de tenant por transação, testes de isolamento, cross-tenant e RBAC.
4. Vault/KMS para BYOK, não salvar segredo bruto no banco; nunca logar credenciais.
5. Rate limiting, audit de mutações, idempotência, limites de execução e budgets antes de cobrar.
6. CSP, CSRF conforme cookies/sessões, validação de uploads, SSRF egress filtering.
7. Testes de restauração, scanner de dependências e revisão LGPD.

**Não colocar em produção este scaffold.**

## Execução multimotor

Sem código arbitrário na calculadora, sem comandos/URLs de ferramentas enviados pelo cliente. Limites de etapas, tokens, duração, concorrência por conversa e execução mensal. Saída em Markdown sem HTML bruto e sem imagens remotas. Erros de provedores não retornam corpo bruto nem segredos; logging interno do Mastra é desativado em favor dos eventos seguros da aplicação.

OpenClaw usa AES-256-GCM com AAD do tenant, tokens exclusivos, imagem fixada, volumes/redes exclusivos e gateway loopback. A API não serializa credenciais. O processo worker é administrativo e não recebe comandos do usuário. Produção ainda precisa de egress explícito e proteção do host Docker.
