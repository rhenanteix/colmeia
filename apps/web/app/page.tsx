import Link from 'next/link';
import { ArrowUpRight, Layers3, ShieldCheck, Users, Workflow, ArrowRight } from 'lucide-react';
import { BeeScene } from '../components/brand/bee-scene';
const features = [
  {
    icon: Layers3,
    title: 'Especialistas com propósito',
    text: 'Crie abelhinhas para atendimento, vendas, operações e os desafios da sua empresa.',
  },
  {
    icon: Users,
    title: 'Juntos no mesmo espaço',
    text: 'Organize conversas por canais e conecte sua equipe aos agentes no Colmeia Teams.',
  },
  {
    icon: ShieldCheck,
    title: 'Você no controle',
    text: 'Defina permissões, acompanhe aprovações e consulte o consumo da sua organização.',
  },
];
export default function Home() {
  return (
    <main className="landing">
      <a className="skip-link" href="#conteudo">
        Pular para o conteúdo
      </a>
      <header className="landing-nav">
        <Link href="/" className="brand hive-brand">
          <img src="/bees/rainha.png" width="40" height="40" alt="" />
          <span>
            colmeia<span className="brand-dot">.ia</span>
          </span>
        </Link>
        <nav aria-label="Navegação do site">
          <a href="#como-funciona">Como funciona</a>
          <Link href="/login">
            Entrar <ArrowUpRight size={16} />
          </Link>
        </nav>
      </header>
      <section className="landing-hero" id="conteudo">
        <div className="landing-copy">
          <span className="eyebrow">
            <span className="status-dot" /> INTELIGÊNCIA QUE TRABALHA EM EQUIPE
          </span>
          <h1>
            Grandes ideias.
            <br />
            Uma equipe.
            <br />
            <span>Infinitas possibilidades.</span>
          </h1>
          <p>
            Transforme o jeito de trabalhar. Reúna pessoas e agentes de IA em uma colmeia feita para
            o seu negócio.
          </p>
          <div className="landing-actions">
            <Link className="honey-button" href="/cadastro">
              Criar minha colmeia <ArrowUpRight size={19} />
            </Link>
            <a className="text-link" href="#como-funciona">
              Conhecer a plataforma <ArrowRight size={17} />
            </a>
          </div>
          <div className="hero-note">
            <ShieldCheck size={16} /> Sua empresa no centro. Você no controle.
          </div>
        </div>
        <BeeScene />
      </section>
      <div className="landing-ribbon">
        <span>MENOS TAREFAS REPETITIVAS.</span>
        <span>MAIS ESPAÇO PARA BOAS IDEIAS.</span>
        <Workflow size={22} />
      </div>
      <section className="landing-section" id="plataforma">
        <div className="section-heading">
          <div>
            <span className="eyebrow">CADA ABELHINHA, UM TALENTO</span>
            <h2>Seu próximo time começa aqui.</h2>
          </div>
          <p className="muted">
            Tecnologia com clareza.
            <br />
            Colaboração com propósito.
          </p>
        </div>
        <div className="feature-grid">
          {features.map(({ icon: Icon, title, text }, i) => (
            <article className="card feature-card" key={title}>
              <div className="feature-icon">
                <Icon size={24} />
              </div>
              <span className="feature-number">0{i + 1}</span>
              <h3>{title}</h3>
              <p className="muted">{text}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="landing-section how-section" id="como-funciona">
        <div>
          <span className="eyebrow">DO PRIMEIRO PASSO À COLABORAÇÃO</span>
          <h2>
            Simples de começar.
            <br />
            <span className="honey-text">Pronta para evoluir.</span>
          </h2>
          <p className="muted">
            Um caminho claro para organizar sua operação com inteligência artificial.
          </p>
          <Link className="text-link" href="/cadastro">
            Vamos começar <ArrowUpRight size={18} />
          </Link>
        </div>
        <ol className="journey-list">
          {[
            ['Crie seu espaço', 'Cadastre sua empresa e conte o que sua equipe precisa.'],
            [
              'Escolha suas abelhinhas',
              'Use um template ou configure agentes com suas próprias instruções.',
            ],
            ['Conecte e acompanhe', 'Convide pessoas, organize canais e acompanhe as atividades.'],
          ].map(([title, text], i) => (
            <li key={title}>
              <span>0{i + 1}</span>
              <div>
                <h3>{title}</h3>
                <p className="muted">{text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
      <footer className="landing-footer">
        <span className="brand">
          colmeia<span className="brand-dot">.ia</span>
        </span>
        <span>Ribeira Connect · Pessoas, agentes e boas ideias.</span>
        <Link href="/login">Acessar workspace ↗</Link>
      </footer>
    </main>
  );
}
