import { z } from 'zod';
import { uuid, isoTimestamp } from '../ids';
import { money } from '../money';

/** Dashboard period selector (Aujourd'hui / 7 jours / 30 jours). */
export const period = z.enum(['today', '7d', '30d']);
export type Period = z.infer<typeof period>;

/**
 * Freshness envelope. Reads off `ingest`/`analytics` can lag; the API reports
 * how old the data is so the web can show "Mis à jour il y a 2 min" / a stale
 * banner when `stale` is true.
 */
export const dataFreshness = z.object({
  asOf: isoTimestamp,
  stale: z.boolean().default(false),
});
export type DataFreshness = z.infer<typeof dataFreshness>;

export const kpiDelta = z.object({
  /** Signed percentage change vs the comparison window. */
  pct: z.number(),
  direction: z.enum(['up', 'down', 'flat']),
});
export type KpiDelta = z.infer<typeof kpiDelta>;

export const scopeRef = z.object({
  type: z.enum(['tenant', 'network', 'site', 'machine']),
  id: uuid.optional(),
  label: z.string().optional(),
});
export type ScopeRef = z.infer<typeof scopeRef>;

export function paginated<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    items: z.array(item),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive().default(1),
    pageSize: z.number().int().positive().default(50),
  });
}

export const listQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(200).default(50),
  search: z.string().trim().optional(),
  siteId: uuid.optional(),
  networkId: uuid.optional(),
});
export type ListQuery = z.infer<typeof listQuery>;

export { money, uuid, isoTimestamp };
