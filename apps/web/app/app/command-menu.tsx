'use client';
import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandGroup,
  CommandItem,
  CommandEmpty,
} from '@/components/ui/command';
const entries = [
  ['Visão geral', '/app'],
  ['Minhas abelhinhas', '/app/agents'],
  ['Templates', '/app/templates'],
  ['Equipe', '/app/team'],
  ['Configurações', '/app/settings'],
  ['Conversas', '/app/conversations'],
  ['Execuções', '/app/executions'],
  ['Modelos e ambientes', '/app/models'],
  ['Colmeia Teams', '/app/channels'],
];
export function CommandMenu() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const keyboard = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    document.addEventListener('keydown', keyboard);
    return () => document.removeEventListener('keydown', keyboard);
  }, []);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <Search size={16} />
        Buscar página <kbd>⌘K</kbd>
      </Button>
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Para onde vamos?"
        description="Busque uma página da sua colmeia."
      >
        <CommandInput aria-label="Buscar página" placeholder="Digite o nome de uma página…" />
        <CommandList>
          <CommandEmpty>Nenhuma página encontrada.</CommandEmpty>
          <CommandGroup heading="Workspace">
            {entries.map(([name, href]) => (
              <CommandItem
                key={href}
                onSelect={() => {
                  setOpen(false);
                  location.assign(href);
                }}
              >
                {name}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
