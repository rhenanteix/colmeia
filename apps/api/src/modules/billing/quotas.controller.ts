import { Controller, Get, UseGuards } from '@nestjs/common';
import { Db } from '../../platform/persistence/db';
import { JwtGuard, CurrentPrincipal, Principal } from '../../security';
import { plans, quotaSummary } from './quotas';
@Controller('billing')
@UseGuards(JwtGuard)
export class QuotasController {
  constructor(private db: Db) {}
  @Get('plans') plans() {
    return plans;
  }
  @Get('quotas') quotas(@CurrentPrincipal() p: Principal) {
    return this.db.$transaction((tx) => quotaSummary(tx, p.organizationId), {
      isolationLevel: 'RepeatableRead',
    });
  }
}
