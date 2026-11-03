import { Module } from '@nestjs/common';
import { PersistenceModule } from '../../platform/persistence/persistence.module';
import { SecurityModule } from '../../platform/security/security.module';
import { BuilderController } from './builder.controller';
import { BuilderService } from './builder.service';
@Module({
  imports: [PersistenceModule, SecurityModule],
  controllers: [BuilderController],
  providers: [BuilderService],
})
export class AgentBuilderModule {}
