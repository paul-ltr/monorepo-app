import { sql } from 'drizzle-orm';
import {
  boolean,
  doublePrecision,
  index,
  jsonb,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { core, pk, tenantIdCol, timestamps, softDelete } from './_columns';
import { tenantTypeEnum, tenantStatusEnum, siteStatusEnum } from './enums';

/** Tenancy & org (§8.2). */
export const tenant = core.table('tenant', {
  id: pk(),
  name: text('name').notNull(),
  type: tenantTypeEnum('type').notNull().default('independent'),
  status: tenantStatusEnum('status').notNull().default('active'),
  locale: text('locale').notNull().default('fr-FR'),
  ...timestamps,
});

export const network = core.table(
  'network',
  {
    id: pk(),
    tenantId: tenantIdCol().references(() => tenant.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    ...timestamps,
  },
  (t) => [index('network_tenant_idx').on(t.tenantId)],
);

export const tenantBranding = core.table('tenant_branding', {
  tenantId: uuid('tenant_id')
    .primaryKey()
    .references(() => tenant.id, { onDelete: 'cascade' }),
  appName: text('app_name').notNull(),
  logoUrl: text('logo_url'),
  primaryColor: text('primary_color').notNull().default('#1B4DB3'),
  ...timestamps,
});

export const site = core.table(
  'site',
  {
    id: pk(),
    tenantId: tenantIdCol().references(() => tenant.id, { onDelete: 'cascade' }),
    networkId: uuid('network_id').references(() => network.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    address: text('address'),
    city: text('city'),
    postalCode: text('postal_code'),
    lat: doublePrecision('lat'),
    lng: doublePrecision('lng'),
    /** Surface in m² — required for OPERAT (décret tertiaire). */
    surfaceM2: doublePrecision('surface_m2'),
    /** E.164 phone number that receives SMS alerts for this site. */
    smsNumber: text('sms_number'),
    /** Enedis PDL/PRM — 14 digits. Source of truth for the energy connector. */
    pdl: text('pdl'),
    /** GRDF PCE — 14 digits. Source of truth for the energy connector. */
    pce: text('pce'),
    timezone: text('timezone').notNull().default('Europe/Paris'),
    openingHours: jsonb('opening_hours'),
    status: siteStatusEnum('status').notNull().default('active'),
    openedAt: timestamp('opened_at', { withTimezone: true }),
    ...timestamps,
    ...softDelete,
  },
  (t) => [
    index('site_tenant_idx').on(t.tenantId),
    index('site_network_idx').on(t.networkId),
  ],
);

/**
 * Editable contact directory for a site (emails & phone numbers). Distinct from
 * `site.sms_number` (the single SMS-alert recipient); a contact may opt into
 * alerts via `is_alert_recipient`.
 */
export const siteContact = core.table(
  'site_contact',
  {
    id: pk(),
    tenantId: tenantIdCol().references(() => tenant.id, { onDelete: 'cascade' }),
    siteId: uuid('site_id')
      .notNull()
      .references(() => site.id, { onDelete: 'cascade' }),
    /** 'email' | 'phone'. */
    kind: text('kind').notNull(),
    value: text('value').notNull(),
    /** Free-text role, e.g. « Gérant », « Astreinte ». */
    label: text('label'),
    isAlertRecipient: boolean('is_alert_recipient').notNull().default(false),
    ...timestamps,
  },
  (t) => [index('site_contact_site_idx').on(t.siteId)],
);

/**
 * Application user. Named `app_user` rather than `user` to avoid the reserved
 * Postgres keyword. Linked to Cognito via `cognito_sub`.
 */
export const appUser = core.table(
  'app_user',
  {
    id: pk(),
    tenantId: tenantIdCol().references(() => tenant.id, { onDelete: 'cascade' }),
    cognitoSub: text('cognito_sub').unique(),
    email: text('email').notNull(),
    fullName: text('full_name').notNull(),
    locale: text('locale').notNull().default('fr-FR'),
    status: text('status').notNull().default('active'),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index('app_user_tenant_idx').on(t.tenantId),
    uniqueIndex('app_user_tenant_email_idx').on(t.tenantId, sql`lower(${t.email})`),
  ],
);
