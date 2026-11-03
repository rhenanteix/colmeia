import { ChannelsService } from './channels.service';
import { ApprovalsService } from './approvals.service';
import { Module } from '@nestjs/common';
import { ChannelsController, ApprovalsController } from '../../resources';
import { PersistenceModule } from '../../platform/persistence/persistence.module';
import { SecurityModule } from '../../platform/security/security.module';
@Module({
  imports: [PersistenceModule, SecurityModule],
  controllers: [ChannelsController, ApprovalsController],
  providers: [ChannelsService, ApprovalsService],
  exports: [],
})
export class CollaborationModule {}
