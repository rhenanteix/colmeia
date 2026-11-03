# Revisão visual da Colmeia

Implementação local: página inicial, dashboard, navegação, login, progresso do onboarding e estilos compartilhados de formulários, cards, chat, configuração de agentes e diálogos.

## Validação

- TypeScript do frontend e build de produção: passaram.
- Chrome headless: 64 combinações de oito rotas e oito larguras, sem overflow horizontal e sem erros JavaScript.
- Rotas: /, /login, /cadastro, /recuperar, /onboarding, /app, /app/agents, /app/channels.
- Larguras: 320, 375, 390, 430, 768, 820, 1024 e 1440 px; altura de 900 px.
- Menu móvel: abre e apresenta os links nas larguras até 850 px.
- Movimento reduzido: animação da cena de abelhas desativada.
- Capturas: landing e dashboard em 390 e 1440 px.

As requisições de API foram interceptadas no navegador com dados de demonstração, sem alterar banco ou contas. Esta verificação cobre apresentação, não autenticação, persistência ou execução de agentes. Não foram realizados testes em aparelhos físicos, Safari/WebKit ou em todos os modelos de iOS/Android.
