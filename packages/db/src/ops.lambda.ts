/**
 * Ops Lambda for one-off DB tasks against the *private* RDS (GitHub runners and
 * laptops can't reach the proxy). Deploy with the API's role + VPC + a
 * DATABASE_URL, invoke, then delete — or keep it around for ops.
 *
 *   { "action": "seed" }                       → run the demo/RBAC seed
 *   { "action": "sql", "statements": ["…"] }   → run SQL, return rows per stmt
 *   { "action": "set-role-password",           → sync a login role's password to
 *     "role": "data_rw", "password": "…" }       the value in Secrets Manager
 */
import pg from 'pg';
import { runSeed } from './seed';

type Event =
  | { action: 'seed' }
  | { action: 'sql'; statements: Array<string | { text: string; values?: unknown[] }> }
  | { action: 'set-role-password'; role: string; password: string };

export const handler = async (event: Event) => {
  if (event?.action === 'seed') {
    return { ok: true, result: await runSeed() };
  }
  if (event?.action === 'sql') {
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
    try {
      const rows: unknown[][] = [];
      for (const stmt of event.statements) {
        const q = typeof stmt === 'string' ? { text: stmt } : stmt;
        rows.push((await pool.query(q.text, q.values)).rows);
      }
      return { ok: true, rows };
    } finally {
      await pool.end();
    }
  }
  // Set a role's login password to match its Secrets Manager entry. Needed for
  // `data_rw`, which the data repo (and RDS Proxy) authenticate as directly, so
  // the DB password must equal what Terraform published to the secret. The
  // password comes in the payload (fed from Secrets Manager at invoke time) and
  // is never logged; ALTER ROLE ... PASSWORD can't be parameterized, so Postgres
  // `format(%I, %L)` does the identifier/literal escaping to keep it injection-safe.
  if (event?.action === 'set-role-password') {
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
    try {
      const { rows } = await pool.query<{ ddl: string }>(
        `select format('alter role %I with login password %L', $1::text, $2::text) as ddl`,
        [event.role, event.password],
      );
      const ddl = rows[0]?.ddl;
      if (!ddl) return { ok: false, error: `could not build ALTER ROLE for ${event.role}` };
      await pool.query(ddl);
      return { ok: true, role: event.role };
    } finally {
      await pool.end();
    }
  }
  return { ok: false, error: `unknown action: ${JSON.stringify(event)}` };
};
