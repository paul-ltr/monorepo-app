import { sql } from 'drizzle-orm';
import { index, integer, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { core, pk, tenantIdCol, timestamps } from './_columns';
import {
  ticketStatusEnum,
  ticketPriorityEnum,
  ticketSourceEnum,
  technicianTypeEnum,
  maintenancePlanTriggerEnum,
} from './enums';
import { site, appUser } from './tenancy';
import { machine } from './assets';

/** Maintenance & GMAO (M4, §8.2). */
export const technician = core.table('technician', {
  id: pk(),
  tenantId: tenantIdCol(),
  userId: uuid('user_id').references(() => appUser.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  type: technicianTypeEnum('type').notNull().default('internal'),
  contact: text('contact'),
  ...timestamps,
});

export const maintenanceTicket = core.table(
  'maintenance_ticket',
  {
    id: pk(),
    tenantId: tenantIdCol(),
    siteId: uuid('site_id')
      .notNull()
      .references(() => site.id, { onDelete: 'cascade' }),
    machineId: uuid('machine_id').references(() => machine.id, { onDelete: 'set null' }),
    source: ticketSourceEnum('source').notNull().default('operator'),
    priority: ticketPriorityEnum('priority').notNull().default('medium'),
    status: ticketStatusEnum('status').notNull().default('open'),
    title: text('title').notNull(),
    description: text('description'),
    probableCause: text('probable_cause'),
    assignedTechnicianId: uuid('assigned_technician_id').references(() => technician.id, {
      onDelete: 'set null',
    }),
    slaDueAt: timestamp('sla_due_at', { withTimezone: true }),
    openedAt: timestamp('opened_at', { withTimezone: true }).defaultNow().notNull(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index('ticket_tenant_idx').on(t.tenantId),
    index('ticket_site_idx').on(t.siteId),
    // Partial index for the prioritized "open tickets" queue.
    index('ticket_open_idx')
      .on(t.tenantId, t.priority)
      .where(sql`status in ('open','assigned','in_progress')`),
  ],
);

export const ticketEvent = core.table(
  'ticket_event',
  {
    id: pk(),
    tenantId: tenantIdCol(),
    ticketId: uuid('ticket_id')
      .notNull()
      .references(() => maintenanceTicket.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    note: text('note'),
    byUserId: uuid('by_user_id').references(() => appUser.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('ticket_event_ticket_idx').on(t.ticketId)],
);

export const maintenancePlan = core.table('maintenance_plan', {
  id: pk(),
  tenantId: tenantIdCol(),
  machineId: uuid('machine_id')
    .notNull()
    .references(() => machine.id, { onDelete: 'cascade' }),
  trigger: maintenancePlanTriggerEnum('trigger').notNull().default('calendar'),
  threshold: integer('threshold'),
  lastDoneAt: timestamp('last_done_at', { withTimezone: true }),
  nextDueAt: timestamp('next_due_at', { withTimezone: true }),
  ...timestamps,
});

/** Parts & stock (Could). */
export const part = core.table('part', {
  id: pk(),
  tenantId: tenantIdCol(),
  sku: text('sku').notNull(),
  label: text('label').notNull(),
  stockQty: integer('stock_qty').notNull().default(0),
  ...timestamps,
});

export const partUsage = core.table('part_usage', {
  id: pk(),
  tenantId: tenantIdCol(),
  ticketId: uuid('ticket_id')
    .notNull()
    .references(() => maintenanceTicket.id, { onDelete: 'cascade' }),
  partId: uuid('part_id')
    .notNull()
    .references(() => part.id, { onDelete: 'restrict' }),
  qty: integer('qty').notNull().default(1),
});
