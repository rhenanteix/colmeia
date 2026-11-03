# ADR-002: Autenticação e integração de runtime

- A API exige JWT HS256 com `iss=colmeia`, `aud=colmeia-api`, `sub`, `organizationId`, `role`. **Somente desenvolvimento**: não há emissor de token implementado. Não expor à produção.
- Antes de produção substituir pelo fluxo OIDC/JWKS com emissor confiável, validação de membership no banco e política de revogação. Claims de tenant e role assinadas não substituem validação de membership atual.
- O adapter OpenClaw atual não comprova compatibilidade com uma versão real. Provisionamento é registrado, não executado; publicação não declara sucesso sem runtime READY.
- Isolamento do tenant precisa incluir storage, filas, runtime, rede e secrets. RLS/migrations pendentes.
