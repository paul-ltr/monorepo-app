/**
 * Ops Lambda for one-off DB tasks against the *private* RDS (GitHub runners and
 * laptops can't reach the proxy). Deploy with the API's role + VPC + a
 * DATABASE_URL, invoke, then delete — or keep it around for ops.
 *
 *   { "action": "seed" }                       → run the demo/RBAC seed
 *   { "action": "sql", "statements": ["…"] }   → run SQL, return rows per stmt
 */
import pg from 'pg';
import { runSeed } from './seed';

type Event =
  | { action: 'seed' }
  | { action: 'sql'; statements: Array<string | { text: string; values?: unknown[] }> };

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
  return { ok: false, error: `unknown action: ${JSON.stringify(event)}` };
};
