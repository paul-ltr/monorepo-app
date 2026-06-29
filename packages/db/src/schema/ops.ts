import { index, jsonb, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { core, pk, tenantIdCol, timestamps } from './_columns';
import {
  connectorKindEnum,
  connectorStatusEnum,
  deviceCommandTypeEnum,
  deviceCommandStatusEnum,
  notificationSeverityEnum,
} from './enums';
import { site, appUser } from './tenancy';
import { machine } from './assets';

/** Integrations, commands, ops, audit (M1/M12, §8.2). */
export const connectorConfig = core.table(
  'connector_config',
  {
    id: pk(),
    tenantId: tenantIdCol(),
    siteId: uuid('site_id').references(() => site.id, { onDelete: 'cascade' }),
    kind: connectorKindEnum('kind').notNull(),
    provider: text('provider').notNull(),
    config: jsonb('config'),
    /** Only an ARN/ref here; the secret lives in Secrets Manager. */
    secretRef: text('secret_ref'),
    status: connectorStatusEnum('status').notNull().default('not_connected'),
    lastSyncAt: timestamp('last_sync_at', { withTimezone: true }),
    lastError: text('last_error'),
    ...timestamps,
  },
  (t) => [index('connector_tenant_idx').on(t.tenantId)],
);

/** App writes; the data repo consumes and executes (Should — remote actions). */
export const deviceCommand = core.table(
  'device_command',
  {
    id: pk(),
    tenantId: tenantIdCol(),
    siteId: uuid('site_id')
      .notNull()
      .references(() => site.id, { onDelete: 'cascade' }),
    machineId: uuid('machine_id')
      .notNull()
      .references(() => machine.id, { onDelete: 'cascade' }),
    type: deviceCommandTypeEnum('type').notNull(),
    payload: jsonb('payload'),
    status: deviceCommandStatusEnum('status').notNull().default('queued'),
    requestedBy: uuid('requested_by').references(() => appUser.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    executedAt: timestamp('executed_at', { withTimezone: true }),
  },
  (t) => [
    index('device_command_tenant_idx').on(t.tenantId),
    index('device_command_status_idx').on(t.status),
  ],
);

export const notification = core.table(
  'notification',
  {
    id: pk(),
    tenantId: tenantIdCol(),
    userId: uuid('user_id').references(() => appUser.id, { onDelete: 'cascade' }),
    severity: notificationSeverityEnum('severity').notNull().default('info'),
    type: text('type'),
    title: text('title').notNull(),
    body: text('body'),
    link: text('link'),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('notification_tenant_idx').on(t.tenantId)],
);

export const auditLog = core.table(
  'audit_log',
  {
    id: pk(),
    tenantId: tenantIdCol(),
    userId: uuid('user_id').references(() => appUser.id, { onDelete: 'set null' }),
    action: text('action').notNull(),
    entityType: text('entity_type'),
    entityId: text('entity_id'),
    before: jsonb('before'),
    after: jsonb('after'),
    ip: text('ip'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('audit_tenant_idx').on(t.tenantId)],
);
