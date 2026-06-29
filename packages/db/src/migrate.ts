/**
 * Idempotent local/CI migration runner:
 *   1. bootstrap.sql  — extensions, schemas, uuidv7(), roles, grants
 *   2. Drizzle migrations in ./drizzle  — `core` tables + enums
 *   3. rls.sql        — enable RLS, policies, reference views
 *
 * In AWS, step 1 is run by Terraform and steps 2–3 by the gated CD job.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';

const here = dirname(fileURLToPath(import.meta.url));
const url = process.env.DATABASE_URL ?? 'postgres://pilotage:pilotage@localhost:5432/pilotage';

async function run() {
  const pool = new Pool({ connectionString: url, max: 1 });
  const db = drizzle(pool);

  console.log('→ bootstrap.sql');
  await pool.query(readFileSync(resolve(here, '../sql/bootstrap.sql'), 'utf8'));

  console.log('→ drizzle migrations');
  await migrate(db, { migrationsFolder: resolve(here, '../drizzle') });

  console.log('→ rls.sql');
  await pool.query(readFileSync(resolve(here, '../sql/rls.sql'), 'utf8'));

  await pool.end();
  console.log('✓ migrations complete');
}

run().catch((err) => {
  console.error('migration failed:', err);
  process.exit(1);
});
