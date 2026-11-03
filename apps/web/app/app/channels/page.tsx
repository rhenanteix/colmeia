'use client';
import { useEffect, useMemo, useState, useRef } from 'react';
import { API, getJson, postJson } from '../api-client';
import { sessionToken } from '../session';
import { beeFor } from '../bee-identity';

type Agent = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  mascot?: string;
};
type Channel = { id: string; name: string; directKey: string | null; participantIds: string[] };
type Member = { userId: string; lastSeenAt: string | null; user: { name: string | null } };
type Message = {
  id: string;
  authorSubject: string;
  authorName: string;
  parentId: string | null;
  mentionIds: string[];
  agentId: string | null;
  body: string;
  createdAt: string;
};
type Handoff = {
  id: string;
  targetAgentId: string;
  sourceAgentId: string | null;
  instruction: string;
  status: string;
  result: string | null;
  error: string | null;
  createdAt: string;
};
function Bee({ kind, size = 46 }: { kind: string; size?: number }) {
  return (
    <img
      className="bee-avatar"
      src={'/bees/' + kind + '.png'}
      width={size}
      height={size}
      alt={'Abelha ' + kind}
    />
  );
}
export default function Channels() {
  const [live, setLive] = useState<'connecting' | 'connected' | 'reconnecting'>('connecting');
  const [channels, setChannels] = useState<Channel[]>([]),
    [agents, setAgents] = useState<Agent[]>([]),
    [selected, setSelected] = useState(''),
    [messages, setMessages] = useState<Message[]>([]),
    [handoffs, setHandoffs] = useState<Handoff[]>([]),
    [draft, setDraft] = useState(''),
    [newChannel, setNewChannel] = useState(''),
    [target, setTarget] = useState(''),
    [source, setSource] = useState(''),
    [tab, setTab] = useState<'chat' | 'map'>('chat'),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [self, setSelf] = useState('');
  const [directUser, setDirectUser] = useState('');
  const [parentId, setParentId] = useState('');
  const [mentionIds, setMentionIds] = useState<string[]>([]);
  const [hasOlder, setHasOlder] = useState(false);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const channelName = (c: Channel) =>
    c.directKey
      ? 'DM · ' +
        (members.find((m) => c.participantIds.includes(m.userId) && m.userId !== self)?.user.name ||
          'Conversa privada')
      : c.name;
  const selectedChannel = channels.find((c) => c.id === selected);
  const agentMap = useMemo(() => new Map(agents.map((a) => [a.id, a])), [agents]);
  async function initial() {
    try {
      const [c, a, people, me] = await Promise.all([
        getJson<Channel[]>('/channels', sessionToken()),
        getJson<Agent[]>('/agents', sessionToken()),
        getJson<Member[]>('/channels/presence', sessionToken()),
        getJson<{ user: { id: string } }>('/auth/me', sessionToken()),
      ]);
      setMembers(people);
      setSelf(me.user.id);
      setChannels(c);
      setAgents(a);
      setSelected((x) => x || c[0]?.id || '');
      setTarget((x) => x || a[0]?.id || '');
      setError('');
    } catch (e) {
      setError(String(e));
    }
  }
  async function refresh(id: string) {
    if (!id) return;
    try {
      const [m, h] = await Promise.all([
        getJson<Message[]>('/channels/' + id + '/messages', sessionToken()),
        getJson<Handoff[]>('/bee-team/channels/' + id + '/handoffs', sessionToken()),
      ]);
      if (selectedRef.current !== id) return;
      setHasOlder(m.length === 100);
      setMessages((previous) => {
        const merged = new Map(previous.map((item) => [item.id, item]));
        m.forEach((item) => merged.set(item.id, item));
        return [...merged.values()].sort(
          (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
        );
      });
      setHandoffs(h.slice().reverse());
    } catch (e) {
      setError(String(e));
    }
  }
  useEffect(() => {
    initial();
  }, []);
  useEffect(() => {
    let active = true;
    const heartbeat = async () => {
      try {
        await postJson('/channels/presence', sessionToken(), {});
        const people = await getJson<Member[]>('/channels/presence', sessionToken());
        if (active) setMembers(people);
      } catch {
        /* Presence is best-effort; messaging reports its own errors. */
      }
    };
    void heartbeat();
    const timer = setInterval(() => void heartbeat(), 30000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);
  useEffect(() => {
    setMessages([]);
    setHandoffs([]);
    setParentId('');
    setMentionIds([]);
    setHasOlder(false);
    if (!selected) return;
    setLive('connecting');
    void refresh(selected);
    const stream = new EventSource(API + '/bee-team/channels/' + selected + '/events');
    let stamp = '';
    stream.onopen = () => setLive('connected');
    stream.onerror = () => setLive('reconnecting');
    stream.onmessage = (event) => {
      try {
        const snapshot = JSON.parse(event.data);
        if (snapshot.type === 'error') {
          stream.close();
          setLive('reconnecting');
          setError(snapshot.message);
          return;
        }
        const next = JSON.stringify([snapshot.lastMessageId, snapshot.handoffs]);
        if (next !== stamp) {
          stamp = next;
          void refresh(selected);
        }
      } catch {
        setLive('reconnecting');
      }
    };
    return () => stream.close();
  }, [selected]);
  async function direct() {
    setBusy(true);
    try {
      const channel = await postJson<Channel>('/channels/direct', sessionToken(), {
        userId: directUser,
      });
      setChannels((current) =>
        current.some((c) => c.id === channel.id) ? current : [...current, channel],
      );
      setSelected(channel.id);
      setError('');
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  async function older() {
    if (!messages[0]) return;
    const id = selected;
    setBusy(true);
    try {
      const page = await getJson<Message[]>(
        '/channels/' + id + '/messages?before=' + messages[0].id,
        sessionToken(),
      );
      if (selectedRef.current !== id) return;
      setHasOlder(page.length === 100);
      setMessages((current) => {
        const merged = new Map(
          [...page.reverse(), ...current].map((message) => [message.id, message]),
        );
        return [...merged.values()];
      });
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  async function createChannel() {
    if (newChannel.trim().length < 2) return;
    setBusy(true);
    try {
      const c = await postJson<Channel>('/channels', sessionToken(), { name: newChannel.trim() });
      setChannels((v) => [...v, c]);
      setSelected(c.id);
      setNewChannel('');
      setError('');
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  async function send() {
    if (!selected || !draft.trim() || busy) return;
    setBusy(true);
    setNotice('');
    try {
      await postJson('/channels/' + selected + '/messages', sessionToken(), {
        body: draft.trim(),
        ...(parentId ? { parentId } : {}),
        mentionIds,
      });
      setDraft('');
      setParentId('');
      setMentionIds([]);
      setError('');
      await refresh(selected);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  async function handoff() {
    if (!selected || !target || !draft.trim() || busy) return;
    setBusy(true);
    setNotice('');
    try {
      await postJson<Handoff>('/bee-team/channels/' + selected + '/handoffs', sessionToken(), {
        targetAgentId: target,
        ...(source ? { sourceAgentId: source } : {}),
        instruction: draft.trim(),
      });
      setDraft('');
      await refresh(selected);
      setNotice('Repasse recebido: a abelhinha entrará em execução. Acompanhe o status ao vivo.');
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="hive-page">
      <div className="hive-heading">
        <div>
          <span className="eyebrow">COLMEIA / TEAMS</span>
          <h1>
            Uma equipe <em>zumbindo junta.</em>
          </h1>
          <p className="muted">
            Seu time e suas abelhinhas trabalhando no mesmo espaço, com repasses rastreáveis.
          </p>
        </div>
        <div className="hive-heading-bee">
          <Bee kind="rainha" size={96} />
        </div>
      </div>
      <div className="hive-layout">
        <aside className="hive-channels">
          <div className="hive-section-title">
            CANAIS <span>{channels.length}</span>
          </div>
          {channels.map((c) => (
            <button
              className={'hive-channel ' + (selected === c.id ? 'active' : '')}
              key={c.id}
              onClick={() => setSelected(c.id)}
            >
              {c.directKey ? '🔒' : '#'} {channelName(c)}
            </button>
          ))}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createChannel();
            }}
            className="hive-new"
          >
            <input
              aria-label="Nome do canal"
              placeholder="Novo canal"
              value={newChannel}
              onChange={(e) => setNewChannel(e.target.value)}
            />
            <button disabled={busy || newChannel.trim().length < 2} type="submit">
              +
            </button>
          </form>
          <label>
            Mensagem direta
            <select
              aria-label="Mensagem direta"
              value={directUser}
              onChange={(e) => setDirectUser(e.target.value)}
            >
              <option value="">Escolha um membro</option>
              {members
                .filter((m) => m.userId !== self)
                .map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.user.name || 'Membro'}
                  </option>
                ))}
            </select>
          </label>
          <button disabled={busy || !directUser} onClick={direct}>
            Abrir DM
          </button>
          <div className="hive-section-title">PESSOAS</div>
          {members.map((m) => (
            <p key={m.userId}>
              {m.user.name || 'Membro'} ·{' '}
              {m.lastSeenAt && Date.now() - new Date(m.lastSeenAt).getTime() < 90000
                ? 'Online'
                : 'Ausente'}
            </p>
          ))}
          <div className="hive-section-title" style={{ marginTop: 28 }}>
            EQUIPE DE ABELHAS
          </div>
          {agents.map((a) => (
            <div className="hive-member" key={a.id}>
              <Bee kind={a.mascot || beeFor(a.name)} size={36} />
              <span>
                {a.name}
                <small>{a.status === 'ACTIVE' ? 'Ativo' : 'Rascunho'}</small>
              </span>
            </div>
          ))}
          {agents.length === 0 && (
            <p className="muted small">Crie agentes em “Agentes” para habilitar repasses.</p>
          )}
        </aside>
        <section className="hive-main">
          <header className="hive-room-head">
            <div>
              <strong>
                # {selectedChannel ? channelName(selectedChannel) : 'Selecione um canal'}
              </strong>
              <small>
                Mensagens e colaboração entre agentes ·{' '}
                <span className={'bee-live ' + live}>
                  {live === 'connected'
                    ? '● Eventos ao vivo'
                    : live === 'connecting'
                      ? '◌ Conectando'
                      : '◌ Reconectando'}
                </span>
              </small>
            </div>
            <div className="hive-tabs">
              <button onClick={() => setTab('chat')} className={tab === 'chat' ? 'selected' : ''}>
                Conversa
              </button>
              <button onClick={() => setTab('map')} className={tab === 'map' ? 'selected' : ''}>
                Mapa vivo
              </button>
            </div>
          </header>
          {tab === 'chat' ? (
            <div className="hive-thread" role="log" aria-live="polite">
              {messages.length === 0 && (
                <div className="hive-empty">
                  <Bee kind="atendimento" size={105} />
                  <h2>O canal está pronto!</h2>
                  <p>Envie uma mensagem ou delegue uma tarefa para uma abelhinha.</p>
                </div>
              )}
              {hasOlder && (
                <button disabled={busy} onClick={older}>
                  Carregar mensagens anteriores
                </button>
              )}
              {messages.map((m) => {
                const a = m.agentId ? agentMap.get(m.agentId) : null;
                return (
                  <article className="hive-message" key={m.id}>
                    <div className="hive-msg-avatar">
                      {a ? (
                        <Bee kind={a.mascot || beeFor(a.name)} size={48} />
                      ) : (
                        <span className="hive-human">
                          {m.authorSubject === self ? 'EU' : m.authorName.slice(0, 2).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div>
                      <div className="hive-msg-by">
                        <strong>{a?.name || m.authorName}</strong>
                        <time>{new Date(m.createdAt).toLocaleString('pt-BR')}</time>
                      </div>
                      {m.parentId && (
                        <small>
                          ↳ Resposta:{' '}
                          {messages.find((parent) => parent.id === m.parentId)?.body.slice(0, 80) ||
                            'Mensagem anterior'}
                        </small>
                      )}
                      <p>{m.body}</p>
                      {m.mentionIds?.length > 0 && (
                        <small>
                          {m.mentionIds
                            .map(
                              (id) =>
                                '@' +
                                (members.find((person) => person.userId === id)?.user.name ||
                                  'Membro'),
                            )
                            .join(' ')}
                        </small>
                      )}
                      {!m.parentId && (
                        <button className="secondary" onClick={() => setParentId(m.id)}>
                          Responder em thread
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
              {handoffs
                .filter((h) => h.status !== 'completed')
                .map((h) => (
                  <div className="hive-event" key={h.id}>
                    <span>↗</span> Repasse para{' '}
                    <strong>{agentMap.get(h.targetAgentId)?.name || 'agente'}</strong> —{' '}
                    {h.status === 'failed'
                      ? 'Não executado'
                      : h.status === 'running'
                        ? 'Executando'
                        : 'Na fila'}
                    {h.error && <small>{h.error}</small>}
                  </div>
                ))}
            </div>
          ) : (
            <div className="hive-map">
              <p className="muted small">
                As abelhinhas flutuam no mapa. O status abaixo vem do cadastro; repasses reais
                aparecem no histórico.
              </p>
              <div className="bee-garden">
                {agents.map((a, i) => {
                  const last = handoffs.filter((h) => h.targetAgentId === a.id).slice(-1)[0];
                  const active = last?.status === 'queued' || last?.status === 'running';
                  return (
                    <div
                      className={
                        'bee-node ' +
                        (active ? 'bee-working' : '') +
                        (last?.status === 'failed' ? ' bee-failed' : '')
                      }
                      key={a.id}
                      style={{ animationDelay: (i % 5) * -0.8 + 's' }}
                    >
                      <Bee kind={a.mascot || beeFor(a.name)} size={94} />
                      <strong>{a.name}</strong>
                      <small>
                        {active
                          ? last.status === 'running'
                            ? '⚡ Executando'
                            : '◷ Na fila'
                          : last?.status === 'completed'
                            ? '✓ Concluído'
                            : last?.status === 'failed'
                              ? '! Falhou'
                              : a.status === 'ACTIVE'
                                ? 'Cadastrado como ativo'
                                : 'Ainda não publicado'}
                      </small>
                    </div>
                  );
                })}
                {agents.length === 0 && (
                  <div className="hive-empty">Crie agentes para preencher o mapa.</div>
                )}
              </div>
              <div className="hive-handoffs">
                <strong>Últimos repasses</strong>
                {handoffs
                  .slice(-8)
                  .reverse()
                  .map((h) => (
                    <p key={h.id}>
                      🐝 {h.sourceAgentId ? agentMap.get(h.sourceAgentId)?.name + ' → ' : ''}
                      {agentMap.get(h.targetAgentId)?.name} · <span>{h.status}</span>
                    </p>
                  ))}
              </div>
            </div>
          )}
          <footer className="hive-composer">
            <div className="hive-delegation">
              <label>
                De{' '}
                <select value={source} onChange={(e) => setSource(e.target.value)}>
                  <option value="">Você</option>
                  {agents.map((a) => (
                    <option value={a.id} key={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Para{' '}
                <select value={target} onChange={(e) => setTarget(e.target.value)}>
                  <option value="">Escolha uma abelha</option>
                  {agents
                    .filter((a) => a.id !== source)
                    .map((a) => (
                      <option value={a.id} key={a.id}>
                        {a.name}
                      </option>
                    ))}
                </select>
              </label>
            </div>
            {parentId && (
              <p role="status">
                Respondendo em thread{' '}
                <button className="secondary" onClick={() => setParentId('')}>
                  Cancelar resposta
                </button>
              </p>
            )}
            <label>
              Mencionar membros
              <select
                aria-label="Mencionar membros"
                multiple
                value={mentionIds}
                onChange={(e) =>
                  setMentionIds(Array.from(e.target.selectedOptions, (option) => option.value))
                }
              >
                {members
                  .filter(
                    (m) =>
                      m.userId !== self &&
                      (!selectedChannel?.directKey ||
                        selectedChannel.participantIds.includes(m.userId)),
                  )
                  .map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.user.name || 'Membro'}
                    </option>
                  ))}
              </select>
            </label>
            <textarea
              aria-label="Mensagem"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Escreva para o time ou peça para uma abelhinha trabalhar..."
              rows={3}
            />
            <div className="hive-compose-actions">
              <span>Repasses de IA exigem um provedor configurado no backend.</span>
              <div>
                <button
                  className="secondary"
                  disabled={busy || !selected || !draft.trim()}
                  onClick={send}
                >
                  Enviar mensagem
                </button>
                <button disabled={busy || !selected || !target || !draft.trim()} onClick={handoff}>
                  🐝 Delegar
                </button>
              </div>
            </div>
            {notice && (
              <p className="hive-notice" role="status">
                {notice}
              </p>
            )}
            {error && (
              <p className="hive-error" role="alert">
                {error}
              </p>
            )}
          </footer>
        </section>
      </div>
    </div>
  );
}
