# Agent Builder

Rota `/app/agents/:id/builder`. Etapas: identidade, papel/personalidade, inteligência, conhecimento, ferramentas e revisão. Mascotes oficiais são selecionáveis e persistidos. Identidade e rascunho são salvos na mesma transação; criação a partir de template também é transacional.

Salvamento manual e autosave após 1,5 segundo exigem revision. Um conflito retorna 409, interrompe tentativas automáticas e mantém o conteúdo local; a mensagem orienta copiar alterações antes de recarregar. Há aviso de alterações não salvas na saída e no reload. O E2E independente de IA verifica autosave e persistência após reload.

Criar versão salva o rascunho, valida instruções (mínimo 10 caracteres) e modelo preenchido, cria snapshot imutável com sequência/autor/data e registra auditoria. O histórico permite restaurar configuração localmente e salvar como novo rascunho. Não sobrescreve a versão anterior.

A prévia informa estado e revisão. Upload/RAG e ferramentas não conectadas são descritos como indisponíveis. Conhecimento textual fica salvo como configuração; nenhum documento é ingerido. Modelo digitado, variação das respostas, limite de tokens, limite mensal e aprovação humana são configuração desejada persistida. Limites são validados no backend, mas compatibilidade do modelo e aplicação operacional dependerão do runtime; não há validação remota de credenciais ou disponibilidade.

A publicação retorna conflito enquanto o adaptador não existir, mesmo se houver um registro de runtime READY legado. Não há falsa mensagem de execução ou implantação concluída. O histórico inclui resumo opcional e comparação textual com os campos do rascunho atual.

## Atualização multimotor

Autosave de 1,5 segundo com revisão otimista; conflitos interrompem novas tentativas automáticas e preservam a edição local. Trocar de agente remonta o editor para evitar salvar configurações no agente errado. Edição durante salvamento fica desabilitada.

A etapa Inteligência seleciona Mastra (padrão), AI SDK direto ou OpenClaw, provedor e modelo. O modelo inicial é gpt-4.1-mini. Ferramentas são allowlist do servidor. Cada versão no histórico possui ação de publicação; OpenClaw mostra implantação solicitada e o andamento fica em Modelos e ambientes.
