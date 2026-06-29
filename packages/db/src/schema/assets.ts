import { sql } from 'drizzle-orm';
import { date, index, integer, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { core, pk, tenantIdCol, timestamps } from './_columns';
import {
  machineKindEnum,
  machineBrandEnum,
  machineStateEnum,
  paymentCentralBrandEnum,
} from './enums';
import { tenant, site } from './tenancy';

/** Assets (§8.2) — payment centrals, machines, programs. */
export const paymentCentral = core.table(
  'payment_central',
  {
    id: pk(),
    tenantId: tenantIdCol().references(() => tenant.id, { onDelete: 'cascade' }),
    siteId: uuid('site_id')
      .notNull()
      .references(() => site.id, { onDelete: 'cascade' }),
    brand: paymentCentralBrandEnum('brand').notNull(),
    model: text('model'),
    maxOutputs: integer('max_outputs'),
    externalRef: text('external_ref'),
    installedAt: date('installed_at'),
    status: text('status').notNull().default('connected'),
    ...timestamps,
  },
  (t) => [index('payment_central_site_idx').on(t.siteId)],
);

export const machine = core.table(
  'machine',
  {
    id: pk(),
    tenantId: tenantIdCol(),
    siteId: uuid('site_id')
      .notNull()
      .references(() => site.id, { onDelete: 'cascade' }),
    centralId: uuid('central_id').references(() => paymentCentral.id, {
      onDelete: 'set null',
    }),
    kind: machineKindEnum('kind').notNull(),
    brand: machineBrandEnum('brand').notNull().default('other'),
    model: text('model'),
    serial: text('serial').notNull(),
    capacityKg: integer('capacity_kg'),
    installDate: date('install_date'),
    warrantyUntil: date('warranty_until'),
    expectedLifeCycles: integer('expected_life_cycles'),
    status: machineStateEnum('status').notNull().default('offline'),
    externalRef: text('external_ref'),
    ...timestamps,
  },
  (t) => [
    index('machine_tenant_idx').on(t.tenantId),
    index('machine_site_idx').on(t.siteId),
    uniqueIndex('machine_tenant_serial_idx').on(t.tenantId, t.serial),
    // Partial index for the common "out of service" supervision filter.
    index('machine_oos_idx')
      .on(t.siteId)
      .where(sql`status = 'out_of_service'`),
  ],
);

export const program = core.table(
  'program',
  {
    id: pk(),
    tenantId: tenantIdCol(),
    /** Null = tenant-level catalog program (e.g. "Lavage 8 kg"). */
    machineId: uuid('machine_id').references(() => machine.id, { onDelete: 'cascade' }),
    code: text('code').notNull(),
    label: text('label').notNull(),
    defaultDurationMin: integer('default_duration_min'),
    kind: machineKindEnum('kind').notNull().default('washer'),
    ...timestamps,
  },
  (t) => [index('program_tenant_idx').on(t.tenantId)],
);
