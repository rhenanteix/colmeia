import {
  Module,
  Controller,
  UseGuards,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Headers,
} from '@nestjs/common';
import { IsString, MinLength, MaxLength, IsObject, IsInt, Min, IsBoolean } from 'class-validator';
import { JwtGuard, CurrentPrincipal, Principal } from '../../security';
import { PersistenceModule } from '../../platform/persistence/persistence.module';
import { SecurityModule } from '../../platform/security/security.module';
import { WorkflowsService } from './workflows.service';
class DraftDto {
  @IsString() @MinLength(2) @MaxLength(100) name!: string;
  @IsObject() draft!: Record<string, unknown>;
}
class RevisionDto {
  @IsInt() @Min(0) revision!: number;
}
class SaveDto extends DraftDto {
  @IsInt() @Min(0) revision!: number;
}
class ActiveDto {
  @IsBoolean() active!: boolean;
}
class RunDto {
  @IsString() @MinLength(1) @MaxLength(128) idempotencyKey!: string;
  @IsObject() input!: Record<string, unknown>;
}
class WebhookDto {
  @IsObject() input!: Record<string, unknown>;
}
@Controller('workflows')
@UseGuards(JwtGuard)
class WorkflowsController {
  constructor(private service: WorkflowsService) {}
  @Get() list(@CurrentPrincipal() p: Principal) {
    return this.service.list(p);
  }
  @Post() create(@CurrentPrincipal() p: Principal, @Body() d: DraftDto) {
    return this.service.create(p, d.name, d.draft);
  }
  @Get(':id') get(@CurrentPrincipal() p: Principal, @Param('id') id: string) {
    return this.service.get(p, id);
  }
  @Patch(':id') save(
    @CurrentPrincipal() p: Principal,
    @Param('id') id: string,
    @Body() d: SaveDto,
  ) {
    return this.service.save(p, id, d.name, d.draft, d.revision);
  }
  @Post(':id/publish') publish(
    @CurrentPrincipal() p: Principal,
    @Param('id') id: string,
    @Body() d: RevisionDto,
  ) {
    return this.service.publish(p, id, d.revision);
  }
  @Post(':id/active') active(
    @CurrentPrincipal() p: Principal,
    @Param('id') id: string,
    @Body() d: ActiveDto,
  ) {
    return this.service.active(p, id, d.active);
  }
  @Post(':id/run') run(
    @CurrentPrincipal() p: Principal,
    @Param('id') id: string,
    @Body() d: RunDto,
  ) {
    return this.service.start(p, id, d.idempotencyKey, d.input);
  }
  @Get(':id/runs') runs(@CurrentPrincipal() p: Principal, @Param('id') id: string) {
    return this.service.runs(p, id);
  }
  @Post('runs/:id/cancel') cancel(@CurrentPrincipal() p: Principal, @Param('id') id: string) {
    return this.service.cancel(p, id);
  }
  @Post('runs/:id/retry') retry(@CurrentPrincipal() p: Principal, @Param('id') id: string) {
    return this.service.retry(p, id);
  }
}
@Controller('workflow-webhooks')
class WorkflowWebhooksController {
  constructor(private service: WorkflowsService) {}
  @Post(':id') receive(
    @Param('id') id: string,
    @Headers('x-workflow-secret') secret: string,
    @Headers('idempotency-key') key: string,
    @Body() d: WebhookDto,
  ) {
    return this.service.webhook(id, secret, key, d.input);
  }
}
@Module({
  imports: [PersistenceModule, SecurityModule],
  controllers: [WorkflowsController, WorkflowWebhooksController],
  providers: [WorkflowsService],
})
export class WorkflowsModule {}
