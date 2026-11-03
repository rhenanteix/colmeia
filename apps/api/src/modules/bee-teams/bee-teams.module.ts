import { Module } from '@nestjs/common';
import { BeeTeamController, BeeExecutor } from '../../bee-collaboration';
import { PersistenceModule } from '../../platform/persistence/persistence.module';
import { SecurityModule } from '../../platform/security/security.module';
@Module({
  imports: [PersistenceModule, SecurityModule],
  controllers: [BeeTeamController],
  providers: [BeeExecutor],
  exports: [BeeExecutor],
})
export class BeeTeamsModule {}
