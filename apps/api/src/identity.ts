import { Body, Controller, Get, Post, Patch, Delete, Param, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtGuard, CurrentPrincipal, Principal } from './security';
import { AuthApplicationService } from './modules/identity/application/auth.service';
import { TeamService } from './modules/identity/application/team.service';
import {
  RegisterDto,
  LoginDto,
  ResetRequestDto,
  ResetConfirmDto,
  SwitchDto,
  InviteDto,
  AcceptDto,
} from './modules/identity/identity.dto';
export { AuthService } from './modules/identity/application/session.service';
@Controller('auth')
@Throttle({ default: { limit: 15, ttl: 60_000 } })
export class AuthController {
  constructor(private service: AuthApplicationService) {}
  @Post('register') register(@Body() d: RegisterDto) {
    return this.service.register(d);
  }
  @Post('login') login(@Body() d: LoginDto) {
    return this.service.login(d);
  }
  @Post('password-reset/request') request(@Body() d: ResetRequestDto) {
    return this.service.request(d);
  }
  @Post('password-reset/confirm') confirm(@Body() d: ResetConfirmDto) {
    return this.service.confirm(d);
  }
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @UseGuards(JwtGuard)
  @Get('me')
  me(@CurrentPrincipal() p: Principal) {
    return this.service.me(p);
  }
  @UseGuards(JwtGuard) @Post('refresh') refresh(@CurrentPrincipal() p: Principal) {
    return this.service.refresh(p);
  }
  @UseGuards(JwtGuard) @Post('logout') logout(@CurrentPrincipal() p: Principal) {
    return this.service.logout(p);
  }
  @UseGuards(JwtGuard) @Post('switch') switchOrg(
    @CurrentPrincipal() p: Principal,
    @Body() d: SwitchDto,
  ) {
    return this.service.switchOrg(p, d);
  }
}
@Controller('team')
@UseGuards(JwtGuard)
export class TeamController {
  constructor(private service: TeamService) {}
  @Get('members') members(@CurrentPrincipal() p: Principal) {
    return this.service.members(p);
  }
  @Patch('members/:id') updateMember(
    @CurrentPrincipal() p: Principal,
    @Param('id') id: string,
    @Body() d: InviteDto,
  ) {
    return this.service.updateMember(p, id, d);
  }
  @Delete('members/:id') removeMember(@CurrentPrincipal() p: Principal, @Param('id') id: string) {
    return this.service.removeMember(p, id);
  }
  @Get('invitations') invitations(@CurrentPrincipal() p: Principal) {
    return this.service.invitations(p);
  }
  @Post('invitations') invite(@CurrentPrincipal() p: Principal, @Body() d: InviteDto) {
    return this.service.invite(p, d);
  }
  @Post('invitations/accept') accept(@CurrentPrincipal() p: Principal, @Body() d: AcceptDto) {
    return this.service.accept(p, d);
  }
  @Post('invitations/:id/revoke') revoke(
    @CurrentPrincipal() p: Principal,
    @Param('id') id: string,
  ) {
    return this.service.revoke(p, id);
  }
  @Post('invitations/:id/resend') resend(
    @CurrentPrincipal() p: Principal,
    @Param('id') id: string,
  ) {
    return this.service.resend(p, id);
  }
}
