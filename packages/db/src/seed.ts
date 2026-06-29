/**
 * Seed: system roles/permissions + a demo tenant ("Groupe Lavéo") with 6 sites
 * and a mixed machine park, mirroring the design's data so the app looks real
 * locally. Idempotent: re-running wipes and recreates the demo tenant; the RBAC
 * catalog is upserted. Runs as the migration role (bypasses RLS).
 */
import { eq, inArray } from 'drizzle-orm';
import {
  PERMISSIONS,
  ROLE_PERMISSIONS,
  SYSTEM_ROLES,
  type SystemRoleKey,
} from '@pilotage/shared';
import { createDb } from './client';
import * as s from './schema';

const url = process.env.DATABASE_URL ?? 'postgres://pilotage:pilotage@localhost:5432/pilotage';
const db = createDb(url, { max: 1 });

/** Unwrap the single row returned by an insert ... returning(). */
function one<T>(rows: T[]): T {
  const row = rows[0];
  if (!row) throw new Error('expected an inserted row');
  return row;
}

const ROLE_LABELS: Record<SystemRoleKey, string> = {
  owner: 'Propriétaire',
  manager: 'Manager',
  accountant: 'Comptable',
  technician: 'Technicien',
  viewer: 'Lecture',
  network_admin: 'Admin réseau',
};

const SITES = [
  { name: 'Lyon-3 Guillotière', city: 'Lyon', postalCode: '69003', surfaceM2: 220 },
  { name: 'Paris-11 Voltaire', city: 'Paris', postalCode: '75011', surfaceM2: 180 },
  { name: 'Villeurbanne Gratte-Ciel', city: 'Villeurbanne', postalCode: '69100', surfaceM2: 160 },
  { name: 'Lyon-7 Jean Macé', city: 'Lyon', postalCode: '69007', surfaceM2: 140 },
  { name: 'Vénissieux Centre', city: 'Vénissieux', postalCode: '69200', surfaceM2: 200 },
  { name: 'Bron Terraillon', city: 'Bron', postalCode: '69500', surfaceM2: 120 },
] as const;

type MachineState = 'free' | 'running' | 'finished' | 'out_of_service' | 'offline';

// [code, label, kind, state, capacityKg] — Lyon-3 park, from the design.
const LYON3_MACHINES: Array<[string, string, 'washer' | 'dryer', MachineState, number]> = [
  ['LL-01', 'Lave-linge 8 kg', 'washer', 'running', 8],
  ['LL-02', 'Lave-linge 8 kg', 'washer', 'free', 8],
  ['LL-03', 'Lave-linge 8 kg', 'washer', 'running', 8],
  ['LL-04', 'Lave-linge 11 kg', 'washer', 'finished', 11],
  ['LL-05', 'Lave-linge 11 kg', 'washer', 'free', 11],
  ['LL-06', 'Lave-linge 18 kg', 'washer', 'running', 18],
  ['SL-01', 'Sèche-linge 14 kg', 'dryer', 'free', 14],
  ['SL-02', 'Sèche-linge 14 kg', 'dryer', 'running', 14],
  ['SL-03', 'Sèche-linge 14 kg', 'dryer', 'out_of_service', 14],
  ['SL-04', 'Sèche-linge 14 kg', 'dryer', 'finished', 14],
  ['LL-07', 'Lave-linge 8 kg', 'washer', 'free', 8],
  ['LL-08', 'Lave-linge 8 kg', 'washer', 'running', 8],
  ['SL-05', 'Sèche-linge 14 kg', 'dryer', 'offline', 14],
  ['LL-09', 'Lave-linge 11 kg', 'washer', 'free', 11],
  ['SL-06', 'Sèche-linge 14 kg', 'dryer', 'out_of_service', 14],
  ['LL-10', 'Lave-linge 8 kg', 'washer', 'finished', 8],
];

const PROGRAMS = [
  { code: 'WASH8', label: 'Lavage 8 kg', kind: 'washer' as const, dur: 32 },
  { code: 'WASH11', label: 'Lavage 11 kg', kind: 'washer' as const, dur: 38 },
  { code: 'WASH18', label: 'Lavage 18 kg', kind: 'washer' as const, dur: 45 },
  { code: 'DRY10', label: 'Séchage · 10 min', kind: 'dryer' as const, dur: 10 },
];

// program code → [standard, offpeak, peak, weekend] in cents
const PRICES: Record<string, [number, number, number, number]> = {
  WASH8: [450, 380, 500, 480],
  WASH11: [650, 550, 700, 680],
  WASH18: [900, 780, 1000, 950],
  DRY10: [150, 120, 180, 160],
};

async function seedRbac() {
  await db
    .insert(s.permission)
    .values(PERMISSIONS.map((p) => ({ key: p.key, label: p.label, module: p.module })))
    .onConflictDoNothing({ target: s.permission.key });

  for (const key of SYSTEM_ROLES) {
    await db
      .insert(s.role)
      .values({ tenantId: null, key, label: ROLE_LABELS[key], isSystem: true })
      .onConflictDoNothing();
  }

  const roles = await db.select().from(s.role).where(eq(s.role.isSystem, true));
  const perms = await db.select().from(s.permission);
  const permByKey = new Map(perms.map((p) => [p.key, p.id]));

  for (const role of roles) {
    const keys = ROLE_PERMISSIONS[role.key as SystemRoleKey] ?? [];
    const rows = keys
      .map((k) => permByKey.get(k))
      .filter((id): id is string => Boolean(id))
      .map((permissionId) => ({ roleId: role.id, permissionId }));
    if (rows.length) await db.insert(s.rolePermission).values(rows).onConflictDoNothing();
  }
}

async function seedDemoTenant() {
  // Idempotency: wipe any existing demo tenant (cascade) then recreate.
  const existing = await db.select().from(s.tenant).where(eq(s.tenant.name, 'Groupe Lavéo'));
  if (existing.length) {
    await db.delete(s.tenant).where(
      inArray(
        s.tenant.id,
        existing.map((t) => t.id),
      ),
    );
  }

  const tenant = one(
    await db
      .insert(s.tenant)
      .values({ name: 'Groupe Lavéo', type: 'multi_site', locale: 'fr-FR' })
      .returning(),
  );

  await db.insert(s.tenantBranding).values({
    tenantId: tenant.id,
    appName: 'Pilotage',
    primaryColor: '#1B4DB3',
  });

  const network = one(
    await db.insert(s.network).values({ tenantId: tenant.id, name: 'Réseau Lavéo' }).returning(),
  );

  const owner = one(
    await db
      .insert(s.appUser)
      .values({
        tenantId: tenant.id,
        email: 'demo@laveo.fr',
        fullName: 'Sophie Diallo',
        cognitoSub: 'dev-sophie-diallo',
      })
      .returning(),
  );

  const ownerRole = (await db.select().from(s.role).where(eq(s.role.key, 'owner')))[0];
  if (ownerRole) {
    await db.insert(s.userRole).values({
      userId: owner.id,
      roleId: ownerRole.id,
      scopeType: 'tenant',
      scopeId: tenant.id,
    });
  }

  const sites = await db
    .insert(s.site)
    .values(
      SITES.map((site) => ({
        tenantId: tenant.id,
        networkId: network.id,
        name: site.name,
        city: site.city,
        postalCode: site.postalCode,
        surfaceM2: site.surfaceM2,
        status: 'active' as const,
      })),
    )
    .returning();

  // Catalog programs + a standard price plan.
  const programs = await db
    .insert(s.program)
    .values(
      PROGRAMS.map((p) => ({
        tenantId: tenant.id,
        code: p.code,
        label: p.label,
        kind: p.kind,
        defaultDurationMin: p.dur,
      })),
    )
    .returning();

  const plan = one(
    await db
      .insert(s.pricePlan)
      .values({ tenantId: tenant.id, name: 'Grille standard', active: true })
      .returning(),
  );

  const slots = ['standard', 'offpeak', 'peak', 'weekend'] as const;
  const priceRows = programs.flatMap((prog) => {
    const tariff = PRICES[prog.code];
    if (!tariff) return [];
    return slots.map((slot, i) => ({
      tenantId: tenant.id,
      pricePlanId: plan.id,
      programId: prog.id,
      slot,
      amountCents: tariff[i]!,
      currency: 'EUR',
    }));
  });
  await db.insert(s.price).values(priceRows);

  // Machine park: full list for Lyon-3, a handful elsewhere.
  const lyon3 = sites[0]!;
  await db.insert(s.machine).values(
    LYON3_MACHINES.map(([code, label, kind, state, cap]) => ({
      tenantId: tenant.id,
      siteId: lyon3.id,
      kind,
      brand: 'speed_queen' as const,
      model: label,
      serial: `${code}-2241`,
      capacityKg: cap,
      status: state,
    })),
  );

  for (const site of sites.slice(1)) {
    await db.insert(s.machine).values(
      [1, 2, 3, 4].map((n) => ({
        tenantId: tenant.id,
        siteId: site.id,
        kind: (n % 2 === 0 ? 'dryer' : 'washer') as 'washer' | 'dryer',
        brand: 'speed_queen' as const,
        serial: `${site.postalCode}-M${n}`,
        capacityKg: n % 2 === 0 ? 14 : 8,
        status: 'free' as const,
      })),
    );
  }

  // A couple of open maintenance tickets (also surfaced on the dashboard).
  const venissieux = sites[4]!;
  await db.insert(s.maintenanceTicket).values([
    {
      tenantId: tenant.id,
      siteId: venissieux.id,
      title: 'Sèche-linge SL-03 — Erreur E-04',
      source: 'alarm',
      priority: 'high',
      status: 'open',
    },
    {
      tenantId: tenant.id,
      siteId: venissieux.id,
      title: "Surconsommation d'eau — fuite probable",
      source: 'alarm',
      priority: 'high',
      status: 'assigned',
    },
  ]);

  // Connectors registry (drives the Settings screen).
  await db.insert(s.connectorConfig).values([
    { tenantId: tenant.id, kind: 'payment_central', provider: 'lm_control', status: 'connected' },
    { tenantId: tenant.id, kind: 'machine_brand', provider: 'speed_queen', status: 'connected' },
    { tenantId: tenant.id, kind: 'machine_brand', provider: 'girbau', status: 'error', lastError: 'Jeton expiré' },
    { tenantId: tenant.id, kind: 'llm', provider: 'mistral', status: 'connected' },
    { tenantId: tenant.id, kind: 'billing', provider: 'stripe', status: 'connected' },
    { tenantId: tenant.id, kind: 'accounting', provider: 'pennylane', status: 'not_connected' },
    { tenantId: tenant.id, kind: 'energy', provider: 'enedis', status: 'connected' },
    { tenantId: tenant.id, kind: 'messaging', provider: 'brevo', status: 'not_connected' },
  ]);

  return { tenant, sites };
}

async function main() {
  console.log('→ seeding RBAC catalog');
  await seedRbac();
  console.log('→ seeding demo tenant');
  const { tenant, sites } = await seedDemoTenant();
  console.log(`✓ seed complete — tenant ${tenant.id} with ${sites.length} sites`);
  process.exit(0);
}

main().catch((err) => {
  console.error('seed failed:', err);
  process.exit(1);
});
