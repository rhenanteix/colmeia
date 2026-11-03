'use client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { apiRequest } from '../app/api-client';
export default function Recover() {
  const [token, setToken] = useState<string | null>(null),
    [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [confirmation, setConfirmation] = useState(''),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState('');
  useEffect(() => {
    setToken(new URLSearchParams(location.search).get('token'));
  }, []);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (token && password !== confirmation) {
      setNotice('As senhas não coincidem.');
      return;
    }
    setBusy(true);
    try {
      await apiRequest(`/auth/password-reset/${token ? 'confirm' : 'request'}`, {
        method: 'POST',
        body: token ? { token, password } : { email },
      });
      setNotice(
        token
          ? 'Senha alterada. Entre novamente.'
          : 'Se a conta existir, você receberá instruções de recuperação.',
      );
    } catch (e) {
      setNotice(String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth">
      <form method="post" className="card form" onSubmit={submit}>
        <h1>{token ? 'Defina uma nova senha' : 'Recuperar acesso'}</h1>
        <p className="muted">
          {token
            ? 'Use uma senha exclusiva com pelo menos 12 caracteres.'
            : 'Enviaremos um link de uso único para seu email.'}
        </p>
        {token ? (
          <>
            <label>
              Nova senha
              <Input
                required
                type="password"
                minLength={12}
                maxLength={128}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <label>
              Confirme a nova senha
              <Input
                required
                type="password"
                minLength={12}
                maxLength={128}
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
              />
            </label>
          </>
        ) : (
          <label>
            Email
            <Input
              required
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
        )}
        <Button disabled={busy}>
          {busy ? 'Enviando…' : token ? 'Alterar senha' : 'Enviar link'}
        </Button>
        {notice && <p role="status">{notice}</p>}
        <Link href="/login">Voltar ao login</Link>
      </form>
    </main>
  );
}
