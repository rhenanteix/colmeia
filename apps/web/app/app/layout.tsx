import { UserMenu } from './user-menu';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { CommandMenu } from './command-menu';
import { Navigation, Breadcrumb } from './navigation';
import { WorkspaceControls } from './workspace-controls';
import Link from 'next/link';
import type { ReactNode } from 'react';
export default async function Layout({ children }: { children: ReactNode }) {
  if (!(await cookies()).has('colmeia_session')) redirect('/login');
  return (
    <div className="shell">
      <a className="skip-link" href="#workspace-content">
        Pular para o conteúdo
      </a>
      <aside className="sidebar">
        <Link className="brand hive-brand" href="/app">
          <img src="/bees/rainha.png" alt="" width="36" height="36" />
          <span>
            colmeia<span className="brand-dot">.ia</span>
          </span>
        </Link>
        <WorkspaceControls />
        <div className="side-caption">ESPAÇO DE TRABALHO</div>
        <Navigation />
        <div className="side-bee">
          <img src="/bees/atendimento.png" alt="Abelhinha de atendimento" width="70" height="70" />
          <strong>Seu time, uma colmeia.</strong>
          <small>Humanos e agentes no mesmo lugar.</small>
        </div>
        <div className="side-footer">COLMEIA · RIBEIRA CONNECT</div>
      </aside>
      <main className="main">
        <div className="workspace-topbar">
          <Breadcrumb />
          <CommandMenu />
          <UserMenu />
        </div>
        <div id="workspace-content" tabIndex={-1}>
          {children}
        </div>
      </main>
    </div>
  );
}
