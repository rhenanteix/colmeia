import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentPrincipal, JwtGuard, Principal } from '../../security';
import { BuilderService } from './builder.service';
import { DraftDto } from './builder.dto';
@Controller('builder')
@UseGuards(JwtGuard)
export class BuilderController {
  constructor(private service: BuilderService) {}
  @Get(':agentId') get(@CurrentPrincipal() p: Principal, @Param('agentId') id: string) {
    return this.service.get(p, id);
  }
  @Post(':agentId') save(
    @CurrentPrincipal() p: Principal,
    @Param('agentId') id: string,
    @Body() d: DraftDto,
  ) {
    return this.service.save(p, id, d);
  }
  @Get(':agentId/versions') versions(
    @CurrentPrincipal() p: Principal,
    @Param('agentId') id: string,
  ) {
    return this.service.versions(p, id);
  }
  @Post(':agentId/versions') version(
    @CurrentPrincipal() p: Principal,
    @Param('agentId') id: string,
    @Body() d: DraftDto,
  ) {
    return this.service.version(p, id, d);
  }
}
