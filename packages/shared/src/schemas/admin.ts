import { z } from 'zod';
import { uuid, isoTimestamp, ianaTimezone } from '../ids';
import {
  tenantType,
  tenantStatus,
  siteStatus,
  connectorKind,
  connectorStatus,
} from '../enums';

/** M12 — Admin & sécurité: tenants, sites, users, RBAC, connectors, audit. */
export const tenant = z.object({
  id: uuid,
  name: z.string(),
  type: tenantType,
  status: tenantStatus,
  locale: z.string().default('fr-FR'),
  createdAt: isoTimestamp,
});
export type Tenant = z.infer<typeof tenant>;

/** White-label branding (marque blanche) consumed by the web at runtime. */
export const tenantBranding = z.object({
  tenantId: uuid,
  appName: z.string(),
  logoUrl: z.string().nullable(),
  primaryColor: z.string(), // hex, drives --primary
});
export type TenantBranding = z.infer<typeof tenantBranding>;

/** 14-digit meter identifier (Enedis PDL/PRM, GRDF PCE) or null. */
const meterId = z
  .string()
  .regex(/^\d{14}$/, '14 chiffres attendus')
  .nullable();

export const site = z.object({
  id: uuid,
  tenantId: uuid,
  networkId: uuid.nullable(),
  name: z.string(),
  address: z.string().nullable(),
  city: z.string().nullable(),
  postalCode: z.string().nullable(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  surfaceM2: z.number().nullable(), // for OPERAT
  /** E.164 phone number that receives SMS alerts for this site (null = none). */
  smsNumber: z.string().nullable(),
  /** Enedis PDL/PRM — 14 digits (null = not set). */
  pdl: meterId,
  /** GRDF PCE — 14 digits (null = not set). */
  pce: meterId,
  timezone: ianaTimezone.default('Europe/Paris'),
  status: siteStatus,
  openedAt: isoTimestamp.nullable(),
});
export type Site = z.infer<typeof site>;

export const createSiteInput = site
  .omit({ id: true, tenantId: true })
  .partial()
  .extend({ name: z.string().min(1) });
export type CreateSiteInput = z.infer<typeof createSiteInput>;

/** Partial in-place edit of a site (drives the auto-saving sites table). */
export const updateSiteInput = z.object({
  siteId: uuid,
  patch: site
    .pick({
      name: true,
      address: true,
      city: true,
      postalCode: true,
      lat: true,
      lng: true,
      surfaceM2: true,
      smsNumber: true,
      pdl: true,
      pce: true,
      status: true,
    })
    .partial(),
});
export type UpdateSiteInput = z.infer<typeof updateSiteInput>;

/** Update the SMS alert recipient for one site. */
export const updateSiteSmsInput = z.object({
  siteId: uuid,
  smsNumber: z.string().nullable(),
});
export type UpdateSiteSmsInput = z.infer<typeof updateSiteSmsInput>;

/** Site contact directory entry (email or phone). */
export const siteContact = z.object({
  id: uuid,
  siteId: uuid,
  kind: z.enum(['email', 'phone']),
  value: z.string().min(1),
  label: z.string().nullable(),
  isAlertRecipient: z.boolean(),
});
export type SiteContact = z.infer<typeof siteContact>;

export const siteContactInput = z.object({
  siteId: uuid,
  kind: z.enum(['email', 'phone']),
  value: z.string().min(1),
  label: z.string().nullable().default(null),
  isAlertRecipient: z.boolean().default(false),
});
export type SiteContactInput = z.infer<typeof siteContactInput>;

export const appUser = z.object({
  id: uuid,
  tenantId: uuid,
  email: z.string().email(),
  fullName: z.string(),
  locale: z.string().default('fr-FR'),
  status: z.enum(['active', 'invited', 'disabled']),
  lastLoginAt: isoTimestamp.nullable(),
  roles: z.array(z.string()),
});
export type AppUser = z.infer<typeof appUser>;

export const inviteUserInput = z.object({
  email: z.string().email(),
  fullName: z.string().min(1),
  roleKeys: z.array(z.string()).min(1),
  scopeType: z.enum(['tenant', 'network', 'site']).default('tenant'),
  scopeId: uuid.optional(),
});
export type InviteUserInput = z.infer<typeof inviteUserInput>;

/** Replace the role assignment of an existing user. */
export const updateUserRolesInput = z.object({
  userId: uuid,
  roleKeys: z.array(z.string()).min(1),
  scopeType: z.enum(['tenant', 'network', 'site']).default('tenant'),
  scopeId: uuid.optional(),
});
export type UpdateUserRolesInput = z.infer<typeof updateUserRolesInput>;

export const role = z.object({
  id: uuid,
  key: z.string(),
  label: z.string(),
  isSystem: z.boolean(),
});
export type Role = z.infer<typeof role>;

/** RBAC matrix payload for the Settings screen (rows × role columns). */
export const rbacMatrix = z.object({
  roles: z.array(z.object({ key: z.string(), label: z.string() })),
  rows: z.array(
    z.object({
      permissionKey: z.string(),
      label: z.string(),
      /** Allowed flags aligned with `roles` order. */
      allowed: z.array(z.boolean()),
    }),
  ),
});
export type RbacMatrix = z.infer<typeof rbacMatrix>;

export const connector = z.object({
  id: z.string(), // stable provider id (e.g. "lm_control")
  name: z.string(),
  kind: connectorKind,
  kindLabel: z.string(),
  status: connectorStatus,
  note: z.string(),
  lastSyncAt: isoTimestamp.nullable(),
});
export type Connector = z.infer<typeof connector>;

export const connectorCategory = z.object({
  group: z.string(),
  items: z.array(connector),
});
export type ConnectorCategory = z.infer<typeof connectorCategory>;

export const auditEvent = z.object({
  id: uuid,
  at: isoTimestamp,
  userLabel: z.string(),
  action: z.string(),
  entityLabel: z.string(),
});
export type AuditEvent = z.infer<typeof auditEvent>;

export const adminSummary = z.object({
  connectors: z.array(connectorCategory),
  rbac: rbacMatrix,
  audit: z.array(auditEvent),
});
export type AdminSummary = z.infer<typeof adminSummary>;
