import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
export const OPENCLAW_IMAGE =
  'ghcr.io/openclaw/openclaw:2026.10.9@sha256:1a2a3ce113e435039dbeac5ae261759bb4759908563d91c81059e896b38c5d98';
export function encryptionKey() {
  const raw = process.env.RUNTIME_ENCRYPTION_KEY || '';
  if (!/^[a-f0-9]{64}$/i.test(raw))
    throw new Error('RUNTIME_ENCRYPTION_KEY must be 32 bytes encoded as hex');
  return Buffer.from(raw, 'hex');
}
export function encryptSecret(value, organizationId) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  cipher.setAAD(Buffer.from(organizationId));
  const data = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return [
    'v1',
    iv.toString('base64url'),
    cipher.getAuthTag().toString('base64url'),
    data.toString('base64url'),
  ].join('.');
}
export function decryptSecret(value, organizationId) {
  const [version, iv, tag, ciphertext] = value.split('.');
  if (version !== 'v1' || !iv || !tag || !ciphertext)
    throw new Error('Invalid encrypted credential');
  const cipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(iv, 'base64url'));
  cipher.setAAD(Buffer.from(organizationId));
  cipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([
    cipher.update(Buffer.from(ciphertext, 'base64url')),
    cipher.final(),
  ]).toString('utf8');
}
export function runtimeNames(id) {
  if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error('Invalid runtime id');
  const prefix = `colmeia-${id}`;
  return { container: prefix, volume: `${prefix}-data`, network: `${prefix}-net` };
}
export async function gatewayHealth(url, token) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'http:' || parsed.hostname !== '127.0.0.1')
    throw new Error('Gateway must be private loopback in the local Docker topology');
  const response = await fetch(`${url}/v1/models`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(5000),
    redirect: 'error',
  });
  if (!response.ok) throw new Error('Gateway health or authorization failed');
  const body = await response.json();
  if (!Array.isArray(body.data)) throw new Error('Invalid gateway protocol');
  return body.data.map((model) => model.id).filter((id) => typeof id === 'string');
}
