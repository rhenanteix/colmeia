import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
@Injectable()
export class MailService {
  async send(to: string, subject: string, text: string) {
    const endpoint = process.env.MAIL_WEBHOOK_URL;
    if (endpoint) {
      if (!endpoint.startsWith('https://'))
        throw new ServiceUnavailableException('Email requer HTTPS');
      const result = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.MAIL_WEBHOOK_TOKEN || ''}`,
        },
        body: JSON.stringify({ to, subject, text }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!result.ok) throw new ServiceUnavailableException('Falha na entrega de email');
      return;
    }
    if (process.env.NODE_ENV === 'production')
      throw new ServiceUnavailableException('Email transacional não configurado');
    const directory = process.env.MAIL_DEV_DIRECTORY || join(tmpdir(), 'colmeia-mail');
    await mkdir(directory, { recursive: true, mode: 0o700 });
    await writeFile(
      join(directory, `${randomUUID()}.json`),
      JSON.stringify({ to, subject, text }),
      { mode: 0o600, flag: 'wx' },
    );
  }
}
