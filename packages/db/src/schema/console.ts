import { index, jsonb, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { core, pk, tenantIdCol, timestamps } from './_columns';
import { supportTicketStatusEnum, supportTicketPriorityEnum, supportTicketCategoryEnum } from './enums';
import { tenant, appUser } from './tenancy';

/**
 * M12 — support tickets raised by tenant users (the floating support widget) and
 * triaged by LavoPilot staff in the back-office console. Tenant-scoped (RLS); the
 * cross-tenant staff view is `core.v_support_ticket` (rls.sql).
 */
export const supportTicket = core.table(
  'support_ticket',
  {
    id: pk(),
    tenantId: tenantIdCol().references(() => tenant.id, { onDelete: 'cascade' }),
    ref: text('ref').notNull(),
    subject: text('subject').notNull(),
    requesterName: text('requester_name').notNull(),
    requesterEmail: text('requester_email').notNull(),
    status: supportTicketStatusEnum('status').notNull().default('open'),
    priority: supportTicketPriorityEnum('priority').notNull().default('normal'),
    category: supportTicketCategoryEnum('category').notNull().default('other'),
    ...timestamps,
  },
  (t) => [index('support_ticket_tenant_idx').on(t.tenantId), index('support_ticket_status_idx').on(t.status)],
);

export const supportMessage = core.table(
  'support_message',
  {
    id: pk(),
    tenantId: tenantIdCol(),
    ticketId: uuid('ticket_id')
      .notNull()
      .references(() => supportTicket.id, { onDelete: 'cascade' }),
    authorName: text('author_name').notNull(),
    authorRole: text('author_role').notNull(), // 'client' | 'staff'
    body: text('body').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    meta: jsonb('meta'),
  },
  (t) => [index('support_message_ticket_idx').on(t.ticketId)],
);
