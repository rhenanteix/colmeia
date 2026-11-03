# Runtime Manager

O contrato independente está em `packages/runtime-core/src/contract.d.ts`: motor discriminado, configuração validada, contexto autorizado, mensagens e eventos tipados. Adaptadores implementam validação e streaming. Provisionamento e implantação são serviços separados; Mastra não recebe métodos de infraestrutura que não utiliza.

Motores: `mastra`, `ai-sdk`, `openclaw`. O registro é explícito no módulo NestJS. A publicação utiliza uma versão já persistida, nunca o JSON arbitrário do POST. Publicações diretas exigem credencial configurada e validam limites. O sucesso da publicação não garante validade comercial da chave ou disponibilidade futura do provedor; isso é confirmado pela execução.

OpenClaw cria implantação PENDING e operação em BullMQ; somente o worker confirma ACTIVE após verificar o agente no gateway real. Runtime e implantação têm estados distintos. Jobs têm ID estável, retry limitado e tratamento de falhas; repetir uma operação concluída permite nova tentativa operacional sem duplicar a versão.

As execuções têm UUID, organização, agente, versão, solicitante, modelo/provedor, timestamps, status, tokens, erro seguro e eventos ordenados. Uma trava PostgreSQL por agente serializa o limite mensal e evita gerações simultâneas na mesma conversa. Pedidos repetidos são rejeitados por requestId.

Cancelamento explícito é persistido e consultado a cada 500 ms, permitindo múltiplas instâncias de API. Desconexão e timeout propagam AbortSignal. Após perda do processo, a próxima solicitação recupera registros RUNNING com mais de 120 segundos como TIMED_OUT. Não há retomada de geração após crash.
