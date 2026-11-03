import { DashboardService } from './modules/workspace/dashboard.service';
import { OrganizationsService } from './modules/workspace/organizations.service';
import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { IsString, MinLength, MaxLength, Matches } from 'class-validator';
import { CurrentPrincipal, JwtGuard, Principal } from './security';
export class OrganizationDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug!: string;
}
@Controller('organizations')
@UseGuards(JwtGuard)
export class OrganizationsController {
  constructor(private service: OrganizationsService) {}
  @Get()
  list(
    @CurrentPrincipal()
    p: Principal,
  ) {
    return this.service.list(p);
  }
  @Post()
  async create(
    @CurrentPrincipal()
    p: Principal,
    @Body()
    d: OrganizationDto,
  ) {
    return this.service.create(p, d);
  }
  @Patch('active')
  async update(
    @CurrentPrincipal()
    p: Principal,
    @Body()
    d: OrganizationDto,
  ) {
    return this.service.update(p, d);
  }
}
@Controller('dashboard')
@UseGuards(JwtGuard)
export class DashboardController {
  constructor(private service: DashboardService) {}
  @Get()
  async get(
    @CurrentPrincipal()
    p: Principal,
  ) {
    return this.service.get(p);
  }
}
