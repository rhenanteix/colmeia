import { Worker } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { decryptSecret, encryptionKey, gatewayHealth } from '@colmeia/openclaw-adapter';
import { GatewayProvisioner } from './gateway';
async function main() {
  encryptionKey();
  if (!process.env.REDIS_URL) throw new Error('REDIS_URL required');
  const url = new URL(process.env.REDIS_URL);
  const db = new PrismaClient();
  const provisioner = new GatewayProvisioner(db);
  const worker = new Worker<{ operationId: string }>(
    process.env.RUNTIME_QUEUE_NAME || 'colmeia-runtime',
    async (job) => {
      const operation = await db.runtimeOperation.findUniqueOrThrow({
        where: { id: job.data.operationId },
      });
      if (operation.status === 'completed') return;
      if (!operation.runtimeId) throw new Error('Runtime id required');
      const runtime = await db.runtimeInstance.findFirstOrThrow({
        where: { id: operation.runtimeId, organizationId: operation.organizationId },
      });
      await db.runtimeOperation.update({
        where: { id: operation.id },
        data: { status: 'running', error: null },
      });
      try {
        if (operation.operation === 'provision') await provisioner.provision(runtime);
        else if (operation.operation === 'destroy') await provisioner.destroy(runtime);
        else if (operation.operation.startsWith('deploy:'))
          await provisioner.deploy(runtime, operation.operation.slice(7));
        else throw new Error('Unknown runtime operation');
        await db.runtimeOperation.update({
          where: { id: operation.id },
          data: { status: 'completed', error: null },
        });
      } catch {
        const error =
          'Operação de runtime falhou. Verifique o Docker, credenciais e disponibilidade do gateway.';
        await db.runtimeOperation.update({
          where: { id: operation.id },
          data: { status: 'failed', error },
        });
        if (operation.operation === 'provision')
          await db.runtimeInstance.update({
            where: { id: runtime.id },
            data: { status: 'FAILED', error },
          });
        if (operation.operation.startsWith('deploy:'))
          await db.runtimeDeployment.updateMany({
            where: {
              versionId: operation.operation.slice(7),
              organizationId: runtime.organizationId,
            },
            data: { status: 'FAILED', error },
          });
        throw new Error(error);
      }
    },
    {
      concurrency: 1,
      connection: {
        host: url.hostname,
        port: Number(url.port || 6379),
        username: url.username || undefined,
        password: url.password || undefined,
        ...(url.protocol === 'rediss:' ? { tls: {} } : {}),
        maxRetriesPerRequest: null,
      },
    },
  );
  worker.on('error', () => console.error('Runtime queue connection failed'));
  const health = setInterval(() => {
    void (async () => {
      const runtimes = await db.runtimeInstance.findMany({ where: { status: 'READY' } });
      for (const runtime of runtimes) {
        if (!runtime.gatewayUrl || !runtime.encryptedToken) continue;
        try {
          await gatewayHealth(
            runtime.gatewayUrl,
            decryptSecret(runtime.encryptedToken, runtime.organizationId),
          );
          await db.runtimeInstance.updateMany({
            where: { id: runtime.id, status: 'READY' },
            data: { checkedAt: new Date(), error: null },
          });
        } catch {
          await db.runtimeInstance.updateMany({
            where: { id: runtime.id, status: 'READY' },
            data: { status: 'FAILED', error: 'Gateway indisponível', checkedAt: new Date() },
          });
        }
      }
    })().catch(() => console.error('Runtime health monitor failed'));
  }, 30000);
  const close = async () => {
    clearInterval(health);
    await worker.close();
    await db.$disconnect();
  };
  process.once('SIGTERM', () => {
    void close();
  });
  process.once('SIGINT', () => {
    void close();
  });
  console.log('Colmeia runtime worker ready');
}
void main().catch(() => {
  console.error('Runtime worker startup failed; check configuration.');
  process.exitCode = 1;
});
