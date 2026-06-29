import { bigint, char, index, integer, jsonb, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { core, pk, tenantIdCol, timestamps, softDelete } from './_columns';
import { loyaltyTierEnum, campaignChannelEnum } from './enums';

/** Customers, loyalty, subscriptions (M3/M8, §8.2) — RGPD-aware, minimal PII. */
export const customer = core.table(
  'customer',
  {
    id: pk(),
    tenantId: tenantIdCol(),
    externalAuthId: text('external_auth_id'),
    email: text('email'),
    phone: text('phone'),
    firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).defaultNow().notNull(),
    consent: jsonb('consent'),
    ...timestamps,
    ...softDelete,
  },
  (t) => [index('customer_tenant_idx').on(t.tenantId)],
);

export const wallet = core.table('wallet', {
  id: pk(),
  tenantId: tenantIdCol(),
  customerId: uuid('customer_id')
    .notNull()
    .references(() => customer.id, { onDelete: 'cascade' }),
  balanceCents: bigint('balance_cents', { mode: 'number' }).notNull().default(0),
  currency: char('currency', { length: 3 }).notNull().default('EUR'),
  ...timestamps,
});

export const loyaltyAccount = core.table('loyalty_account', {
  id: pk(),
  tenantId: tenantIdCol(),
  customerId: uuid('customer_id')
    .notNull()
    .references(() => customer.id, { onDelete: 'cascade' }),
  points: integer('points').notNull().default(0),
  tier: loyaltyTierEnum('tier').notNull().default('bronze'),
  ...timestamps,
});

export const loyaltyTransaction = core.table('loyalty_transaction', {
  id: pk(),
  tenantId: tenantIdCol(),
  loyaltyAccountId: uuid('loyalty_account_id')
    .notNull()
    .references(() => loyaltyAccount.id, { onDelete: 'cascade' }),
  delta: integer('delta').notNull(),
  reason: text('reason'),
  ref: text('ref'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const customerSubscription = core.table('customer_subscription', {
  id: pk(),
  tenantId: tenantIdCol(),
  customerId: uuid('customer_id')
    .notNull()
    .references(() => customer.id, { onDelete: 'cascade' }),
  plan: text('plan').notNull(),
  status: text('status').notNull().default('active'),
  period: text('period'),
  ...timestamps,
});

export const segment = core.table(
  'segment',
  {
    id: pk(),
    tenantId: tenantIdCol(),
    name: text('name').notNull(),
    definition: jsonb('definition'),
    ...timestamps,
  },
  (t) => [index('segment_tenant_idx').on(t.tenantId)],
);

export const campaign = core.table(
  'campaign',
  {
    id: pk(),
    tenantId: tenantIdCol(),
    label: text('label').notNull(),
    channel: campaignChannelEnum('channel').notNull(),
    segmentId: uuid('segment_id').references(() => segment.id, { onDelete: 'set null' }),
    content: jsonb('content'),
    schedule: jsonb('schedule'),
    status: text('status').notNull().default('draft'),
    ...timestamps,
  },
  (t) => [index('campaign_tenant_idx').on(t.tenantId)],
);
