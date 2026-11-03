import {
  ApprovalDto,
  CreateApprovalDto,
  CancelApprovalDto,
} from './modules/collaboration/approvals.dto';
import { UsageService } from './modules/billing/usage.service';
import { ApprovalsService } from './modules/collaboration/approvals.service';
import { ChannelsService } from './modules/collaboration/channels.service';
import { RuntimesService } from './modules/agents/runtimes.service';
import { AgentsService } from './modules/agents/agents.service';
import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import {
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  IsObject,
  IsIn,
  IsUUID,
  IsArray,
  ArrayMaxSize,
} from 'class-validator';
import { CurrentPrincipal, JwtGuard, Principal } from './security';
export { Db } from './platform/persistence/db';
export class AgentDto {
  @IsOptional()
  @IsString()
  templateId?: string;
  @IsOptional()
  @IsIn([
    'rainha',
    'atendimento',
    'exploradora',
    'financeiro',
    'operacoes',
    'rh',
    'seguranca',
    'vendas',
  ])
  mascot?: string;
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;
}
export class ChannelDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;
}
export class MessageDto {
  @IsOptional() @IsUUID() parentId?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(30) @IsUUID('all', { each: true }) mentionIds?: string[];
  @IsString()
  @MinLength(1)
  @MaxLength(16000)
  body!: string;
}
export class MessageQueryDto {
  @IsOptional() @IsUUID() before?: string;
  @IsOptional() @IsUUID() parentId?: string;
}
export class DirectMessageDto {
  @IsUUID() userId!: string;
}
export class PublishDto {
  @IsOptional() @IsString() versionId?: string;
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}
export { ApprovalDto } from './modules/collaboration/approvals.dto';
@Controller('agents')
@UseGuards(JwtGuard)
export class AgentsController {
  constructor(private service: AgentsService) {}
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
    dto: AgentDto,
  ) {
    return this.service.create(p, dto);
  }
  @Post(':id/archive')
  async archive(
    @CurrentPrincipal()
    p: Principal,
    @Param('id')
    id: string,
  ) {
    return this.service.archive(p, id);
  }
  @Get(':id')
  async one(
    @CurrentPrincipal()
    p: Principal,
    @Param('id')
    id: string,
  ) {
    return this.service.one(p, id);
  }
  @Patch(':id')
  async update(
    @CurrentPrincipal()
    p: Principal,
    @Param('id')
    id: string,
    @Body()
    dto: AgentDto,
  ) {
    return this.service.update(p, id, dto);
  }
  @Post(':id/publish')
  async publish(
    @CurrentPrincipal()
    p: Principal,
    @Param('id')
    id: string,
    @Body()
    dto: PublishDto,
  ) {
    return this.service.publish(p, id, dto);
  }
}
@Controller('runtimes')
@UseGuards(JwtGuard)
export class RuntimesController {
  constructor(private service: RuntimesService) {}
  @Post(':id/destroy')
  destroy(@CurrentPrincipal() p: Principal, @Param('id') id: string) {
    return this.service.destroy(p, id);
  }
  @Get('capabilities')
  capabilities() {
    const baseURL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    return {
      defaultModel: process.env.AI_MODEL || 'qwen2.5:3b',
      providers: [
        {
          id: 'openai',
          configured: Boolean(process.env.OPENAI_API_KEY || process.env.COLMEIA_AI_API_KEY),
        },
        { id: 'anthropic', configured: Boolean(process.env.ANTHROPIC_API_KEY) },
        { id: 'ollama', configured: true, baseURL },
      ],
      engines: ['mastra', 'ai-sdk', 'openclaw'],
      ollama: { baseURL },
    };
  }
  @Get('status')
  list(
    @CurrentPrincipal()
    p: Principal,
  ) {
    return this.service.list(p);
  }
  @Post('provision')
  async provision(
    @CurrentPrincipal()
    p: Principal,
  ) {
    return this.service.provision(p);
  }
}
@Controller('channels')
@UseGuards(JwtGuard)
export class ChannelsController {
  constructor(private service: ChannelsService) {}
  @Get('presence') presence(@CurrentPrincipal() p: Principal) {
    return this.service.presence(p);
  }
  @Post('presence') heartbeat(@CurrentPrincipal() p: Principal) {
    return this.service.heartbeat(p);
  }
  @Post('direct') direct(@CurrentPrincipal() p: Principal, @Body() d: DirectMessageDto) {
    return this.service.direct(p, d.userId);
  }
  @Get()
  list(
    @CurrentPrincipal()
    p: Principal,
  ) {
    return this.service.list(p);
  }
  @Post()
  create(
    @CurrentPrincipal()
    p: Principal,
    @Body()
    d: ChannelDto,
  ) {
    return this.service.create(p, d);
  }
  @Get(':id/messages')
  async messages(
    @CurrentPrincipal()
    p: Principal,
    @Param('id')
    id: string,
    @Query() query: MessageQueryDto,
  ) {
    return this.service.messages(p, id, query);
  }
  @Post(':id/messages')
  async send(
    @CurrentPrincipal()
    p: Principal,
    @Param('id')
    id: string,
    @Body()
    d: MessageDto,
  ) {
    return this.service.send(p, id, d);
  }
}
@Controller('approvals')
@UseGuards(JwtGuard)
export class ApprovalsController {
  constructor(private service: ApprovalsService) {}
  @Get()
  list(
    @CurrentPrincipal()
    p: Principal,
  ) {
    return this.service.list(p);
  }
  @Post() create(@CurrentPrincipal() p: Principal, @Body() d: CreateApprovalDto) {
    return this.service.create(p, d);
  }
  @Get(':id/history') history(@CurrentPrincipal() p: Principal, @Param('id') id: string) {
    return this.service.history(p, id);
  }
  @Post(':id/cancel') cancel(
    @CurrentPrincipal() p: Principal,
    @Param('id') id: string,
    @Body() d: CancelApprovalDto,
  ) {
    return this.service.cancel(p, id, d.reason);
  }
  @Post(':id/decision')
  async decide(
    @CurrentPrincipal()
    p: Principal,
    @Param('id')
    id: string,
    @Body()
    d: ApprovalDto,
  ) {
    return this.service.decide(p, id, d);
  }
}
@Controller('usage')
@UseGuards(JwtGuard)
export class UsageController {
  constructor(private service: UsageService) {}
  @Get('summary')
  async summary(
    @CurrentPrincipal()
    p: Principal,
  ) {
    return this.service.summary(p);
  }
}
