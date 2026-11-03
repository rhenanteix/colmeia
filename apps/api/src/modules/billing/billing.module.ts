import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService, InternalBillingProvider } from './subscriptions.service';
import { QuotasController } from './quotas.controller';
import { UsageService } from './usage.service';
import { Module } from '@nestjs/common';
import { UsageController } from '../../resources';
import { PersistenceModule } from '../../platform/persistence/persistence.module';
import { SecurityModule } from '../../platform/security/security.module';
@Module({
  imports: [PersistenceModule, SecurityModule],
  controllers: [UsageController, QuotasController, SubscriptionsController],
  providers: [UsageService, SubscriptionsService, InternalBillingProvider],
  exports: [],
})
export class BillingModule {}
