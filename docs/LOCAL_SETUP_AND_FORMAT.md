# Instalação, correções e formatação — v0.8

## Pré-requisitos
Node.js 22, npm 10, Docker Desktop, acesso ao npm registry.

```bash
npm install
npm run db:validate
npm run db:format
npm run format
npm run format:check
docker compose -f infrastructure/docker/docker-compose.yml up -d
npm run db:generate
npm run db:migrate
npm run typecheck
npm run build
npm test
npm run dev:api
# em outro terminal: npm run dev:web
```

A instalação cria `package-lock.json`; faça commit dele para que o GitHub Actions possa executar `npm ci`.

**Atenção:** os quatro erros TS2322 relatados foram corrigidos com `Prisma.InputJsonValue` e valor padrão para `description`. O Prisma schema tinha declarações compactadas inválidas; blocos `generator`, `datasource` e `enum` foram corrigidos.

O Prettier 3 foi adicionado à raiz do monorepo, com `format`, `format:check`, `.prettierrc.json`, `.editorconfig` e configuração de VS Code. Execute `npm run format` após `npm install` para reformatar **todo o projeto**. O Prettier não pôde ser executado neste ambiente porque o npm registry estava indisponível.

**Limitações:** build completo, migrations e testes integrados ainda precisam ser executados em máquina com dependências instaladas. Não confundir a correção dos erros reportados com homologação do sistema inteiro.
