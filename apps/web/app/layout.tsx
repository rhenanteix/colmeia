import { Providers } from './providers';
import './globals.css';
import type { ReactNode } from 'react';
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#111213',
};
export const metadata = {
  title: 'Colmeia | Ribeira Connect',
  icons: { icon: '/bees/rainha.png' },
  description: 'Plataforma empresarial de agentes de IA',
};
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className="dark">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
