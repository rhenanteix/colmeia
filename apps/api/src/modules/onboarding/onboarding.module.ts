import { Module } from '@nestjs/common';
import { OnboardingController, TemplatesController } from '../../product';
import { PersistenceModule } from '../../platform/persistence/persistence.module';
import { SecurityModule } from '../../platform/security/security.module';
@Module({
  imports: [PersistenceModule, SecurityModule],
  controllers: [OnboardingController, TemplatesController],
  providers: [],
  exports: [],
})
export class OnboardingModule {}
