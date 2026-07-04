import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { fixtures } from '@pilotage/api-client';
import type {
  AccountUser,
  CreateAccountInput,
  CreateSupportTicketInput,
  ReplyTicketInput,
  SupportTicket,
  TenantGroup,
  UpdateAccountInput,
} from '@pilotage/shared';

/**
 * In-memory back-office state seeded from the shared fixtures. Stands in for the
 * `core.support_ticket` / tenant / user tables until they are wired to the DB;
 * keeps the console fully functional (reads + writes) in dev and demo.
 */
@Injectable()
export class ConsoleStore {
  private readonly tickets: SupportTicket[] = fixtures.supportTickets.map((t) => ({
    ...t,
    messages: [...t.messages],
  }));
  private readonly groups: TenantGroup[] = fixtures.tenantGroups.map((g) => ({ ...g }));
  private readonly accounts: AccountUser[] = fixtures.accounts.map((a) => ({ ...a }));
  private seq = 1043;

  listTickets(): SupportTicket[] {
    return this.tickets;
  }

  createTicket(
    input: CreateSupportTicketInput,
    requester: { name: string; email: string; groupId: string; groupName: string },
  ): SupportTicket {
    const now = new Date().toISOString();
    const ticket: SupportTicket = {
      id: randomUUID(),
      ref: `SUP-${this.seq++}`,
      subject: input.subject,
      groupId: requester.groupId,
      groupName: requester.groupName,
      requesterName: requester.name,
      requesterEmail: requester.email,
      status: 'open',
      priority: input.priority,
      category: input.category,
      createdAt: now,
      updatedAt: now,
      messages: [{ id: randomUUID(), authorName: requester.name, authorRole: 'client', body: input.body, at: now }],
    };
    this.tickets.unshift(ticket);
    return ticket;
  }

  replyTicket(input: ReplyTicketInput, staffName: string): SupportTicket | null {
    const ticket = this.tickets.find((t) => t.id === input.ticketId);
    if (!ticket) return null;
    const now = new Date().toISOString();
    if (input.body) {
      ticket.messages.push({ id: randomUUID(), authorName: staffName, authorRole: 'staff', body: input.body, at: now });
    }
    if (input.status) ticket.status = input.status;
    ticket.updatedAt = now;
    return ticket;
  }

  listGroups(): TenantGroup[] {
    return this.groups;
  }

  listAccounts(): AccountUser[] {
    return this.accounts;
  }

  createAccount(input: CreateAccountInput): AccountUser {
    const group = this.groups.find((g) => g.id === input.groupId);
    const account: AccountUser = {
      id: randomUUID(),
      groupId: input.groupId,
      groupName: group?.name ?? '—',
      fullName: input.fullName,
      email: input.email,
      role: input.role,
      status: 'invited',
      lastActiveAt: null,
      createdAt: new Date().toISOString(),
    };
    this.accounts.unshift(account);
    if (group) group.usersCount += 1;
    return account;
  }

  updateAccount(input: UpdateAccountInput): AccountUser | null {
    const account = this.accounts.find((a) => a.id === input.id);
    if (!account) return null;
    if (input.role) account.role = input.role;
    if (input.status) account.status = input.status;
    return account;
  }
}
