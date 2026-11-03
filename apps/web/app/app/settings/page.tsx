'use client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../api-client';
export default function Settings() {
  const client = useQueryClient();
  const [name, setName] = useState<string | undefined>(),
    [slug, setSlug] = useState<string | undefined>(),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState('');
  const me = useQuery({
    queryKey: ['me'],
    queryFn: () =>
      apiRequest<{
        activeOrganizationId: string;
        role: string;
        user: { memberships: { organization: { id: string; name: string; slug: string } }[] };
      }>('/auth/me'),
  });
  const org = me.data?.user.memberships.find(
    (m) => m.organization.id === me.data.activeOrganizationId,
  )?.organization;
  async function save(create: boolean) {
    setBusy(true);
    setNotice('');
    try {
      await apiRequest(create ? '/organizations' : '/organizations/active', {
        method: create ? 'POST' : 'PATCH',
        body: { name: name ?? org?.name, slug: slug ?? org?.slug },
      });
      await client.invalidateQueries();
      setNotice(
        create ? 'Organização criada. Selecione-a no menu lateral.' : 'Organização atualizada.',
      );
    } catch (e) {
      setNotice(String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <span className="eyebrow">SEU WORKSPACE</span>
      <h1>Configurações</h1>
      <form
        className="card form"
        onSubmit={(e) => {
          e.preventDefault();
          save(false);
        }}
      >
        <h2>{org?.name || 'Organização'}</h2>
        <label>
          Nome
          <Input
            required
            value={name ?? org?.name ?? ''}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
          />
        </label>
        <label>
          Endereço do workspace
          <Input
            required
            value={slug ?? org?.slug ?? ''}
            onChange={(e) => setSlug(e.target.value)}
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            maxLength={64}
          />
        </label>
        <Button disabled={busy || !['OWNER', 'ADMIN'].includes(me.data?.role || '')}>
          Salvar alterações
        </Button>
        <Button
          type="button"
          className="secondary"
          disabled={busy || !name || !slug}
          onClick={() => save(true)}
        >
          Criar outra organização com estes dados
        </Button>
        {notice && <p role="status">{notice}</p>}
      </form>
    </>
  );
}
