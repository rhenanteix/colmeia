# Eventos de Teams

O navegador usa EventSource com cookie HttpOnly pelo BFF. Nenhum token vai na URL. O BFF transmite o stream da API autenticada.

- `/bee-team/channels/:id/events`: snapshot de último ID de mensagem e repasses a cada 1,2s.
- `/notifications/events`: notificações do destinatário a cada 2s.
- Antes de cada consulta, o backend confirma sessão não revogada/não expirada e membership atual. Canais privados exigem participação também durante o stream.
- O cliente reconecta pelo comportamento de EventSource; snapshots recuperam mudanças ocorridas durante desconexão. Não há replay por Last-Event-ID.
- Desconexão libera o Observable e encerra seu intervalo. Erro de acesso interrompe a atualização de dados; a interface de canais fecha o stream ao receber erro.

Mensagens de pessoas independem dos motores de IA. O processador legado de handoffs permanece em memória e não foi homologado nesta execução. BullMQ/pub-sub para estes eventos e testes de carga permanecem pendentes. Consulte `INDEPENDENT_SPRINTS.md` para evidências atuais.
