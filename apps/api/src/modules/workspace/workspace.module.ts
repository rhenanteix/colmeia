import { OrganizationsService } from './organizations.service';
import { DashboardService } from './dashboard.service';
import { OrganizationsController, DashboardController } from '../../workspace';
import { Module } from '@nestjs/common';
import { TasksController, NotificationsController } from '../../product';
import { PersistenceModule } from '../../platform/persistence/persistence.module';
import { SecurityModule } from '../../platform/security/security.module';
@Module({
  imports: [PersistenceModule, SecurityModule],
  controllers: [
    TasksController,
    NotificationsController,
    OrganizationsController,
    DashboardController,
  ],
  providers: [OrganizationsService, DashboardService],
  exports: [],
})
export class WorkspaceModule {}
