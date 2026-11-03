import { Module } from '@nestjs/common';
import { PersistenceModule } from '../../platform/persistence/persistence.module';
import { SecurityModule } from '../../platform/security/security.module';
import { RuntimeModule } from '../runtime/runtime.module';
import { ConversationsController } from './conversations.controller';
import { ConversationsService } from './conversations.service';
@Module({
  imports: [PersistenceModule, SecurityModule, RuntimeModule],
  controllers: [ConversationsController],
  providers: [ConversationsService],
})
export class ConversationsModule {}
