import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  type AgentChatInput,
  type RequestContext,
  type UpdateMemoryInput,
  type UploadDocumentInput,
  agentChatInput,
  updateMemoryInput,
  uploadDocumentInput,
} from '@pilotage/shared';
import { AgentService } from './agent.service';
import { RequirePermission, Ctx } from '@/auth/rbac';
import { ZodPipe } from '@/common/zod.pipe';

/**
 * Agentic LavoPilot — the chat assistant, its per-user memory and the document
 * context users drop in. Guarded by the broad dashboard-view permission: anyone
 * who can see the overview can talk to LavoPilot.
 */
@ApiTags('agent')
@Controller('agent')
export class AgentController {
  constructor(private readonly agent: AgentService) {}

  @Post('chat')
  @RequirePermission('M1:dashboard:view')
  chat(@Body(new ZodPipe(agentChatInput)) body: AgentChatInput, @Ctx() ctx: RequestContext) {
    return this.agent.chat(ctx, body);
  }

  @Get('memory')
  @RequirePermission('M1:dashboard:view')
  getMemory(@Ctx() ctx: RequestContext) {
    return this.agent.getMemory(ctx);
  }

  @Patch('memory')
  @RequirePermission('M1:dashboard:view')
  setMemory(
    @Body(new ZodPipe(updateMemoryInput)) body: UpdateMemoryInput,
    @Ctx() ctx: RequestContext,
  ) {
    return this.agent.setMemory(ctx, body);
  }

  @Get('documents')
  @RequirePermission('M1:dashboard:view')
  getDocuments(@Ctx() ctx: RequestContext) {
    return this.agent.getDocuments(ctx);
  }

  @Post('documents')
  @RequirePermission('M1:dashboard:view')
  addDocument(
    @Body(new ZodPipe(uploadDocumentInput)) body: UploadDocumentInput,
    @Ctx() ctx: RequestContext,
  ) {
    return this.agent.addDocument(ctx, body);
  }

  @Delete('documents/:id')
  @RequirePermission('M1:dashboard:view')
  removeDocument(@Param('id') id: string, @Ctx() ctx: RequestContext) {
    return this.agent.removeDocument(ctx, id);
  }
}
