import { Injectable, BadRequestException } from '@nestjs/common';
import { mkdir, writeFile, readFile, unlink } from 'node:fs/promises';
import { resolve, join, extname } from 'node:path';
import { randomUUID } from 'node:crypto';
export interface StoredUpload {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}
export interface StorageAdapter {
  put(bytes: Buffer): Promise<string>;
  read(key: string): Promise<Buffer>;
  remove(key: string): Promise<void>;
}
@Injectable()
export class LocalDocumentStorage implements StorageAdapter {
  private root = resolve(
    __dirname,
    '../../../../..',
    process.env.FILE_STORAGE_PATH || '.colmeia-storage',
  );
  private path(key: string) {
    if (!/^[0-9a-f-]{36}$/.test(key))
      throw new BadRequestException('Chave de armazenamento inválida.');
    return join(this.root, key);
  }
  async put(bytes: Buffer) {
    await mkdir(this.root, { recursive: true, mode: 0o700 });
    const key = randomUUID();
    await writeFile(this.path(key), bytes, { flag: 'wx', mode: 0o600 });
    return key;
  }
  read(key: string) {
    return readFile(this.path(key));
  }
  async remove(key: string) {
    await unlink(this.path(key)).catch((e: NodeJS.ErrnoException) => {
      if (e.code !== 'ENOENT') throw e;
    });
  }
}
export function validateUpload(file?: StoredUpload) {
  if (!file || file.size < 1 || file.size > 10 * 1024 * 1024)
    throw new BadRequestException('Envie um arquivo de até 10 MiB.');
  const extension = extname(file.originalname).toLowerCase();
  const bytes = file.buffer;
  const valid =
    (extension === '.pdf' &&
      file.mimetype === 'application/pdf' &&
      bytes.subarray(0, 5).toString() === '%PDF-') ||
    (extension === '.png' &&
      file.mimetype === 'image/png' &&
      bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) ||
    (['.jpg', '.jpeg'].includes(extension) &&
      file.mimetype === 'image/jpeg' &&
      bytes[0] === 255 &&
      bytes[1] === 216 &&
      bytes[2] === 255) ||
    (['.txt', '.md', '.csv'].includes(extension) &&
      ['text/plain', 'text/markdown', 'text/csv'].includes(file.mimetype) &&
      !bytes.includes(0));
  if (!valid)
    throw new BadRequestException(
      'Tipo inválido. Aceitos: PDF, PNG, JPEG, TXT, Markdown e CSV com conteúdo compatível.',
    );
  return file;
}
