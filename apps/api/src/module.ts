import { DocumentsModule } from './modules/documents/documents.module';
import { WorkflowsModule } from './modules/workflows/workflows.module';
import { ConversationsModule } from './modules/conversations/conversations.module';
import { AgentBuilderModule } from './modules/agent-builder/agent-builder.module';
import { LoggerModule } from 'nestjs-pino';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { Module, Controller, Get } from '@nestjs/common';
import { Db } from './resources';
import { PersistenceModule } from './platform/persistence/persistence.module';
import { SecurityModule } from './platform/security/security.module';
import { IdentityModule } from './modules/identity/identity.module';
import { AgentsModule } from './modules/agents/agents.module';
import { CollaborationModule } from './modules/collaboration/collaboration.module';
import { BillingModule } from './modules/billing/billing.module';
import { OnboardingModule } from './modules/onboarding/onboarding.module';
import { WorkspaceModule } from './modules/workspace/workspace.module';
import { BeeTeamsModule } from './modules/bee-teams/bee-teams.module';
@Controller('health')
class HealthController {
  @Get() status() {
    return { status: 'ok', service: 'colmeia-api' };
  }
}
@Controller('health/ready')
class ReadinessController {
  constructor(private db: Db) {}
  @Get() async ready() {
    await this.db.$queryRaw`SELECT 1`;
    return { status: 'ready' };
  }
}
@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL || 'info',
        redact: [
          'req.headers.authorization',
          'req.headers.cookie',
          'res.headers["set-cookie"]',
          'req.body',
        ],
        serializers: {
          req: (req: { id: string; method: string; url: string }) => ({
            id: req.id,
            method: req.method,
            url: req.url?.split('?')[0],
          }),
        },
      },
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    PersistenceModule,
    SecurityModule,
    IdentityModule,
    AgentsModule,
    ConversationsModule,
    AgentBuilderModule,
    CollaborationModule,
    BillingModule,
    OnboardingModule,
    WorkspaceModule,
    BeeTeamsModule,
    WorkflowsModule,
    DocumentsModule,
  ],
  controllers: [HealthController, ReadinessController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
