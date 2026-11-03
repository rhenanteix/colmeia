'use client';
import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import Markdown from 'react-markdown';
import { apiRequest } from '../api-client';
import Link from 'next/link';
type Agent = {
  id: string;
  name: string;
  status: string;
  mascot: string;
  engine?: string;
  deployments?: { engine: string }[];
};
type Conversation = { id: string; title: string; agentId: string; agent: Agent };
type StoredMessage = { id: string; role: 'user' | 'assistant'; content: string; status: string };
export default function ConversationsPage() {
  const client = useQueryClient();
  const [selected, setSelected] = useState<string>('');
  const [agentId, setAgentId] = useState('');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const agents = useQuery({ queryKey: ['agents'], queryFn: () => apiRequest<Agent[]>('/agents') });
  const conversations = useQuery({
    queryKey: ['conversations'],
    queryFn: () => apiRequest<Conversation[]>('/conversations'),
  });
  const active = conversations.data?.find((c) => c.id === selected);
  async function create() {
    try {
      setError('');
      const c = await apiRequest<Conversation>('/conversations', {
        method: 'POST',
        body: { agentId },
      });
      await client.invalidateQueries({ queryKey: ['conversations'] });
      setSelected(c.id);
    } catch (e) {
      setError(String(e));
    }
  }
  return (
    <>
      <div className="section-heading">
        <div>
          <span className="eyebrow">CONVERSE COM SUA COLMEIA</span>
          <h1>Conversas</h1>
          <p className="muted">Suas especialistas, com contexto e histórico.</p>
        </div>
      </div>
      {(error || conversations.isError || agents.isError) && (
        <p role="alert">{error || 'Não foi possível carregar suas conversas.'}</p>
      )}
      <div className="conversation-layout">
        <aside className="card conversation-sidebar">
          <label>
            Abelhinha
            <select value={agentId} onChange={(e) => setAgentId(e.target.value)}>
              <option value="">Selecione uma abelhinha</option>
              {agents.data
                ?.filter((a) => a.status === 'ACTIVE')
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
            </select>
          </label>
          <button disabled={!agentId} onClick={create}>
            Nova conversa
          </button>
          <label>
            Buscar histórico
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nome da conversa"
            />
          </label>
          {conversations.isPending && <p role="status">Carregando histórico…</p>}
          {conversations.data
            ?.filter(
              (c) =>
                c.title.toLowerCase().includes(search.toLowerCase()) &&
                (!agentId || c.agentId === agentId),
            )
            .map((c) => (
              <button
                className="secondary"
                key={c.id}
                aria-pressed={selected === c.id}
                onClick={() => setSelected(c.id)}
              >
                {c.title}
                <small>{c.agent.name}</small>
              </button>
            ))}
          {!conversations.data?.length && <p className="muted">Seu histórico aparecerá aqui.</p>}
        </aside>
        <section className="card conversation-panel">
          {active ? (
            <ConversationView
              key={active.id}
              conversation={active}
              onArchived={() => setSelected('')}
            />
          ) : (
            <div className="conversation-empty">
              <img src="/bees/rainha.png" alt="Abelha Rainha" width={140} height={140} />
              <h2>Uma boa conversa começa aqui</h2>
              <p>Selecione uma abelhinha publicada para começar.</p>
              <Link href="/app/agents">Configurar minhas abelhinhas</Link>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
function ConversationView({
  conversation,
  onArchived,
}: {
  conversation: Conversation;
  onArchived: () => void;
}) {
  const stored = useQuery({
    queryKey: ['messages', conversation.id],
    queryFn: () => apiRequest<StoredMessage[]>(`/conversations/${conversation.id}/messages`),
  });
  if (stored.isPending) return <p role="status">Carregando mensagens…</p>;
  if (stored.isError) return <p role="alert">Não foi possível recuperar as mensagens.</p>;
  return <Chat conversation={conversation} initial={stored.data} onArchived={onArchived} />;
}
function Chat({
  conversation,
  initial,
  onArchived,
}: {
  conversation: Conversation;
  initial: StoredMessage[];
  onArchived: () => void;
}) {
  const client = useQueryClient();
  const [input, setInput] = useState('');
  const [actionError, setActionError] = useState('');
  const [title, setTitle] = useState(conversation.title);
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: `/api/backend/conversations/${conversation.id}/stream`,
        prepareSendMessagesRequest: ({ messages }) => {
          const last = messages[messages.length - 1];
          return {
            body: {
              text: last.parts
                .filter((p) => p.type === 'text')
                .map((p) => p.text)
                .join('\n'),
              requestId: last.id,
            },
          };
        },
      }),
    [conversation.id],
  );
  const { messages, sendMessage, status, stop, error } = useChat({
    id: conversation.id,
    transport,
    generateId: () => crypto.randomUUID(),
    messages: initial.map((m) => ({
      id: m.id,
      role: m.role,
      parts: [
        {
          type: 'text' as const,
          text:
            m.content || (m.status !== 'completed' ? 'Resposta interrompida ou indisponível.' : ''),
        },
      ],
    })) as UIMessage[],
    onFinish: () => {
      void client.invalidateQueries({ queryKey: ['conversations'] });
      void client.invalidateQueries({ queryKey: ['messages', conversation.id] });
    },
  });
  const busy = status === 'submitted' || status === 'streaming';
  const lastUser = [...messages].reverse().find((m) => m.role === 'user');
  async function rename() {
    try {
      await apiRequest(`/conversations/${conversation.id}`, { method: 'PATCH', body: { title } });
      await client.invalidateQueries({ queryKey: ['conversations'] });
    } catch (e) {
      setActionError(String(e));
    }
  }
  async function archive() {
    if (!window.confirm('Arquivar esta conversa? O histórico será preservado.')) return;
    try {
      await apiRequest(`/conversations/${conversation.id}`, { method: 'DELETE' });
      onArchived();
      await client.invalidateQueries({ queryKey: ['conversations'] });
    } catch (e) {
      setActionError(String(e));
    }
  }
  return (
    <>
      <header className="conversation-header">
        <img src={`/bees/${conversation.agent.mascot}.png`} width={48} height={48} alt="" />
        <div>
          <h2>{conversation.agent.name}</h2>
          <span className="muted">
            {conversation.agent.deployments?.[0]?.engine ||
              conversation.agent.engine ||
              'Motor indisponível'}{' '}
            ·{' '}
          </span>
          <span className="pill">
            {busy
              ? 'Processando'
              : conversation.agent.status === 'ACTIVE'
                ? 'Disponível'
                : 'Indisponível'}
          </span>
        </div>
      </header>
      <div className="conversation-actions">
        <label>
          Nome da conversa
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} />
        </label>
        <button className="secondary" onClick={rename} disabled={busy || !title.trim()}>
          Renomear
        </button>
        <button className="secondary" onClick={archive} disabled={busy}>
          Arquivar
        </button>
      </div>
      <div className="conversation-messages" aria-label="Mensagens">
        {messages.map((m) => (
          <article className={`chat-message ${m.role}`} key={m.id}>
            <strong>{m.role === 'user' ? 'Você' : conversation.agent.name}</strong>
            {m.parts.map((part, i) =>
              part.type === 'text' ? (
                <Markdown key={i} skipHtml components={{ img: () => null }}>
                  {part.text}
                </Markdown>
              ) : part.type.startsWith('data-') ? (
                <details key={i}>
                  <summary>
                    {part.type === 'data-tool'
                      ? 'Ferramenta'
                      : part.type === 'data-usage'
                        ? 'Uso de tokens'
                        : 'Execução'}
                  </summary>
                  <pre>{JSON.stringify('data' in part ? part.data : {}, null, 2)}</pre>
                </details>
              ) : null,
            )}
          </article>
        ))}
      </div>
      {busy && <p role="status">A abelhinha está trabalhando…</p>}
      {(error || actionError) && <p role="alert">{actionError || error?.message}</p>}
      {!busy && lastUser && (
        <button
          className="secondary"
          onClick={() => {
            const text = lastUser.parts
              .filter((p) => p.type === 'text')
              .map((p) => p.text)
              .join('\n');
            void sendMessage({ text });
          }}
        >
          Reenviar última mensagem
        </button>
      )}
      <form
        className="chat-composer"
        onSubmit={(e) => {
          e.preventDefault();
          if (!input.trim() || busy) return;
          void sendMessage({ text: input.trim() });
          setInput('');
        }}
      >
        <label htmlFor="chat-input">Mensagem</label>
        <textarea
          id="chat-input"
          value={input}
          maxLength={16000}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Como sua abelhinha pode ajudar?"
          disabled={busy}
        />
        {busy ? (
          <button type="button" onClick={() => void stop()}>
            Parar geração
          </button>
        ) : (
          <button disabled={!input.trim() || conversation.agent.status !== 'ACTIVE'}>Enviar</button>
        )}
      </form>
    </>
  );
}
