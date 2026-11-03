import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { IsIn, IsOptional, IsInt, Min, IsString, MinLength, MaxLength } from 'class-validator';
import { JwtGuard, CurrentPrincipal, Principal } from '../../security';
import { SubscriptionsService } from './subscriptions.service';
class SubscriptionDto {
  @IsIn(['change', 'cancel', 'reactivate']) action!: 'change' | 'cancel' | 'reactivate';
  @IsOptional() @IsIn(['free', 'team', 'business']) planId?: string;
  @IsInt() @Min(0) revision!: number;
  @IsString() @MinLength(1) @MaxLength(128) idempotencyKey!: string;
}
@Controller('billing/subscription')
@UseGuards(JwtGuard)
export class SubscriptionsController {
  constructor(private service: SubscriptionsService) {}
  @Get() get(@CurrentPrincipal() p: Principal) {
    return this.service.get(p);
  }
  @Post() command(@CurrentPrincipal() p: Principal, @Body() d: SubscriptionDto) {
    return this.service.command(p, d);
  }
}
