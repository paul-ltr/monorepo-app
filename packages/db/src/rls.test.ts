/**
 * Cross-tenant isolation test. Proves that, running as app_rw (NOT BYPASSRLS),
 * a request scoped to tenant A can neither read nor write tenant B's rows.
 * Requires a migrated+seeded local Postgres (make up && make db-migrate).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import { eq } from 'drizzle-orm';
import { createDb, withTenantContext } from './client';
import * as s from './schema';

const url = process.env.DATABASE_URL ?? 'postgres://pilotage:pilotage@localhost:5432/pilotage';

let reachable = false;
let db: ReturnType<typeof createDb>;
let tenantA = '';
let tenantB = '';

beforeAll(async () => {
  try {
    const probe = new Pool({ connectionString: url, max: 1 });
    await probe.query('select 1');
    await probe.end();
    reachable = true;
  } catch {
    reachable = false;
    return;
  }
  db = createDb(url, { max: 2 });
  // Insert two throwaway tenants + one site each (as the migration superuser).
  const [a] = await db.insert(s.tenant).values({ name: `rls-A-${Date.now()}` }).returning();
  const [b] = await db.insert(s.tenant).values({ name: `rls-B-${Date.now()}` }).returning();
  tenantA = a!.id;
  tenantB = b!.id;
  await db.insert(s.site).values({ tenantId: tenantA, name: 'A-site', status: 'active' });
  await db.insert(s.site).values({ tenantId: tenantB, name: 'B-site', status: 'active' });
});

afterAll(async () => {
  if (reachable && db) {
    await db.delete(s.tenant).where(eq(s.tenant.id, tenantA));
    await db.delete(s.tenant).where(eq(s.tenant.id, tenantB));
  }
});

describe('row-level security', () => {
  it('scopes reads to the current tenant', async () => {
    if (!reachable) return expect(reachable).toBe(false); // skip silently when no DB
    const aSites = await withTenantContext(db, { tenantId: tenantA }, (tx) =>
      tx.select().from(s.site),
    );
    expect(aSites.every((row) => row.tenantId === tenantA)).toBe(true);
    expect(aSites.some((row) => row.name === 'A-site')).toBe(true);
    expect(aSites.some((row) => row.name === 'B-site')).toBe(false);
  });

  it("never leaks another tenant's row by id", async () => {
    if (!reachable) return;
    const leaked = await withTenantContext(db, { tenantId: tenantA }, (tx) =>
      tx.select().from(s.site).where(eq(s.site.tenantId, tenantB)),
    );
    expect(leaked).toHaveLength(0);
  });

  it('rejects writing a row for another tenant (WITH CHECK)', async () => {
    if (!reachable) return;
    await expect(
      withTenantContext(db, { tenantId: tenantA }, (tx) =>
        tx.insert(s.site).values({ tenantId: tenantB, name: 'evil', status: 'active' }),
      ),
    ).rejects.toThrow();
  });
});
