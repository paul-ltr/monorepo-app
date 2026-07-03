import { z } from 'zod';
import type { ModuleKey } from './enums';

/**
 * RBAC catalog. Roles and permissions are *data* (seeded into `core.role` /
 * `core.permission`) so tenants can customize them — this file is the canonical
 * system default that the seed and the guards agree on.
 */

/** Permission keys follow `M<module>:<resource>[:<action>]`. */
export const PERMISSIONS = [
  { key: 'M1:dashboard:view', module: 'M1', label: 'Voir le tableau de bord' },
  { key: 'M1:machines:view', module: 'M1', label: 'Voir les machines' },
  { key: 'M1:machines:command', module: 'M1', label: 'Piloter une machine à distance' },
  { key: 'M2:revenue:view', module: 'M2', label: 'Voir les recettes' },
  { key: 'M2:reconcile', module: 'M2', label: 'Réconcilier les recettes' },
  { key: 'M2:refund:approve', module: 'M2', label: 'Valider un remboursement' },
  { key: 'M4:maintenance:view', module: 'M4', label: 'Voir la maintenance' },
  { key: 'M4:ticket:write', module: 'M4', label: 'Gérer les tickets' },
  { key: 'M5:energy:view', module: 'M5', label: "Voir l'énergie" },
  { key: 'M5:operat:generate', module: 'M5', label: 'Générer le dossier OPERAT' },
  { key: 'M6:finance:view', module: 'M6', label: 'Voir les finances' },
  { key: 'M6:fec:export', module: 'M6', label: 'Exporter le FEC' },
  { key: 'M7:pricing:view', module: 'M7', label: 'Voir les tarifs' },
  { key: 'M7:pricing:write', module: 'M7', label: 'Modifier les tarifs et promotions' },
  { key: 'M3:customers:view', module: 'M3', label: 'Voir les clients' },
  { key: 'M9:network:view', module: 'M9', label: 'Voir le réseau et le benchmark' },
  { key: 'M12:users:manage', module: 'M12', label: 'Gérer les utilisateurs et rôles' },
  { key: 'M12:connectors:manage', module: 'M12', label: 'Gérer les connecteurs' },
  { key: 'M12:audit:view', module: 'M12', label: "Voir le journal d'audit" },
  { key: 'M12:billing:manage', module: 'M12', label: 'Gérer la facturation SaaS' },
] as const satisfies ReadonlyArray<{ key: string; module: ModuleKey; label: string }>;

export type PermissionKey = (typeof PERMISSIONS)[number]['key'];
export const ALL_PERMISSION_KEYS = PERMISSIONS.map((p) => p.key) as PermissionKey[];

/** System role keys. Tenants may add custom roles on top of these. */
export const SYSTEM_ROLES = [
  'owner',
  'manager',
  'accountant',
  'technician',
  'viewer',
  'network_admin',
] as const;
export type SystemRoleKey = (typeof SYSTEM_ROLES)[number];

/**
 * Default permission grants per system role. Mirrors the RBAC matrix shown in
 * the Settings screen of the design.
 */
export const ROLE_PERMISSIONS: Record<SystemRoleKey, PermissionKey[]> = {
  owner: [...ALL_PERMISSION_KEYS],
  network_admin: [...ALL_PERMISSION_KEYS],
  manager: [
    'M1:dashboard:view',
    'M1:machines:view',
    'M1:machines:command',
    'M2:revenue:view',
    'M2:reconcile',
    'M2:refund:approve',
    'M4:maintenance:view',
    'M4:ticket:write',
    'M5:energy:view',
    'M5:operat:generate',
    'M6:finance:view',
    'M6:fec:export',
    'M7:pricing:view',
    'M7:pricing:write',
    'M3:customers:view',
    'M9:network:view',
    'M12:audit:view',
  ],
  accountant: [
    'M1:dashboard:view',
    'M2:revenue:view',
    'M2:reconcile',
    'M5:energy:view',
    'M6:finance:view',
    'M6:fec:export',
  ],
  technician: [
    'M1:dashboard:view',
    'M1:machines:view',
    'M4:maintenance:view',
    'M4:ticket:write',
  ],
  viewer: ['M1:dashboard:view', 'M5:energy:view'],
};

/** The active scope a request operates within (network/site selector). */
export const requestScope = z.object({
  type: z.enum(['tenant', 'network', 'site', 'machine']),
  id: z.string().uuid().optional(),
});
export type RequestScope = z.infer<typeof requestScope>;

/** Resolved per-request identity injected by the API's auth guard. */
export interface RequestContext {
  userId: string;
  tenantId: string;
  email: string;
  roles: string[];
  permissions: PermissionKey[];
  scope: RequestScope;
  locale: string;
  /** LavoPilot staff — grants access to the cross-tenant back-office console. */
  superuser: boolean;
}

/** LavoPilot team membership is decided by email domain. */
export function isLavoPilotStaff(email: string): boolean {
  return /@lavopilot\.com$/i.test(email.trim());
}

export function hasPermission(ctx: RequestContext, key: PermissionKey): boolean {
  return ctx.permissions.includes(key);
}

/** Does a granted scope cover a target scope? tenant ⊃ network ⊃ site ⊃ machine. */
export function scopeCovers(
  granted: RequestScope,
  target: { siteId?: string; networkId?: string },
): boolean {
  switch (granted.type) {
    case 'tenant':
      return true;
    case 'network':
      return !granted.id || granted.id === target.networkId;
    case 'site':
      return !granted.id || granted.id === target.siteId;
    case 'machine':
      return true; // machine-level checks happen at the entity layer
  }
}
