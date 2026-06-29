import { sql } from 'drizzle-orm';
import { pgSchema, timestamp, uuid } from 'drizzle-orm/pg-core';

/** The `core` schema is owned by this repo (data repo owns ingest/analytics). */
export const core = pgSchema('core');

/** UUIDv7 primary key (uuidv7() is created by sql/bootstrap.sql on PG < 18). */
export const pk = () => uuid('id').primaryKey().default(sql`uuidv7()`);

/** Multi-tenancy discriminator present on every tenant-scoped core table. */
export const tenantIdCol = () => uuid('tenant_id').notNull();

/** Trigger-friendly audit timestamps. */
export const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
};

/** Soft-delete marker for tables that need it. */
export const softDelete = {
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
};
