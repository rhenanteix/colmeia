# Colmeia Teams

## Colaboração humana independente de IA

- Canais da organização com mensagens persistidas no PostgreSQL e autoria identificada.
- DMs entre dois membros. Somente participantes podem listar ou consultar a conversa, mensagens, eventos e repasses; ADMIN não ganha acesso automático.
- Respostas em thread referenciam uma mensagem raiz no mesmo canal/tenant. Uma chave estrangeira composta impede referências entre canais também no banco.
- Menções selecionadas na interface são validadas contra os membros da organização e participantes da DM. Mensagem e notificações são gravadas na mesma transação.
- Notificações individuais por menção, DM ou resposta; leitura idempotente e restrita ao destinatário.
- Presença: heartbeat a cada 30 segundos enquanto Teams está aberto; atividade de até 90 segundos aparece como Online. Não representa conexão permanente nem presença em todas as páginas.
- Histórico paginado por cursor, ordenado por data e ID para estabilidade mesmo com timestamps iguais.
- Eventos de canais e notificações chegam por SSE usando cookie HttpOnly via BFF. Sessão e membership são revalidados durante o stream. EventSource reconecta após interrupção de rede.

## API

| Operação | Endpoint |
|---|---|
| Listar/criar canais | `GET/POST /channels` |
| Abrir ou reutilizar DM | `POST /channels/direct` com `userId` |
| Histórico | `GET /channels/:id/messages?before=:messageId` |
| Respostas | `GET /channels/:id/messages?parentId=:messageId` |
| Enviar mensagem/resposta | `POST /channels/:id/messages` com `body`, `parentId?`, `mentionIds?` |
| Presença/heartbeat | `GET/POST /channels/presence` |
| Notificações | `GET /notifications`, `GET /notifications/events` |
| Marcar como lida | `POST /notifications/:id/read` |

Todos os endpoints acima ficam em `/api/v1` na API e exigem sessão válida. VIEWER consulta, mas não cria canais, DMs ou mensagens. Presença pode ser atualizada por qualquer membro autenticado.

## Agentes preservados

O mapa usa os oito mascotes existentes. Mensagens humanas, respostas de agentes e eventos de repasse são apresentados separadamente. Rascunhos aparecem como ainda não publicados. Os adapters e o endpoint de handoff foram preservados; esta homologação não executa IA.

O processador legado de handoffs continua em memória e depende de provedor configurado. Sua migração para worker durável está pendente. Não confundir uma solicitação na fila com uma resposta de agente concluída.

## Evidência e limites

`tests/p0.integration.mjs` cobre privacidade entre usuários/tenants, FK de threads, menções, notificações, presença, SSE e paginação com 105 mensagens. `tests/e2e/teams.spec.ts` usa dois usuários/navegadores reais para envio, persistência após reload, threads, DM, menção e notificação ao vivo. Resultados e comandos estão em `INDEPENDENT_SPRINTS.md`.

SSE consulta PostgreSQL a cada 1,2s para canais e 2s para notificações. Não há pub/sub Redis neste fluxo; dimensionamento e carga ainda não foram homologados. A seleção de menções é explícita, sem parser automático de `@nome`.
