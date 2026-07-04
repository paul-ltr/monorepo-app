import { Injectable } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import { schema } from '@pilotage/db';
import type {
  AccountRole,
  AccountStatus,
  AccountUser,
  CreateAccountInput,
  CreateSupportTicketInput,
  GroupStatus,
  ReplyTicketInput,
  SupportTicket,
  SupportTicketCategory,
  SupportTicketPriority,
  SupportTicketStatus,
  TenantGroup,
} from '@pilotage/shared';
import { ScopedDb } from '@/db/db.module';

/** SaaS plan → monthly recurring revenue (cents). Stand-in until Stripe MRR. */
const PLAN_MRR: Record<string, number> = { starter: 39000, growth: 79000, scale: 149000, enterprise: 512000 };
const GROUP_STATUS: Record<string, GroupStatus> = {
  active: 'active',
  trialing: 'trial',
  trial: 'trial',
  past_due: 'past_due',
  canceled: 'suspended',
  suspended: 'suspended',
};

interface TicketRow {
  id: string;
  tenant_id: string;
  tenant_name: string;
  ref: string;
  subject: string;
  requester_name: string;
  requester_email: string;
  status: SupportTicketStatus;
  priority: SupportTicketPriority;
  category: SupportTicketCategory;
  created_at: Date;
  updated_at: Date;
}
interface MessageRow {
  id: string;
  ticket_id: string;
  author_name: string;
  author_role: 'client' | 'staff';
  body: string;
  created_at: Date;
}

/**
 * DB-backed back-office console (M12). Cross-tenant reads go through the
 * RLS-bypassing `core.v_*` views (owned by the migration role); writes are
 * scoped to the target row's tenant via `ScopedDb.runAs`, so RLS still holds.
 */
@Injectable()
export class ConsoleService {
  constructor(private readonly db: ScopedDb) {}

  private iso(d: Date | string): string {
    return (d instanceof Date ? d : new Date(d)).toISOString();
  }

  // ── Tickets ───────────────────────────────────────────────────────────────

  async listTickets(): Promise<SupportTicket[]> {
    const tickets = (
      await this.db.raw.execute(sql`
        select id, tenant_id, tenant_name, ref, subject, requester_name, requester_email,
               status, priority, category, created_at, updated_at
        from core.v_support_ticket order by updated_at desc`)
    ).rows as unknown as TicketRow[];
    const messages = (
      await this.db.raw.execute(sql`
        select id, ticket_id, author_name, author_role, body, created_at
        from core.v_support_message order by created_at asc`)
    ).rows as unknown as MessageRow[];

    const byTicket = new Map<string, MessageRow[]>();
    for (const m of messages) (byTicket.get(m.ticket_id) ?? byTicket.set(m.ticket_id, []).get(m.ticket_id)!).push(m);

    return tickets.map((t) => this.toTicket(t, byTicket.get(t.id) ?? []));
  }

  async createTicket(
    input: CreateSupportTicketInput,
    requester: { name: string; email: string; groupId: string; groupName: string },
  ): Promise<SupportTicket> {
    const count = Number(
      ((await this.db.raw.execute(sql`select count(*)::int as n from core.support_ticket`)).rows[0] as { n: number }).n,
    );
    const ref = `SUP-${1043 + count}`;
    const id = await this.db.runAs(requester.groupId, async (tx) => {
      const ticket = (
        await tx
          .insert(schema.supportTicket)
          .values({
            tenantId: requester.groupId,
            ref,
            subject: input.subject,
            requesterName: requester.name,
            requesterEmail: requester.email,
            status: 'open',
            priority: input.priority,
            category: input.category,
          })
          .returning()
      )[0]!;
      await tx.insert(schema.supportMessage).values({
        tenantId: requester.groupId,
        ticketId: ticket.id,
        authorName: requester.name,
        authorRole: 'client',
        body: input.body,
      });
      return ticket.id;
    });
    return (await this.getTicket(id))!;
  }

  async replyTicket(input: ReplyTicketInput, staffName: string): Promise<SupportTicket | null> {
    const meta = (
      await this.db.raw.execute(sql`select tenant_id from core.v_support_ticket where id = ${input.ticketId}`)
    ).rows[0] as { tenant_id: string } | undefined;
    if (!meta) return null;

    await this.db.runAs(meta.tenant_id, async (tx) => {
      if (input.body) {
        await tx.insert(schema.supportMessage).values({
          tenantId: meta.tenant_id,
          ticketId: input.ticketId,
          authorName: staffName,
          authorRole: 'staff',
          body: input.body,
        });
      }
      await tx
        .update(schema.supportTicket)
        .set({ ...(input.status ? { status: input.status } : {}), updatedAt: new Date() })
        .where(eq(schema.supportTicket.id, input.ticketId));
    });
    return this.getTicket(input.ticketId);
  }

  private async getTicket(id: string): Promise<SupportTicket | null> {
    const t = (
      await this.db.raw.execute(sql`
        select id, tenant_id, tenant_name, ref, subject, requester_name, requester_email,
               status, priority, category, created_at, updated_at
        from core.v_support_ticket where id = ${id}`)
    ).rows[0] as unknown as TicketRow | undefined;
    if (!t) return null;
    const msgs = (
      await this.db.raw.execute(sql`
        select id, ticket_id, author_name, author_role, body, created_at
        from core.v_support_message where ticket_id = ${id} order by created_at asc`)
    ).rows as unknown as MessageRow[];
    return this.toTicket(t, msgs);
  }

  private toTicket(t: TicketRow, msgs: MessageRow[]): SupportTicket {
    return {
      id: t.id,
      ref: t.ref,
      subject: t.subject,
      groupId: t.tenant_id,
      groupName: t.tenant_name,
      requesterName: t.requester_name,
      requesterEmail: t.requester_email,
      status: t.status,
      priority: t.priority,
      category: t.category,
      createdAt: this.iso(t.created_at),
      updatedAt: this.iso(t.updated_at),
      messages: msgs.map((m) => ({
        id: m.id,
        authorName: m.author_name,
        authorRole: m.author_role,
        body: m.body,
        at: this.iso(m.created_at),
      })),
    };
  }

  // ── Groups ──────────────────────────────────────────────────────────────

  async listGroups(): Promise<TenantGroup[]> {
    const rows = (
      await this.db.raw.execute(sql`
        select id, name, status, plan, billing_status, sites_count, users_count, owner_email, created_at
        from core.v_group order by name asc`)
    ).rows as unknown as Array<{
      id: string;
      name: string;
      status: string;
      plan: string;
      billing_status: string;
      sites_count: number;
      users_count: number;
      owner_email: string | null;
      created_at: Date;
    }>;
    return rows.map((g) => ({
      id: g.id,
      name: g.name,
      plan: (['starter', 'growth', 'scale', 'enterprise'].includes(g.plan) ? g.plan : 'starter') as TenantGroup['plan'],
      status: g.status === 'suspended' ? 'suspended' : (GROUP_STATUS[g.billing_status] ?? 'active'),
      sitesCount: Number(g.sites_count),
      usersCount: Number(g.users_count),
      mrrCents: PLAN_MRR[g.plan] ?? 0,
      ownerEmail: g.owner_email ?? '—',
      createdAt: this.iso(g.created_at),
    }));
  }

  // ── Accounts ────────────────────────────────────────────────────────────

  async listAccounts(): Promise<AccountUser[]> {
    const rows = (
      await this.db.raw.execute(sql`
        select id, tenant_id, tenant_name, email, full_name, status, role, last_login_at, created_at
        from core.v_app_user order by created_at desc`)
    ).rows as unknown as Array<{
      id: string;
      tenant_id: string;
      tenant_name: string;
      email: string;
      full_name: string;
      status: string;
      role: AccountRole;
      last_login_at: Date | null;
      created_at: Date;
    }>;
    return rows.map((a) => this.toAccount(a));
  }

  async createAccount(input: CreateAccountInput): Promise<AccountUser> {
    const roleId = await this.systemRoleId(input.role);
    const id = await this.db.runAs(input.groupId, async (tx) => {
      const user = (
        await tx
          .insert(schema.appUser)
          .values({ tenantId: input.groupId, email: input.email, fullName: input.fullName, status: 'invited' })
          .returning()
      )[0]!;
      if (roleId) {
        await tx
          .insert(schema.userRole)
          .values({ userId: user.id, roleId, scopeType: 'tenant', scopeId: input.groupId });
      }
      return user.id;
    });
    return (await this.getAccount(id))!;
  }

  async updateAccount(input: { id: string; role?: AccountRole; status?: AccountStatus }): Promise<AccountUser | null> {
    const meta = (
      await this.db.raw.execute(sql`select tenant_id from core.v_app_user where id = ${input.id}`)
    ).rows[0] as { tenant_id: string } | undefined;
    if (!meta) return null;
    const roleId = input.role ? await this.systemRoleId(input.role) : null;

    await this.db.runAs(meta.tenant_id, async (tx) => {
      if (input.status) {
        await tx.update(schema.appUser).set({ status: input.status }).where(eq(schema.appUser.id, input.id));
      }
      if (roleId) {
        await tx.delete(schema.userRole).where(eq(schema.userRole.userId, input.id));
        await tx
          .insert(schema.userRole)
          .values({ userId: input.id, roleId, scopeType: 'tenant', scopeId: meta.tenant_id });
      }
    });
    return this.getAccount(input.id);
  }

  private async getAccount(id: string): Promise<AccountUser | null> {
    const a = (
      await this.db.raw.execute(sql`
        select id, tenant_id, tenant_name, email, full_name, status, role, last_login_at, created_at
        from core.v_app_user where id = ${id}`)
    ).rows[0] as
      | {
          id: string;
          tenant_id: string;
          tenant_name: string;
          email: string;
          full_name: string;
          status: string;
          role: AccountRole;
          last_login_at: Date | null;
          created_at: Date;
        }
      | undefined;
    return a ? this.toAccount(a) : null;
  }

  private toAccount(a: {
    id: string;
    tenant_id: string;
    tenant_name: string;
    email: string;
    full_name: string;
    status: string;
    role: AccountRole;
    last_login_at: Date | null;
    created_at: Date;
  }): AccountUser {
    const status: AccountStatus =
      a.status === 'invited' ? 'invited' : a.status === 'suspended' ? 'suspended' : 'active';
    return {
      id: a.id,
      groupId: a.tenant_id,
      groupName: a.tenant_name,
      fullName: a.full_name,
      email: a.email,
      role: a.role,
      status,
      lastActiveAt: a.last_login_at ? this.iso(a.last_login_at) : null,
      createdAt: this.iso(a.created_at),
    };
  }

  private async systemRoleId(key: AccountRole): Promise<string | null> {
    const row = (
      await this.db.raw
        .select({ id: schema.role.id })
        .from(schema.role)
        .where(and(eq(schema.role.key, key), eq(schema.role.isSystem, true)))
        .limit(1)
    )[0];
    return row?.id ?? null;
  }
}
