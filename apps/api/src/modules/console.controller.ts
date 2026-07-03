import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  createAccountInput,
  createSupportTicketInput,
  replyTicketInput,
  updateAccountInput,
  type CreateAccountInput,
  type CreateSupportTicketInput,
  type ReplyTicketInput,
  type RequestContext,
  type UpdateAccountInput,
} from '@pilotage/shared';
import { AppError } from '@pilotage/shared';
import { Ctx } from '@/auth/rbac';
import { SuperuserGuard } from '@/auth/superuser';
import { ZodPipe } from '@/common/zod.pipe';
import { AuditService } from './audit.service';
import { ConsoleStore } from './console.store.service';

/**
 * Support-ticket intake — open to any authenticated user (the floating support
 * widget). The group/requester are taken from the request context, never the
 * body, so a client can only file against their own tenant.
 */
@ApiTags('support')
@Controller('support')
export class SupportController {
  constructor(
    private readonly store: ConsoleStore,
    private readonly audit: AuditService,
  ) {}

  @Post('tickets')
  async create(
    @Body(new ZodPipe(createSupportTicketInput)) body: CreateSupportTicketInput,
    @Ctx() ctx: RequestContext,
  ) {
    const group = this.store.listGroups().find((g) => g.id === ctx.tenantId);
    const ticket = this.store.createTicket(body, {
      name: ctx.email,
      email: ctx.email,
      groupId: ctx.tenantId,
      groupName: group?.name ?? 'Groupe',
    });
    await this.audit.record(ctx, 'support.ticket.create', 'support_ticket', ticket.id);
    return ticket;
  }
}

/**
 * Cross-tenant back-office console — LavoPilot staff only (SuperuserGuard).
 * Triage tickets, browse the group registry, and manage accounts.
 */
@ApiTags('console')
@UseGuards(SuperuserGuard)
@Controller('console')
export class ConsoleController {
  constructor(
    private readonly store: ConsoleStore,
    private readonly audit: AuditService,
  ) {}

  @Get('tickets')
  tickets() {
    return this.store.listTickets();
  }

  @Post('tickets/:id/reply')
  async reply(
    @Param('id') _id: string,
    @Body(new ZodPipe(replyTicketInput)) body: ReplyTicketInput,
    @Ctx() ctx: RequestContext,
  ) {
    const ticket = this.store.replyTicket(body, 'Support LavoPilot');
    if (!ticket) throw AppError.notFound('Ticket');
    await this.audit.record(ctx, 'support.ticket.reply', 'support_ticket', ticket.id);
    return ticket;
  }

  @Get('groups')
  groups() {
    return this.store.listGroups();
  }

  @Get('accounts')
  accounts() {
    return this.store.listAccounts();
  }

  @Post('accounts')
  async createAccount(
    @Body(new ZodPipe(createAccountInput)) body: CreateAccountInput,
    @Ctx() ctx: RequestContext,
  ) {
    const account = this.store.createAccount(body);
    await this.audit.record(ctx, 'console.account.create', 'app_user', account.id);
    return account;
  }

  @Post('accounts/:id')
  async updateAccount(
    @Param('id') _id: string,
    @Body(new ZodPipe(updateAccountInput)) body: UpdateAccountInput,
    @Ctx() ctx: RequestContext,
  ) {
    const account = this.store.updateAccount(body);
    if (!account) throw AppError.notFound('Compte');
    await this.audit.record(ctx, 'console.account.update', 'app_user', account.id);
    return account;
  }
}
