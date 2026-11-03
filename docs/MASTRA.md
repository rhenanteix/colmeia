# Mastra

Mastra 1.81 integra agentes dinâmicos no NestJS. Cada execução instancia um Agent identificado pela versão imutável, com instruções, modelo e ferramentas aprovadas. O modelo vem dos provedores do AI SDK; não há uma segunda chamada ao modelo para converter o stream.

`MastraAdapter` traduz `text-delta`, chamadas/resultados de ferramentas e uso para `AgentEvent`. O limite é cinco etapas, até 16.384 tokens de saída e 90 segundos de duração por execução (configurável para menos). O serviço de conversas persiste contexto e eventos; os últimos 40 turnos completos são enviados ao modelo. Não há memória vetorial ou RAG.

Ferramentas disponíveis: data/hora UTC, calculadora de quatro operações, nome da organização autorizada e identidade da própria versão. Não aceitam IDs de outras organizações, código, URLs ou comandos. Configurações desconhecidas são rejeitadas na publicação. Erros retornam mensagem segura, sem corpo bruto do provedor.

Validação: `npm run test:runtime` usa um provedor HTTP local declarado como fixture. `npm run test:live` usa a chave privada do ambiente e gpt-4.1-mini, incluindo calculadora, publicação, persistência e eventos. Evidência real, quando aprovada, é gravada em `artifacts/verification/live-models.json`.

Workflows empresariais customizados e memória durável específica do Mastra não foram adicionados; a composição disponível é o loop de ferramentas limitado com histórico no PostgreSQL.
