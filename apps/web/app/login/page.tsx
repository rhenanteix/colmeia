'use client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useState } from 'react';
import Link from 'next/link';
import { API } from '../app/api-client';
export default function Login() {
  const [email, E] = useState(''),
    [password, P] = useState(''),
    [error, X] = useState(''),
    [busy, B] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    B(true);
    try {
      const r = await fetch(API + '/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.message || 'Falha no login');
      location.href = '/app';
    } catch (e) {
      X(String(e));
    } finally {
      B(false);
    }
  }
  return (
    <main className="auth">
      <Link href="/" className="brand hive-brand">
        <img className="auth-bee" src="/bees/rainha.png" width="56" height="56" alt="" />
        <span>
          colmeia<span className="brand-dot">.ia</span>
        </span>
      </Link>
      <form method="post" className="card form" onSubmit={submit}>
        <span className="eyebrow">BOM TER VOCÊ POR AQUI</span>
        <h1>Entre na sua colmeia.</h1>
        <p className="muted">Suas pessoas, seus agentes e suas próximas grandes ideias.</p>
        <label>
          Email
          <Input
            type="email"
            autoComplete="email"
            placeholder="voce@empresa.com"
            required
            value={email}
            onChange={(e) => E(e.target.value)}
          />
        </label>
        <label>
          Senha
          <Input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => P(e.target.value)}
          />
        </label>
        <Button disabled={busy}>{busy ? 'Aguarde...' : 'Entrar'}</Button>
        {error && <p role="alert">{error}</p>}
        <Link href="/recuperar">Esqueci minha senha</Link>
        <p>
          Não tem conta? <Link href="/cadastro">Criar empresa</Link>
        </p>
      </form>
    </main>
  );
}
