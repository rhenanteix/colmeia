import { OpenClawAdapter } from './openclaw.adapter';
import { RuntimeJobs } from './runtime-jobs.service';
import { Module } from '@nestjs/common';
import { PersistenceModule } from '../../platform/persistence/persistence.module';
import { RuntimeService } from './runtime.service';
import { MastraAdapter } from './mastra.adapter';
import { AiSdkAdapter } from './ai-sdk.adapter';
@Module({
  imports: [PersistenceModule],
  providers: [RuntimeService, MastraAdapter, AiSdkAdapter, OpenClawAdapter, RuntimeJobs],
  exports: [RuntimeService, RuntimeJobs],
})
export class RuntimeModule {}
