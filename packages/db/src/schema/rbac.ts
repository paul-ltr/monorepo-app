import { boolean, index, primaryKey, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { core, pk, timestamps } from './_columns';
import { scopeTypeEnum } from './enums';
import { tenant, appUser } from './tenancy';

/** RBAC (§8.2) — roles & permissions are data, scope-aware (EF-M9-03). */
export const role = core.table(
  'role',
  {
    id: pk(),
    /** Null tenant = system role available to all tenants. */
    tenantId: uuid('tenant_id').references(() => tenant.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    label: text('label').notNull(),
    isSystem: boolean('is_system').notNull().default(false),
    ...timestamps,
  },
  (t) => [uniqueIndex('role_tenant_key_idx').on(t.tenantId, t.key)],
);

export const permission = core.table('permission', {
  id: pk(),
  key: text('key').notNull().unique(),
  label: text('label').notNull(),
  module: text('module').notNull(),
});

export const rolePermission = core.table(
  'role_permission',
  {
    roleId: uuid('role_id')
      .notNull()
      .references(() => role.id, { onDelete: 'cascade' }),
    permissionId: uuid('permission_id')
      .notNull()
      .references(() => permission.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.roleId, t.permissionId] })],
);

export const userRole = core.table(
  'user_role',
  {
    id: pk(),
    userId: uuid('user_id')
      .notNull()
      .references(() => appUser.id, { onDelete: 'cascade' }),
    roleId: uuid('role_id')
      .notNull()
      .references(() => role.id, { onDelete: 'cascade' }),
    scopeType: scopeTypeEnum('scope_type').notNull().default('tenant'),
    /** Null scope_id = the whole scope_type level (e.g. all sites). */
    scopeId: uuid('scope_id'),
  },
  (t) => [index('user_role_user_idx').on(t.userId)],
);
