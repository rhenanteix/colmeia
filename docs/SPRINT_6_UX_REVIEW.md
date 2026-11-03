# Sprint 6 — revisão UX/UI

## Evidência

Playwright/Chrome: **15 aprovados, 3 ignorados, 0 falhas**, desktop (1280×720), tablet (820×1180), mobile (perfil iPhone 13/Chromium). Fluxos: cadastro, login/reset/logout, troca de organização, busca de página, builder/autosave/reload/versão, Teams entre dois contextos autenticados, threads/DM/menções/notificações e tarefas. Testes Axe WCAG 2 A/AA e 2.1 AA passaram nas páginas verificadas de dashboard, builder e tarefas; não é certificação de acessibilidade integral.

Capturas geradas em `test-results/{dashboard,builder,teams,tasks}-{desktop,tablet,mobile}.png`. Inspeção visual direta nesta sessão: dashboard-desktop, teams-tablet e tasks-mobile. Não houve inspeção manual de todas as combinações de tela/estado.

## Ajustes

- Tarefas agora usam TanStack Query e o cliente de API existente, com carregamento, recuperação de erro, estado vazio e feedback de criação/atualização.
- Formulário com rótulo, min/max, envio por teclado, estado ocupado e seletor de status acessível. VIEWER não recebe controles de escrita; autorização continua no backend.
- Mensagens de erro seguem o cliente comum; respostas HTML/internas não são exibidas diretamente.
- Dashboard/lista chamam ACTIVE de “Publicado”, evitando inferência de saúde do runtime. Mascotes/identidade grafite/amarelo preservados.
- Lista de agentes aguarda papel autorizado antes de mostrar criação/arquivo.

## Ressalvas

- Aprovações e consumo ainda têm telas explícitas de pendência. Não homologadas como jornadas completas.
- Kanban, arquivos, Wiki, workflows e billing não possuem jornadas completas a revisar.
- Modelos expõe estado/configuração, mas credencial presente não prova disponibilidade. Ollama aparece como configurado por padrão; isso não é health check.
- Builder não oferece todos os estados operacionais solicitados. Não foi inserida animação de execução falsa; BeeScene do dashboard é decorativa, aria-hidden, sem representar jobs.
- E2E Teams prova recebimento entre usuários sem refresh e persistência após reload; queda/reconexão/restart completos ainda precisam de teste dedicado.
- A revisão não cobre todos os menus, modais, tabelas, estados de erro, textos de comprimento máximo ou navegação em todos os browsers.

Resultado: **APROVADO COM RESSALVAS para os fluxos testados; NÃO TESTADO para funcionalidades ausentes/estados não exercitados**.
