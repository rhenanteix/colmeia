import { PrismaClient, RuntimeInstance } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import {
  OPENCLAW_IMAGE,
  encryptSecret,
  decryptSecret,
  runtimeNames,
  gatewayHealth,
} from '@colmeia/openclaw-adapter';
import { docker, exists } from './docker';
const writeConfiguration = `const fs=require('node:fs');let raw='';process.stdin.on('data',d=>raw+=d);process.stdin.on('end',()=>{const data=JSON.parse(raw);const root='/home/node/.openclaw';fs.mkdirSync(root,{recursive:true,mode:448});fs.writeFileSync(root+'/openclaw.json',JSON.stringify(data.config),{mode:384});for(const item of data.workspaces){if(!/^v-[a-f0-9-]{36}$/.test(item.id))throw Error('Invalid version');const dir=root+'/workspace-'+item.id;fs.mkdirSync(dir,{recursive:true,mode:448});fs.writeFileSync(dir+'/AGENTS.md',item.instructions,{mode:384});fs.writeFileSync(dir+'/SOUL.md',item.instructions,{mode:384});}});`;
export class GatewayProvisioner {
  constructor(private db: PrismaClient) {}
  async provision(runtime: RuntimeInstance) {
    const names = runtimeNames(runtime.id);
    const token = runtime.encryptedToken
      ? decryptSecret(runtime.encryptedToken, runtime.organizationId)
      : randomBytes(32).toString('hex');
    await this.db.runtimeInstance.update({
      where: { id: runtime.id },
      data: {
        status: 'PROVISIONING',
        encryptedToken: encryptSecret(token, runtime.organizationId),
        error: null,
      },
    });
    if (!(await exists('network', names.network)))
      await docker([
        'network',
        'create',
        '--driver',
        'bridge',
        '--opt',
        'com.docker.network.bridge.enable_icc=false',
        '--label',
        `colmeia.organization=${runtime.organizationId}`,
        names.network,
      ]);
    if (!(await exists('volume', names.volume)))
      await docker([
        'volume',
        'create',
        '--label',
        `colmeia.organization=${runtime.organizationId}`,
        names.volume,
      ]);
    if (!(await exists('container', names.container))) {
      // Root is used only in this networkless initializer to assign the empty volume to uid 1000.
      await docker([
        'run',
        '--rm',
        '--network',
        'none',
        '--user',
        '0',
        '--cap-drop',
        'ALL',
        '--cap-add',
        'CHOWN',
        '--entrypoint',
        'node',
        '--mount',
        `type=volume,src=${names.volume},dst=/home/node/.openclaw`,
        OPENCLAW_IMAGE,
        '-e',
        "require('node:fs').chownSync('/home/node/.openclaw',1000,1000)",
      ]);
      await this.write(runtime, token, false);
      const env = {
        ...process.env,
        OPENCLAW_GATEWAY_TOKEN: token,
        OPENAI_API_KEY: process.env.OPENAI_API_KEY || process.env.COLMEIA_AI_API_KEY || '',
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',
      };
      await docker(
        [
          'run',
          '-d',
          '--name',
          names.container,
          '--label',
          `colmeia.organization=${runtime.organizationId}`,
          '--user',
          '1000:1000',
          '--cap-drop',
          'ALL',
          '--security-opt',
          'no-new-privileges',
          '--read-only',
          '--tmpfs',
          '/tmp:rw,noexec,nosuid,size=128m',
          '--memory',
          '2g',
          '--cpus',
          '1',
          '--pids-limit',
          '128',
          '--network',
          names.network,
          '-p',
          '127.0.0.1::18789',
          '--mount',
          `type=volume,src=${names.volume},dst=/home/node/.openclaw`,
          '-e',
          'OPENCLAW_GATEWAY_TOKEN',
          '-e',
          'OPENAI_API_KEY',
          '-e',
          'ANTHROPIC_API_KEY',
          '--entrypoint',
          'node',
          OPENCLAW_IMAGE,
          'dist/index.js',
          'gateway',
          '--allow-unconfigured',
          '--bind',
          'lan',
        ],
        undefined,
        env,
      );
    } else await docker(['start', names.container]);
    const port = await docker(['port', names.container, '18789/tcp']);
    if (!/^127\.0\.0\.1:\d+$/.test(port)) throw new Error('Gateway must only bind loopback');
    const gatewayUrl = `http://${port}`;
    await this.wait(gatewayUrl, token);
    await this.db.runtimeInstance.update({
      where: { id: runtime.id },
      data: {
        gatewayUrl,
        externalRuntimeId: names.container,
        status: 'READY',
        checkedAt: new Date(),
        error: null,
      },
    });
  }
  private async write(runtime: RuntimeInstance, token: string, running: boolean) {
    const deployments = await this.db.runtimeDeployment.findMany({
      where: {
        organizationId: runtime.organizationId,
        engine: 'openclaw',
        status: { in: ['ACTIVE', 'PENDING', 'SUPERSEDED'] },
      },
      include: { version: true, agent: true },
    });
    const entries: Record<string, unknown> = {
      main: {
        name: 'Colmeia',
        model: 'openai/gpt-4.1-mini',
        workspace: '/home/node/.openclaw/workspace',
        tools: { deny: ['*'] },
        skills: [],
      },
    };
    const workspaces = deployments.map((d) => {
      const config = d.version.config as Record<string, unknown>;
      if (
        typeof config.model !== 'string' ||
        !['openai', 'anthropic'].includes(String(config.provider || 'openai'))
      )
        throw new Error('Invalid provider config');
      const id = `v-${d.versionId}`;
      entries[id] = {
        name: d.agent.name,
        workspace: `/home/node/.openclaw/workspace-${id}`,
        model: `${config.provider || 'openai'}/${config.model}`,
        tools: { deny: ['*'] },
        skills: [],
      };
      return {
        id,
        instructions: ['instructions', 'objective', 'tone', 'restrictions', 'context']
          .map((k) => (typeof config[k] === 'string' ? `${k}: ${config[k]}` : ''))
          .filter(Boolean)
          .join('\n\n'),
      };
    });
    const config = {
      gateway: {
        mode: 'local',
        bind: 'lan',
        auth: { mode: 'token', token },
        controlUi: { enabled: false },
        http: { endpoints: { chatCompletions: { enabled: true } } },
      },
      agents: {
        ownership: 'explicit',
        defaults: { systemAgent: { agentId: 'main' }, heartbeat: { every: '0m' } },
        entries,
      },
      tools: { deny: ['*'] },
      browser: { enabled: false },
      plugins: {
        allow: ['openai', 'anthropic'],
        slots: { memory: 'none' },
        entries: { 'memory-core': { enabled: false } },
      },
    };
    const names = runtimeNames(runtime.id);
    const args = running
      ? ['exec', '-i', names.container, 'node', '-e', writeConfiguration]
      : [
          'run',
          '--rm',
          '-i',
          '--network',
          'none',
          '--user',
          '1000:1000',
          '--cap-drop',
          'ALL',
          '--entrypoint',
          'node',
          '--mount',
          `type=volume,src=${names.volume},dst=/home/node/.openclaw`,
          OPENCLAW_IMAGE,
          '-e',
          writeConfiguration,
        ];
    await docker(args, JSON.stringify({ config, workspaces }));
  }
  private async wait(url: string, token: string, target?: string) {
    const deadline = Date.now() + 90000;
    while (Date.now() < deadline) {
      try {
        const models = await gatewayHealth(url, token);
        if (!target || models.includes(`openclaw/v-${target}`)) return;
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    throw new Error('Gateway health check failed');
  }
  async deploy(runtime: RuntimeInstance, versionId: string) {
    if (!runtime.gatewayUrl || !runtime.encryptedToken || runtime.status !== 'READY')
      throw new Error('Runtime not ready');
    const deployment = await this.db.runtimeDeployment.findFirstOrThrow({
      where: { versionId, organizationId: runtime.organizationId, engine: 'openclaw' },
    });
    if (
      await this.db.agentExecution.count({
        where: { organizationId: runtime.organizationId, engine: 'openclaw', status: 'RUNNING' },
      })
    )
      throw new Error('Wait for running executions before deployment');
    await this.db.runtimeDeployment.update({
      where: { id: deployment.id },
      data: { status: 'PENDING', error: null },
    });
    const token = decryptSecret(runtime.encryptedToken, runtime.organizationId);
    await this.db.runtimeInstance.update({
      where: { id: runtime.id },
      data: { status: 'PROVISIONING' },
    });
    await docker(['stop', '--time', '60', runtimeNames(runtime.id).container]);
    await this.write(runtime, token, false);
    await docker(['start', runtimeNames(runtime.id).container]);
    await this.wait(runtime.gatewayUrl, token, versionId);
    await this.db.runtimeInstance.update({
      where: { id: runtime.id },
      data: { status: 'READY', checkedAt: new Date(), error: null },
    });
    await this.db.$transaction(async (tx) => {
      await tx.runtimeDeployment.updateMany({
        where: { agentId: deployment.agentId, status: 'ACTIVE', versionId: { not: versionId } },
        data: { status: 'SUPERSEDED' },
      });
      await tx.runtimeDeployment.update({
        where: { id: deployment.id },
        data: { status: 'ACTIVE', error: null },
      });
      await tx.agentVersion.update({ where: { id: versionId }, data: { publishedAt: new Date() } });
      await tx.agent.update({ where: { id: deployment.agentId }, data: { status: 'ACTIVE' } });
      await tx.auditEvent.create({
        data: {
          organizationId: runtime.organizationId,
          actorSubject: 'runtime-worker',
          action: 'agent.deployed',
          resourceId: versionId,
        },
      });
    });
  }
  async destroy(runtime: RuntimeInstance) {
    const names = runtimeNames(runtime.id);
    if (await exists('container', names.container)) await docker(['rm', '-f', names.container]);
    if (await exists('network', names.network)) await docker(['network', 'rm', names.network]);
    // Keep the labeled volume for explicit retention/backup. It is never reused by another runtime.
    await this.db.runtimeInstance.update({
      where: { id: runtime.id },
      data: { status: 'DESTROYED', gatewayUrl: null, encryptedToken: null },
    });
    await this.db.runtimeDeployment.updateMany({
      where: { organizationId: runtime.organizationId, engine: 'openclaw', status: 'ACTIVE' },
      data: { status: 'SUSPENDED' },
    });
  }
}
