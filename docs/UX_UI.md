# UX/UI

Grafite profundo, amarelo-mel, tipografia clara e os oito mascotes pixel art oficiais. Dashboard contextual com dados reais, agentes, auditoria e próximos passos. Builder em três colunas no desktop e empilhado no mobile.

Shell: organização ativa, logout, breadcrumbs, rota ativa, busca com Cmd/Ctrl+K, notificações reais e avatar. Navegação mobile recolhível. Catálogo com busca, filtro, ordenação, paginação local e confirmação acessível de arquivamento.

Design system em `components/ui`, configurado por `components.json`: Button, Input, Textarea, Select, Checkbox, Switch, Dialog, Drawer, DropdownMenu, Tooltip, Tabs, Card, Badge, Avatar, Table/DataTable, Skeleton, Toast/Sonner, Breadcrumb, Command, AlertDialog/ConfirmDialog, PageHeader, Stepper e feedback de erro/vazio. Componentes oficiais shadcn/Radix foram integrados aos formulários, tabela de membros, etapas, busca e confirmações. Utilitário de classes centralizado em `lib/utils.ts`.

Tokens de cores, tipografia, espaçamento, raios, sombra, motion e camadas em globals.css; breakpoints responsivos preservados. Tailwind usa layers para que componentes reutilizáveis convivam com o layout legado. Motion e CSS respeitam movimento reduzido. Formulários usam labels, foco visível, estados ocupados/disabled e mensagens de erro.

E2E com axe verificou dashboard e builder em desktop/tablet/mobile, sem violações nas regras WCAG A/AA examinadas. Capturas reais em `test-results/dashboard-{desktop,tablet,mobile}.png` e `builder-{desktop,tablet,mobile}.png`. A referência externa não abriu pela ferramenta; o redesign preservou os assets e a identidade já fornecidos no repositório.

Validação manual com leitores de tela e navegadores adicionais permanece como homologação de produção.
