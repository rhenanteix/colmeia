import { Module } from '@nestjs/common';
import { JwtGuard } from '../../security';
import { PersistenceModule } from '../persistence/persistence.module';
@Module({ imports: [PersistenceModule], providers: [JwtGuard], exports: [JwtGuard] })
export class SecurityModule {}
