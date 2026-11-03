'use client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { apiRequest } from '../app/api-client';
const schema = z
  .object({
    name: z.string().trim().min(2, 'Informe seu nome').max(80),
    email: z.email('Informe um email válido'),
    organizationName: z.string().trim().min(2, 'Informe o nome da empresa').max(80),
    password: z.string().min(12, 'Use pelo menos 12 caracteres').max(128),
    confirmation: z.string(),
  })
  .refine((d) => d.password === d.confirmation, {
    message: 'As senhas não coincidem',
    path: ['confirmation'],
  });
type Form = z.infer<typeof schema>;
export default function Cadastro() {
  const [error, setError] = useState('');
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Form>({ resolver: zodResolver(schema) });
  const fields = [
    ['name', 'Seu nome', 'text'],
    ['email', 'Email', 'email'],
    ['organizationName', 'Nome da empresa', 'text'],
    ['password', 'Senha (12+ caracteres)', 'password'],
    ['confirmation', 'Confirme sua senha', 'password'],
  ] as const;
  return (
    <main className="auth">
      <Link href="/" className="brand">
        Colmeia
      </Link>
      <form
        method="post"
        className="card form"
        onSubmit={handleSubmit(async ({ confirmation: _confirmation, ...data }) => {
          setError('');
          try {
            await apiRequest('/auth/register', { method: 'POST', body: data });
            location.assign('/onboarding');
          } catch (e) {
            setError(String(e));
          }
        })}
      >
        <span className="eyebrow">SEU PRÓXIMO CAPÍTULO</span>
        <h1>Uma colmeia para sua empresa</h1>
        <p className="muted">Reúna pessoas e especialistas em um workspace só seu.</p>
        {fields.map(([key, label, type]) => (
          <label key={key}>
            {label}
            <Input
              type={type}
              {...register(key)}
              aria-invalid={!!errors[key]}
              aria-describedby={errors[key] ? `${key}-error` : undefined}
              autoComplete={
                type === 'password'
                  ? 'new-password'
                  : key === 'email'
                    ? 'email'
                    : key === 'name'
                      ? 'name'
                      : 'organization'
              }
            />
            {errors[key] && (
              <span id={`${key}-error`} role="alert">
                {errors[key]?.message}
              </span>
            )}
          </label>
        ))}
        <Button disabled={isSubmitting}>{isSubmitting ? 'Criando…' : 'Criar conta'}</Button>
        {error && <p role="alert">{error}</p>}
        <p>
          Já tem conta? <Link href="/login">Entrar</Link>
        </p>
      </form>
    </main>
  );
}
