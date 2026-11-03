import type { ReactNode } from 'react';
import { Card, CardContent } from './card';
import { Button } from './button';
import { Skeleton as SkeletonBlock } from './skeleton';
export function Skeleton({ label = 'Carregando…' }: { label?: string }) {
  return (
    <Card role="status" aria-label={label}>
      <CardContent className="space-y-4">
        <SkeletonBlock className="h-5 w-full" />
        <SkeletonBlock className="h-5 w-2/3" />
        <span className="muted">{label}</span>
      </CardContent>
    </Card>
  );
}
export function ErrorState({
  title = 'Não foi possível carregar',
  retry,
}: {
  title?: string;
  retry: () => void;
}) {
  return (
    <Card role="alert">
      <CardContent>
        <h2>{title}</h2>
        <p className="muted">Verifique sua conexão e tente novamente.</p>
        <Button onClick={retry}>Tentar novamente</Button>
      </CardContent>
    </Card>
  );
}
export function EmptyState({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <CardContent>
        <h3>{title}</h3>
        {children}
      </CardContent>
    </Card>
  );
}
