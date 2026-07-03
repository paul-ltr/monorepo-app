import type {
  Period,
  SupportTicket,
  TenantGroup,
  AccountUser,
  CreateSupportTicketInput,
  ReplyTicketInput,
  CreateAccountInput,
  UpdateAccountInput,
} from '@pilotage/shared';
import type { PilotageApi } from './types';
import * as f from './fixtures';

const delay = <T>(value: T, ms = 180): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms));

const uid = () =>
  `00000000-0000-7000-8000-${Math.floor(Math.random() * 1e12).toString().padStart(12, '0')}`;

/** In-browser mock implementing the full API from bundled fixtures. */
export function createMockClient(): PilotageApi {
  // Mutable copies so the back-office console reflects writes within a session.
  const tickets: SupportTicket[] = f.supportTickets.map((t) => ({ ...t, messages: [...t.messages] }));
  const groups: TenantGroup[] = f.tenantGroups.map((g) => ({ ...g }));
  const accounts: AccountUser[] = f.accounts.map((a) => ({ ...a }));
  let seq = 1043;

  return {
    getSession: () => delay(f.session),
    getBranding: () => delay(f.branding),
    getDashboard: (_period: Period) => delay(f.dashboard),
    getMachineStatuses: () => delay(f.machineStatuses),
    getMachineDetail: (id: string) => delay(f.machineDetail(id)),
    getRevenue: (_period: Period) => delay(f.revenue),
    getEnergy: () => delay(f.energy),
    generateOperat: (year: number) =>
      delay({
        id: '00000000-0000-7000-8000-0000000000ff',
        year,
        status: 'ready' as const,
        siteCount: 6,
        fileKey: `operat/${year}/dossier.pdf`,
        createdAt: '2026-06-29T08:00:00.000Z',
      }),
    getMaintenance: () => delay(f.maintenance),
    getPricing: () => delay(f.pricing),
    getCustomers: () => delay(f.customers),
    getFinance: () => delay(f.finance),
    getNetwork: () => delay(f.network),
    getAdmin: () => delay(f.admin),
    getNotifications: () => delay(f.notifications),
    getSites: () => delay(f.sites),

    createSupportTicket: (input: CreateSupportTicketInput) => {
      const now = new Date().toISOString();
      const ticket: SupportTicket = {
        id: uid(),
        ref: `SUP-${seq++}`,
        subject: input.subject,
        groupId: f.session.tenant.id,
        groupName: f.session.tenant.name,
        requesterName: f.session.user.fullName,
        requesterEmail: f.session.user.email,
        status: 'open',
        priority: input.priority,
        category: input.category,
        createdAt: now,
        updatedAt: now,
        messages: [
          { id: uid(), authorName: f.session.user.fullName, authorRole: 'client', body: input.body, at: now },
        ],
      };
      tickets.unshift(ticket);
      return delay(ticket);
    },

    getSupportTickets: () => delay(tickets.map((t) => ({ ...t, messages: [...t.messages] }))),

    replySupportTicket: (input: ReplyTicketInput) => {
      const ticket = tickets.find((t) => t.id === input.ticketId);
      if (!ticket) return Promise.reject(new Error('ticket not found'));
      const now = new Date().toISOString();
      ticket.messages = [
        ...ticket.messages,
        { id: uid(), authorName: 'Support LavoPilot', authorRole: 'staff', body: input.body, at: now },
      ];
      if (input.status) ticket.status = input.status;
      ticket.updatedAt = now;
      return delay({ ...ticket, messages: [...ticket.messages] });
    },

    getTenantGroups: () => delay(groups.map((g) => ({ ...g }))),

    getAccounts: () => delay(accounts.map((a) => ({ ...a }))),

    createAccount: (input: CreateAccountInput) => {
      const group = groups.find((g) => g.id === input.groupId);
      const account: AccountUser = {
        id: uid(),
        groupId: input.groupId,
        groupName: group?.name ?? '—',
        fullName: input.fullName,
        email: input.email,
        role: input.role,
        status: 'invited',
        lastActiveAt: null,
        createdAt: new Date().toISOString(),
      };
      accounts.unshift(account);
      if (group) group.usersCount += 1;
      return delay(account);
    },

    updateAccount: (input: UpdateAccountInput) => {
      const account = accounts.find((a) => a.id === input.id);
      if (!account) return Promise.reject(new Error('account not found'));
      if (input.role) account.role = input.role;
      if (input.status) account.status = input.status;
      return delay({ ...account });
    },
  };
}
