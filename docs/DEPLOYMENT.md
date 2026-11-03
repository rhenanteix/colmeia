# Execução e implantação

Use npm workspaces e Node 22.22+. PostgreSQL deve receber `npm run db:deploy`; nunca use `db push` para substituir migrations. `npm run db:seed` mantém templates oficiais. A imagem OpenClaw está fixada e executa seu próprio Node.

Variáveis privadas: `DATABASE_URL`, `AUTH_JWT_SECRET`, `REDIS_URL`, `OPENAI_API_KEY` ou fallback `COLMEIA_AI_API_KEY`, `ANTHROPIC_API_KEY`, `RUNTIME_ENCRYPTION_KEY`, `RUNTIME_QUEUE_NAME`. `OPENAI_BASE_URL` é override administrativo; deixe vazio para OpenAI oficial. `EXECUTION_TIMEOUT_MS` é limitado a 1–90 segundos. O modelo inicial é gpt-4.1-mini.

Comandos: `npm run dev:api`, `npm run dev:web`, `npm run dev:worker` (requer build do worker). O frontend encaminha pelo BFF para `API_INTERNAL_URL`. Nunca exponha essas variáveis com prefixo NEXT_PUBLIC.

API/worker devem compartilhar host para o gateway loopback da implementação atual. O worker precisa do CLI Docker e da imagem oficial disponível. Frontend e API podem ser implantados separadamente; o worker de provisionamento não deve ser executado em uma função serverless comum sem Docker.

Produção requer TLS, CORS/Origin corretos, segredo JWT forte, email real, backup e restauração de PostgreSQL/volumes/chave de criptografia, política de egress, rate limiting distribuído e monitoramento. Limites locais e testes funcionais não substituem testes de carga.

`test:live` e `test:openclaw` fazem chamadas pagas curtas quando uma chave real está configurada. Os demais testes de IA usam um servidor local declarado como fixture; a fixture nunca é importada pela aplicação.
