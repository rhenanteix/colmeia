# AI SDK e conversas

AI SDK 7.0.159 e `@ai-sdk/react` fornecem modelo e transporte de UI. O Next.js utiliza `useChat` com `DefaultChatTransport`. A requisição contém apenas texto e um UUID de idempotência. A API recupera a versão publicada e o histórico do banco; não confia em mensagens de sistema ou ferramentas enviadas pelo navegador.

Fluxo: navegador → BFF com cookie HttpOnly e validação de Origin → NestJS/JwtGuard → contexto de organização → Runtime Manager → adaptador → eventos SSE → UI. O BFF preserva `x-vercel-ai-ui-message-stream: v1`, não armazena cache e encaminha abortos.

Há conversas novas, busca/filtro, renomeação, arquivamento, reenvio, cancelamento e Markdown sem HTML bruto ou imagens remotas. Mensagens parciais persistem a cada fragmento; execuções registram erros e status final. Ferramentas e uso aparecem no stream e no histórico de eventos das execuções. Ao reabrir o chat, as mensagens são carregadas do PostgreSQL.

O motor direto AI SDK é opcional; Mastra e OpenClaw compartilham o mesmo protocolo de UI. Não são feitas três chamadas para uma resposta. Chaves ficam em variáveis privadas da API e do worker.

Limites atuais: histórico de UI de até 500 mensagens; contexto de até 40 mensagens completas; listagens de até 100 conversas/execuções. Não há retomada automática de um stream interrompido; a resposta parcial fica disponível e pode ser reenviada. Arquivamento preserva auditoria.
