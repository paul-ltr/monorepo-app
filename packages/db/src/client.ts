import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import { Pool } from 'pg';
import * as schema from './schema';

export type Schema = typeof schema;
export type Database = ReturnType<typeof createDb>;

/** Create a Drizzle client over a pg pool. One pool per process (or RDS Proxy). */
export function createDb(connectionString: string, opts: { max?: number } = {}) {
  const pool = new Pool({ connectionString, max: opts.max ?? 5 });
  return drizzle(pool, { schema, casing: 'snake_case' });
}

export interface TenantContextOpts {
  tenantId: string;
  userId?: string;
  /**
   * Role to run the transaction as. Defaults to `app_rw` so Row-Level Security
   * is enforced even when the pool connects as a superuser locally. In AWS the
   * pool already authenticates as app_rw and this is a no-op.
   */
  role?: string;
}

/**
 * Run `fn` inside a transaction with the RLS GUCs set, so every `core` query is
 * filtered to the tenant. `set_config(..., true)` scopes the settings to the
 * transaction; `set local role` drops superuser locally so policies apply.
 */
export async function withTenantContext<T>(
  db: Database,
  ctx: TenantContextOpts,
  fn: (tx: Parameters<Parameters<Database['transaction']>[0]>[0]) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`set local role ${sql.raw(ctx.role ?? 'app_rw')}`);
    await tx.execute(sql`select set_config('app.current_tenant', ${ctx.tenantId}, true)`);
    if (ctx.userId) {
      await tx.execute(sql`select set_config('app.current_user', ${ctx.userId}, true)`);
    }
    return fn(tx);
  });
}

export { schema };
