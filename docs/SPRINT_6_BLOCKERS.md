# Sprint 6 — bloqueios e lacunas

## Lacunas internas (impedem aceite global)

- Workflows determinísticos/agendamentos/webhooks inexistentes. Redis do runtime não os substitui.
- Kanban completo, arquivos, Wiki, busca convencional, OAuth/conectores genéricos ausentes.
- Planos/assinaturas/Stripe e quotas comerciais ausentes; nenhuma credencial habilita um módulo ainda não implementado.
- Aprovações/consumo sem UI integrada; cancelamento/aprovação/retomada empresarial pendentes.
- Dashboard sem métricas completas e filtros temporais.
- Homologação de crash recovery, jobs recorrentes, efeitos externos idempotentes, backups/restauração, métricas e monitoramento completo pendente.
- Teams sem edição/exclusão de mensagens e gestão completa de canais; reconexão/perda de rede e restart não cobertos integralmente.

## Dependências externas não homologadas

- OpenAI/Anthropic/Ollama e OpenClaw reais: não chamados nesta rodada; contratos usam fixture explicitamente identificada. Não afirmar falta de créditos sem chamada ou evidência.
- Entrega de email externa: testes usam arquivos privados locais.
- Stripe: não integrado; nenhum pagamento ou cobrança real executado.
- CI remoto e ambiente de produção: não executados; diretório sem Git.

## Restrições resolvidas

Acesso PostgreSQL no sandbox falhou; runner autorizado fora do sandbox passou. Usado Chrome instalado via PLAYWRIGHT_CHANNEL=chrome. npm não removeu automaticamente Prisma 7 aninhado; manifest/lock corrigidos e cópia antiga movida para /private/tmp/colmeia-s6-prisma-client-7-backup, preservada. Árvore final resolve Prisma 5.22.0 compartilhado. Nenhuma interrupção por créditos de IA.
