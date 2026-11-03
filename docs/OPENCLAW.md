# OpenClaw

A imagem oficial `ghcr.io/openclaw/openclaw:2026.10.9` está fixada pelo digest `sha256:1a2a3ce113e435039dbeac5ae261759bb4759908563d91c81059e896b38c5d98`. Ela usa Node 24.22.1; API e frontend permanecem em Node 22.22.3. A separação evita incompatibilidade de runtime.

## Operação local

API e worker devem executar no mesmo host Docker nesta topologia. PostgreSQL e Redis são necessários. Configure `RUNTIME_ENCRYPTION_KEY` (32 bytes em hex), `REDIS_URL` e a credencial do provedor. Execute `npm run build`, `npm run dev:api`, `npm run dev:worker` e `npm run dev:web`. A chave de criptografia precisa ser igual na API/worker e preservada em backups.

Em **Modelos e ambientes**, um OWNER/ADMIN solicita o ambiente. A API registra operação e enfileira; o worker cria recursos isolados e verifica `GET /v1/models` com autenticação antes de READY. Uma nova tentativa recupera um runtime FAILED. Não use um gateway global compartilhado como substituto do isolamento.

## Isolamento e publicação

Cada runtime recebe rede bridge própria, volume próprio, container não root, CPU/memória/PIDs limitados, filesystem raiz read-only, capacidades removidas e `no-new-privileges`. Só a porta loopback é publicada. O container não recebe socket Docker ou diretórios do host. O worker precisa de acesso Docker e é componente administrativo confiável.

Token aleatório por runtime, criptografado com AES-256-GCM e AAD da organização. A API não retorna token, URL interna ou ciphertext. Chaves dos provedores vêm do ambiente administrativo e não do navegador. Na estratégia atual, a chave de plataforma pode ser usada por mais de uma organização, mas os tokens de gateway e volumes são exclusivos.

Cada versão vira um agente `v-<versionId>` com workspace próprio e arquivos de instruções. O worker interrompe o gateway sem execuções em andamento, grava configuração controlada, inicia e verifica a versão na lista autenticada de modelos. O chat direciona o modelo para esse agente. Ferramentas nativas de alto risco, browser e skills ficam bloqueados. Ferramentas locais do Builder não são silenciosamente convertidas em permissões OpenClaw.

Health monitor verifica a cada 30 segundos. Desativação remove container/rede, revoga token e suspende deployments; o volume é preservado para retenção/backup, nunca reutilizado por outro runtime. O teste descarta seus próprios volumes ao terminar.

## Limites de implantação

A rede por organização e o bloqueio de ferramentas não equivalem a uma allowlist de egress por domínio. Produção requer política de saída no host/proxy, backup, rotação de credenciais, observabilidade e homologação de carga. Não há suporte a múltiplos hosts de provisionamento nesta versão. Cancelar o HTTP interrompe o cliente; término de trabalho interno do gateway depende do suporte da versão OpenClaw.

`npm run test:openclaw` usa schema e fila isolados, gateway real e, quando há credencial, uma chamada curta ao modelo. Não equivale a um teste de penetração ou homologação completa de produção.

Referências verificadas: [HTTP API](https://docs.openclaw.ai/gateway/openai-http-api), [Docker](https://docs.openclaw.ai/install/docker), [multi-agent](https://docs.openclaw.ai/concepts/multi-agent/index.html), [política de plugins](https://docs.openclaw.ai/plugins).
