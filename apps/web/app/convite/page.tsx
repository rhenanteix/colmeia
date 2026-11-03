'use client';
import { useState } from 'react';
import Link from 'next/link';
import { apiRequest } from '../app/api-client';
export default function Invitation() {
  const [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false);
  async function accept() {
    setBusy(true);
    try {
      const token = new URLSearchParams(location.search).get('token');
      const result = await apiRequest<{ organizationId: string }>('/team/invitations/accept', {
        method: 'POST',
        body: { token },
      });
      await apiRequest('/auth/switch', {
        method: 'POST',
        body: { organizationId: result.organizationId },
      });
      location.assign('/app');
    } catch (e) {
      setNotice(String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth">
      <div className="card form">
        <img src="/bees/rainha.png" width="90" height="90" alt="Abelha Rainha" />
        <h1>Sua equipe está esperando</h1>
        <p>
          Entre ou crie uma conta usando o email convidado. Depois, abra este link novamente para
          aceitar.
        </p>
        <Link href="/login">Entrar</Link>
        <Link href="/cadastro">Criar conta</Link>
        <button disabled={busy} onClick={accept}>
          {busy ? 'Aceitando…' : 'Aceitar convite'}
        </button>
        {notice && <p role="alert">{notice}</p>}
      </div>
    </main>
  );
}
