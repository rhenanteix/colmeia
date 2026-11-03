import { Body, Controller, Delete, Get, Param, Patch, Post, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { CurrentPrincipal, JwtGuard, Principal } from '../../security';
import { ConversationsService } from './conversations.service';
import {
  CreateConversationDto,
  RenameConversationDto,
  SendConversationDto,
} from './conversations.dto';
@Controller()
@UseGuards(JwtGuard)
export class ConversationsController {
  constructor(private service: ConversationsService) {}
  @Get('conversations') list(@CurrentPrincipal() p: Principal) {
    return this.service.list(p);
  }
  @Post('conversations') create(
    @CurrentPrincipal() p: Principal,
    @Body() d: CreateConversationDto,
  ) {
    return this.service.create(p, d.agentId);
  }
  @Get('conversations/:id') one(@CurrentPrincipal() p: Principal, @Param('id') id: string) {
    return this.service.one(p, id);
  }
  @Patch('conversations/:id') rename(
    @CurrentPrincipal() p: Principal,
    @Param('id') id: string,
    @Body() d: RenameConversationDto,
  ) {
    return this.service.rename(p, id, d.title);
  }
  @Delete('conversations/:id') archive(@CurrentPrincipal() p: Principal, @Param('id') id: string) {
    return this.service.archive(p, id);
  }
  @Get('conversations/:id/messages') messages(
    @CurrentPrincipal() p: Principal,
    @Param('id') id: string,
  ) {
    return this.service.messages(p, id);
  }
  @Get('executions') executions(@CurrentPrincipal() p: Principal) {
    return this.service.executions(p);
  }
  @Get('executions/:id') execution(@CurrentPrincipal() p: Principal, @Param('id') id: string) {
    return this.service.execution(p, id);
  }
  @Post('executions/:id/cancel') cancel(@CurrentPrincipal() p: Principal, @Param('id') id: string) {
    return this.service.cancel(p, id);
  }
  @Post('conversations/:id/stream') async stream(
    @CurrentPrincipal() p: Principal,
    @Param('id') id: string,
    @Body() d: SendConversationDto,
    @Res() res: Response,
  ) {
    const prepared = await this.service.prepare(p, id, d);
    const abort = new AbortController();
    res.on('close', () => abort.abort());
    res.status(200).set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
      'x-vercel-ai-ui-message-stream': 'v1',
    });
    res.flushHeaders();
    const ping = setInterval(() => {
      if (!res.destroyed) res.write(': keepalive\n\n');
    }, 10000);
    try {
      await this.service.run(p, prepared, abort.signal, (chunk) => {
        if (!res.destroyed) res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      });
      if (!res.destroyed) res.write('data: [DONE]\n\n');
    } finally {
      clearInterval(ping);
      res.end();
    }
  }
}
