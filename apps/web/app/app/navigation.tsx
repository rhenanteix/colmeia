'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  Menu,
  X,
  LayoutDashboard,
  Hexagon,
  Layers3,
  MessagesSquare,
  Cpu,
  ShieldCheck,
  ChartNoAxesCombined,
  Users,
  ListTodo,
  Settings,
} from 'lucide-react';
const icons = [
  LayoutDashboard,
  Hexagon,
  Layers3,
  MessagesSquare,
  MessagesSquare,
  ListTodo,
  Cpu,
  ShieldCheck,
  ChartNoAxesCombined,
  Users,
  ListTodo,
  Settings,
  Layers3,
  Layers3,
  ChartNoAxesCombined,
];
const links = [
  ['Visão geral', '/app'],
  ['Minhas abelhinhas', '/app/agents'],
  ['Templates', '/app/templates'],
  ['Conversas', '/app/conversations'],
  ['Colmeia Teams', '/app/channels'],
  ['Execuções', '/app/executions'],
  ['Modelos de IA', '/app/models'],
  ['Aprovações', '/app/approvals'],
  ['Consumo', '/app/usage'],
  ['Equipe', '/app/team'],
  ['Tarefas', '/app/tasks'],
  ['Configurações', '/app/settings'],
  ['Workflows', '/app/workflows'],
  ['Arquivos e Wiki', '/app/documents'],
  ['Plano e limites', '/app/billing'],
];
export function Navigation() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        className="mobile-menu secondary"
        aria-expanded={open}
        aria-controls="workspace-navigation"
        onClick={() => setOpen(!open)}
      >
        {open ? <X size={18} /> : <Menu size={18} />} Navegação
      </button>
      <nav
        id="workspace-navigation"
        className={open ? 'navigation is-open' : 'navigation'}
        aria-label="Navegação principal"
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setOpen(false);
            document.querySelector<HTMLButtonElement>('.mobile-menu')?.focus();
          }
        }}
      >
        {links.map(([name, href], index) => {
          const Icon = icons[index];
          return (
            <Link
              key={href}
              className="nav"
              aria-current={
                (href === '/app' ? pathname === href : pathname.startsWith(href))
                  ? 'page'
                  : undefined
              }
              href={href}
              onClick={() => setOpen(false)}
            >
              <Icon size={18} strokeWidth={1.7} aria-hidden="true" />
              <span>{name}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
export function Breadcrumb() {
  const pathname = usePathname();
  const active = links.find(([, href]) => href !== '/app' && pathname.startsWith(href));
  return (
    <nav aria-label="Caminho da página">
      <Link href="/app">Colmeia</Link>
      {active && (
        <>
          <span aria-hidden="true"> / </span>
          <Link href={active[1]}>{active[0]}</Link>
        </>
      )}
      {pathname.includes('/builder') && <span> / Configurar agente</span>}
    </nav>
  );
}
