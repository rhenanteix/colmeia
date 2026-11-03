import { Prisma } from '@prisma/client';
import {
  Body,
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  NotFoundException,
  Sse,
} from '@nestjs/common';
import { concat, of, interval, from } from 'rxjs';
import { exhaustMap } from 'rxjs/operators';
import { assertLiveSession } from './modules/collaboration/channel-access';
import {
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  IsObject,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Db } from './resources';
import { JwtGuard, CurrentPrincipal, Principal, requireRole } from './security';
class StepDto {
  @IsInt() @Min(0) @Max(8) step!: number;
  @IsOptional() @IsObject() context?: Record<string, unknown>;
}
class TemplateDto {
  @IsString() @MinLength(2) @MaxLength(100) name!: string;
  @IsOptional() @IsString() description?: string;
  @IsString() category!: string;
  @IsObject() config!: Record<string, unknown>;
}
@Controller('onboarding')
@UseGuards(JwtGuard)
export class OnboardingController {
  constructor(private db: Db) {}
  @Get() get(@CurrentPrincipal() p: Principal) {
    return this.db.onboardingProgress.findUnique({ where: { organizationId: p.organizationId } });
  }
  @Post() save(@CurrentPrincipal() p: Principal, @Body() d: StepDto) {
    requireRole(p, 'OWNER', 'ADMIN');
    return this.db.onboardingProgress.upsert({
      where: { organizationId: p.organizationId },
      create: {
        organizationId: p.organizationId,
        step: d.step,
        context: d.context ? (d.context as Prisma.InputJsonValue) : Prisma.DbNull,
        completedAt: d.step === 8 ? new Date() : null,
      },
      update: {
        step: d.step,
        context: d.context ? (d.context as Prisma.InputJsonValue) : Prisma.DbNull,
        completedAt: d.step === 8 ? new Date() : null,
      },
    });
  }
}
@Controller('templates')
@UseGuards(JwtGuard)
export class TemplatesController {
  constructor(private db: Db) {}
  @Get() list(@CurrentPrincipal() p: Principal) {
    return this.db.agentTemplate.findMany({
      where: { OR: [{ organizationId: null }, { organizationId: p.organizationId }] },
      orderBy: { name: 'asc' },
    });
  }
  @Post() create(@CurrentPrincipal() p: Principal, @Body() d: TemplateDto) {
    requireRole(p, 'OWNER', 'ADMIN');
    return this.db.agentTemplate.create({
      data: {
        organizationId: p.organizationId,
        id: 'custom-' + p.organizationId + '-' + Date.now(),
        name: d.name,
        description: d.description ?? '',
        category: d.category,
        config: d.config as Prisma.InputJsonValue,
      },
    });
  }
}
export { TasksController } from './modules/tasks/tasks.controller';
@Controller('notifications')
@UseGuards(JwtGuard)
export class NotificationsController {
  constructor(private db: Db) {}
  @Sse('events') events(@CurrentPrincipal() p: Principal) {
    return concat(of(0), interval(2000)).pipe(
      exhaustMap(() =>
        from(
          (async () => {
            await assertLiveSession(this.db, p);
            return { data: await this.list(p) };
          })(),
        ),
      ),
    );
  }
  @Get() list(@CurrentPrincipal() p: Principal) {
    return this.db.notification.findMany({
      where: { organizationId: p.organizationId, recipientSubject: p.sub },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
  @Post(':id/read') async read(@CurrentPrincipal() p: Principal, @Param('id') id: string) {
    const x = await this.db.notification.updateMany({
      where: { id, organizationId: p.organizationId, recipientSubject: p.sub },
      data: { readAt: new Date() },
    });
    if (!x.count) throw new NotFoundException();
    return { ok: true };
  }
}
