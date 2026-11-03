import { Injectable, OnModuleDestroy, ServiceUnavailableException } from '@nestjs/common';
import { Queue } from 'bullmq';
import { encryptionKey } from '@colmeia/openclaw-adapter';
@Injectable()
export class RuntimeJobs implements OnModuleDestroy {
  private queue?: Queue;
  private getQueue() {
    if (!process.env.REDIS_URL) throw new ServiceUnavailableException('Redis não configurado.');
    encryptionKey();
    const url = new URL(process.env.REDIS_URL);
    this.queue ??= new Queue(process.env.RUNTIME_QUEUE_NAME || 'colmeia-runtime', {
      connection: {
        host: url.hostname,
        port: Number(url.port || 6379),
        password: url.password || undefined,
        username: url.username || undefined,
        ...(url.protocol === 'rediss:' ? { tls: {} } : {}),
        maxRetriesPerRequest: 1,
      },
    });
    return this.queue;
  }
  async enqueue(operationId: string) {
    const queue = this.getQueue();
    const existing = await queue.getJob(operationId);
    if (existing) {
      const state = await existing.getState();
      if (state === 'failed') {
        await existing.retry();
        return;
      }
      if (state !== 'completed') return;
      await existing.remove();
    }
    await queue.add(
      'operation',
      { operationId },
      {
        jobId: operationId,
        attempts: 3,
        backoff: { type: 'exponential', delay: 3000 },
        removeOnComplete: 100,
        removeOnFail: 100,
      },
    );
  }
  async onModuleDestroy() {
    await this.queue?.close();
  }
}
