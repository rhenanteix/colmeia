import { AuthApplicationService } from './application/auth.service';
import { TeamService } from './application/team.service';
import { MailService } from '../../mail';
import { Module } from '@nestjs/common';
import { AuthController, TeamController, AuthService } from '../../identity';
import { PersistenceModule } from '../../platform/persistence/persistence.module';
import { SecurityModule } from '../../platform/security/security.module';
@Module({
  imports: [PersistenceModule, SecurityModule],
  controllers: [AuthController, TeamController],
  providers: [AuthService, MailService, AuthApplicationService, TeamService],
  exports: [AuthService],
})
export class IdentityModule {}
