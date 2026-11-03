import { RuntimeModule } from '../runtime/runtime.module';
import { AgentsService } from './agents.service';
import { RuntimesService } from './runtimes.service';
import { Module } from '@nestjs/common';
import { AgentsController, RuntimesController } from '../../resources';
import { PersistenceModule } from '../../platform/persistence/persistence.module';
import { SecurityModule } from '../../platform/security/security.module';
@Module({
  imports: [PersistenceModule, SecurityModule, RuntimeModule],
  controllers: [AgentsController, RuntimesController],
  providers: [AgentsService, RuntimesService],
  exports: [],
})
export class AgentsModule {}
