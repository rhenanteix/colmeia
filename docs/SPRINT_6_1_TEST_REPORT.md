# Sprint 6.1 — testes em andamento

Evidências locais em `artifacts/sprint-6.1/`.

- Migration aplicada no schema isolado `colmeia_p0_test` e no schema `colmeia_p0_e2e`; schema principal não usado para homologação.
- Integração: cinco testes aprovados, incluindo novo cenário de Kanban (disputa de revisão, isolamento HTTP/FK, segundo membro, leitor, comentários, filtros e arquivo).
- Unitários: 16 aprovados; legados: 12 aprovados.
- Typecheck API e web, ESLint e build completos passaram na implementação inicial. Repetir após alterações finais.
- E2E inicial encontrou seletor incorreto para o quadro. Correção em andamento; não homologado ainda.

Falhas corrigidas: criação nested das colunas com campo composto rejeitado pelo Prisma, substituída por transação explícita; detecção de campos opcionais undefined no DTO causava rejeição do PATCH legado.

## Atualização 02/11/2026

Kanban: seis E2E aprovados em desktop/tablet/mobile (`e2e-kanban.log`). Verificados DnD desktop, alternativa por select, edição de detalhes, comentários, persistência, histórico, arquivamento/restauração, axe e largura de viewport. Falhas iniciais eram seletores que incluíam texto interno de select/textarea; corrigidos com seletores por role/nome acessível. Uma execução intermediária teve build alterado enquanto o servidor servia chunks; nova execução com build estável passou.

Integração ampliada: seis cenários aprovados; o novo cenário verifica aprovador MEMBER designado, negativa ao administrador não designado, corrida de decisão, notificação, alteração da tarefa, cancelamento, expiração e rollback para tarefa desatualizada.
