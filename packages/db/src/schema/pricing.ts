import {
  bigint,
  boolean,
  char,
  index,
  jsonb,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { core, pk, tenantIdCol, timestamps } from './_columns';
import { machineKindEnum, priceSlotEnum } from './enums';
import { tenant, site } from './tenancy';
import { machine, program } from './assets';

/** Pricing (M7, §8.2). Money is bigint cents + ISO currency — never floats. */
export const pricePlan = core.table(
  'price_plan',
  {
    id: pk(),
    tenantId: tenantIdCol().references(() => tenant.id, { onDelete: 'cascade' }),
    siteId: uuid('site_id').references(() => site.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    active: boolean('active').notNull().default(true),
    ...timestamps,
  },
  (t) => [index('price_plan_tenant_idx').on(t.tenantId)],
);

export const price = core.table(
  'price',
  {
    id: pk(),
    tenantId: tenantIdCol(),
    pricePlanId: uuid('price_plan_id')
      .notNull()
      .references(() => pricePlan.id, { onDelete: 'cascade' }),
    machineKind: machineKindEnum('machine_kind'),
    machineId: uuid('machine_id').references(() => machine.id, { onDelete: 'cascade' }),
    programId: uuid('program_id').references(() => program.id, { onDelete: 'cascade' }),
    slot: priceSlotEnum('slot').notNull().default('standard'),
    amountCents: bigint('amount_cents', { mode: 'number' }).notNull(),
    currency: char('currency', { length: 3 }).notNull().default('EUR'),
    validFrom: timestamp('valid_from', { withTimezone: true }),
    validTo: timestamp('valid_to', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index('price_plan_idx').on(t.pricePlanId)],
);

export const promotion = core.table(
  'promotion',
  {
    id: pk(),
    tenantId: tenantIdCol(),
    label: text('label').notNull(),
    scope: text('scope').notNull().default('tenant'),
    type: text('type').notNull().default('percentage'),
    value: bigint('value', { mode: 'number' }),
    schedule: jsonb('schedule'),
    active: boolean('active').notNull().default(false),
    startsAt: timestamp('starts_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index('promotion_tenant_idx').on(t.tenantId)],
);
