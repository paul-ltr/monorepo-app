/**
 * Seed: system roles/permissions + a demo tenant ("Groupe Lavéo") with 6 sites
 * and a mixed machine park, mirroring the design's data so the app looks real
 * locally. Idempotent: re-running wipes and recreates the demo tenant; the RBAC
 * catalog is upserted. Runs as the migration role (bypasses RLS).
 */
import { pathToFileURL } from 'node:url';
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
  { name: 'Lyon-3 Guillotière', city: 'Lyon', postalCode: '69003', surfaceM2: 220, smsNumber: '+33 6 12 34 56 78' },
  { name: 'Paris-11 Voltaire', city: 'Paris', postalCode: '75011', surfaceM2: 180, smsNumber: '+33 6 23 45 67 89' },
  { name: 'Villeurbanne Gratte-Ciel', city: 'Villeurbanne', postalCode: '69100', surfaceM2: 160, smsNumber: null },
  { name: 'Lyon-7 Jean Macé', city: 'Lyon', postalCode: '69007', surfaceM2: 140, smsNumber: null },
  { name: 'Vénissieux Centre', city: 'Vénissieux', postalCode: '69200', surfaceM2: 200, smsNumber: '+33 6 34 56 78 90' },
  { name: 'Bron Terraillon', city: 'Bron', postalCode: '69500', surfaceM2: 120, smsNumber: null },
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
        smsNumber: site.smsNumber,
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

// Additional SaaS customers (groups) for the back-office console. [name, plan,
// billingStatus, tenantStatus, sites, ownerName, ownerEmail]
const GROUPS: Array<[string, string, string, 'active' | 'suspended', number, string, string]> = [
  ['Wash&Go', 'growth', 'active', 'active', 4, 'Julie Moreau', 'julie@washandgo.fr'],
  ['Bulle Express', 'starter', 'trialing', 'active', 2, 'Gérard Blin', 'gerard@bulle-express.fr'],
  ['Netteo', 'enterprise', 'active', 'active', 21, 'Léa Fontaine', 'lea@netteo.com'],
  ['LavoZen', 'growth', 'past_due', 'active', 5, 'Nadia Cherif', 'nadia@lavozen.fr'],
  ['CleanCircle', 'starter', 'canceled', 'suspended', 1, 'Hugo Blanc', 'hugo@cleancircle.fr'],
];

/** Extra users so the console's account list is non-trivial. [group, name, email, role]. */
const EXTRA_USERS: Array<[string, string, string, SystemRoleKey]> = [
  ['Groupe Lavéo', 'Marc Lefort', 'marc@laveo.fr', 'manager'],
  ['Groupe Lavéo', 'Karim Benali', 'k.benali@laveo.fr', 'technician'],
  ['Wash&Go', 'Paul Girard', 'paul@washandgo.fr', 'accountant'],
  ['Netteo', 'Thomas Roy', 't.roy@netteo.com', 'viewer'],
];

// [ref, group, subject, requester, email, status, priority, category, messages[[role,name,body]]]
const TICKETS: Array<
  [string, string, string, string, string, string, string, string, Array<[string, string, string]>]
> = [
  ['SUP-1042', 'Groupe Lavéo', 'Écart de réconciliation sur Lyon-3', 'Marc Lefort', 'marc@laveo.fr', 'open', 'high', 'billing',
    [['client', 'Marc Lefort', 'Bonjour, un écart de 4,50 € persiste sur la journée d’hier pour Lyon-3.']]],
  ['SUP-1041', 'Wash&Go', 'Sèche-linge SL-03 hors-ligne', 'Julie Moreau', 'julie@washandgo.fr', 'pending', 'urgent', 'technical',
    [['client', 'Julie Moreau', 'Le SL-03 ne remonte plus de données depuis ce matin.'],
     ['staff', 'Support LavoPilot', 'Merci, nous vérifions le connecteur Speed Queen — retour sous 1 h.']]],
  ['SUP-1040', 'Netteo', 'Ajouter un rôle « comptable lecture seule »', 'Léa Fontaine', 'lea@netteo.com', 'open', 'normal', 'feature',
    [['client', 'Léa Fontaine', 'Serait-il possible d’avoir un rôle comptable en lecture seule ?']]],
  ['SUP-1039', 'LavoZen', 'Facture de juin introuvable', 'Nadia Cherif', 'nadia@lavozen.fr', 'resolved', 'normal', 'billing',
    [['client', 'Nadia Cherif', 'Je ne retrouve pas ma facture de juin.'],
     ['staff', 'Support LavoPilot', 'La voici en pièce jointe, désolé pour la gêne.']]],
];

async function seedConsole(demoTenantId: string) {
  // A subscription for the demo tenant so it shows in the group registry.
  await db.insert(s.saasSubscription).values({ tenantId: demoTenantId, plan: 'scale', status: 'active', sites: 6 });

  const roles = await db.select().from(s.role).where(eq(s.role.isSystem, true));
  const roleByKey = new Map(roles.map((r) => [r.key, r.id]));
  const tenantByName = new Map<string, string>([['Groupe Lavéo', demoTenantId]]);

  for (const [name, plan, billing, tStatus, sites, ownerName, ownerEmail] of GROUPS) {
    const existing = await db.select().from(s.tenant).where(eq(s.tenant.name, name));
    if (existing.length) await db.delete(s.tenant).where(eq(s.tenant.id, existing[0]!.id));

    const t = one(
      await db.insert(s.tenant).values({ name, type: 'multi_site', status: tStatus, locale: 'fr-FR' }).returning(),
    );
    tenantByName.set(name, t.id);
    await db.insert(s.saasSubscription).values({ tenantId: t.id, plan, status: billing, sites });
    const owner = one(
      await db.insert(s.appUser).values({ tenantId: t.id, email: ownerEmail, fullName: ownerName }).returning(),
    );
    const ownerRoleId = roleByKey.get('owner');
    if (ownerRoleId)
      await db.insert(s.userRole).values({ userId: owner.id, roleId: ownerRoleId, scopeType: 'tenant', scopeId: t.id });
  }

  for (const [group, name, email, role] of EXTRA_USERS) {
    const tid = tenantByName.get(group);
    const roleId = roleByKey.get(role);
    if (!tid || !roleId) continue;
    const u = one(await db.insert(s.appUser).values({ tenantId: tid, email, fullName: name }).returning());
    await db.insert(s.userRole).values({ userId: u.id, roleId, scopeType: 'tenant', scopeId: tid });
  }

  for (const [ref, group, subject, reqName, reqEmail, status, priority, category, msgs] of TICKETS) {
    const tid = tenantByName.get(group);
    if (!tid) continue;
    const ticket = one(
      await db
        .insert(s.supportTicket)
        .values({
          tenantId: tid,
          ref,
          subject,
          requesterName: reqName,
          requesterEmail: reqEmail,
          status: status as 'open' | 'pending' | 'resolved' | 'closed',
          priority: priority as 'low' | 'normal' | 'high' | 'urgent',
          category: category as 'billing' | 'technical' | 'account' | 'feature' | 'other',
        })
        .returning(),
    );
    await db.insert(s.supportMessage).values(
      msgs.map(([authorRole, authorName, body]) => ({
        tenantId: tid,
        ticketId: ticket.id,
        authorRole,
        authorName,
        body,
      })),
    );
  }
}

/** Run the full seed. Callable from a script or an ops Lambda (returns a summary). */
export async function runSeed(): Promise<{ tenantId: string; sites: number }> {
  console.log('→ seeding RBAC catalog');
  await seedRbac();
  console.log('→ seeding demo tenant');
  const { tenant, sites } = await seedDemoTenant();
  console.log('→ seeding console groups, accounts & tickets');
  await seedConsole(tenant.id);
  console.log(`✓ seed complete — tenant ${tenant.id} with ${sites.length} sites`);
  return { tenantId: tenant.id, sites: sites.length };
}

// CLI entry (`pnpm --filter @pilotage/db seed`): run + exit. Skipped on import.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runSeed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('seed failed:', err);
      process.exit(1);
    });
}
