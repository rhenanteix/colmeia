# Multi-tenancy

A organização vem da sessão autenticada e da membership atual, nunca de um campo de payload. Consultas a agentes, versões, conversas, execuções, convites e runtimes filtram o tenant. Recursos de outra organização retornam 404; papéis insuficientes retornam 403.

As tabelas novas têm FKs compostas de organização: conversa→agente, mensagem→conversa, execução→conversa e evento→execução. Deployment liga a versão ao mesmo agente e o agente à organização. Não há RLS; guard, serviços e constraints são camadas complementares.

As versões são snapshots. A publicação resolve o versionId dentro do agente autorizado, impedindo troca de versão entre tenants. Ferramentas recebem apenas o contexto da organização e do agente já resolvidos pelo servidor.

OpenClaw acrescenta isolamento de processos, volume, rede e token, além do registro organizationId. Segredos criptografados são autenticados com o tenant como AAD; copiar ciphertext para outra organização falha na decifragem.

`test:integration` e `test:runtime` cobrem leituras e escritas negativas entre organizações. O runner usa schemas separados, nunca reset do schema público.
