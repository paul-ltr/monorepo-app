import {
  bigint,
  boolean,
  char,
  index,
  integer,
  jsonb,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { core, pk, tenantIdCol, timestamps } from './_columns';
import { chargeTypeEnum, accountingExportKindEnum, accountingProviderEnum } from './enums';
import { site, network, appUser } from './tenancy';

/** Finance & compta (M6, §8.2). */
export const charge = core.table(
  'charge',
  {
    id: pk(),
    tenantId: tenantIdCol(),
    siteId: uuid('site_id').references(() => site.id, { onDelete: 'cascade' }),
    type: chargeTypeEnum('type').notNull(),
    amountCents: bigint('amount_cents', { mode: 'number' }).notNull(),
    currency: char('currency', { length: 3 }).notNull().default('EUR'),
    period: text('period'),
    recurring: boolean('recurring').notNull().default(false),
    ...timestamps,
  },
  (t) => [index('charge_tenant_idx').on(t.tenantId)],
);

export const accountingExport = core.table('accounting_export', {
  id: pk(),
  tenantId: tenantIdCol(),
  kind: accountingExportKindEnum('kind').notNull(),
  period: text('period').notNull(),
  status: text('status').notNull().default('generating'),
  fileS3Key: text('file_s3_key'),
  createdBy: uuid('created_by').references(() => appUser.id, { onDelete: 'set null' }),
  ...timestamps,
});

export const accountingConnector = core.table('accounting_connector', {
  id: pk(),
  tenantId: tenantIdCol(),
  provider: accountingProviderEnum('provider').notNull(),
  config: jsonb('config'),
  /** ARN/ref into Secrets Manager — never the secret itself. */
  secretRef: text('secret_ref'),
  status: text('status').notNull().default('not_connected'),
  ...timestamps,
});

export const royaltyRule = core.table('royalty_rule', {
  id: pk(),
  networkId: uuid('network_id')
    .notNull()
    .references(() => network.id, { onDelete: 'cascade' }),
  basis: text('basis').notNull().default('revenue'),
  rateBps: integer('rate_bps').notNull(),
  scope: text('scope'),
  ...timestamps,
});

export const royaltyInvoice = core.table('royalty_invoice', {
  id: pk(),
  networkId: uuid('network_id')
    .notNull()
    .references(() => network.id, { onDelete: 'cascade' }),
  siteId: uuid('site_id').references(() => site.id, { onDelete: 'set null' }),
  period: text('period').notNull(),
  amountCents: bigint('amount_cents', { mode: 'number' }).notNull(),
  currency: char('currency', { length: 3 }).notNull().default('EUR'),
  status: text('status').notNull().default('to_issue'),
  ...timestamps,
});

/** Billing for the SaaS itself (Stripe). */
export const saasSubscription = core.table('saas_subscription', {
  id: pk(),
  tenantId: tenantIdCol(),
  stripeCustomerId: text('stripe_customer_id'),
  plan: text('plan').notNull().default('starter'),
  sites: integer('sites'),
  status: text('status').notNull().default('trialing'),
  currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
  ...timestamps,
});

export const invoice = core.table('invoice', {
  id: pk(),
  tenantId: tenantIdCol(),
  stripeInvoiceId: text('stripe_invoice_id'),
  amountCents: bigint('amount_cents', { mode: 'number' }).notNull(),
  currency: char('currency', { length: 3 }).notNull().default('EUR'),
  status: text('status').notNull().default('draft'),
  period: text('period'),
  ...timestamps,
});
