import { z } from 'zod';
import { uuid } from '../ids';
import { money } from '../money';

/** M9 — Réseau & benchmark. */
export const siteRanking = z.object({
  rank: z.number().int(),
  siteId: uuid,
  name: z.string(),
  revenue: money,
  /** Benchmark index 0–100. */
  index: z.number().int(),
  deltaPct: z.number(),
});
export type SiteRanking = z.infer<typeof siteRanking>;

export const networkException = z.object({
  siteName: z.string(),
  message: z.string(),
});
export type NetworkException = z.infer<typeof networkException>;

export const networkSummary = z.object({
  revenue30d: money,
  benchmarkIndex: z.number().int(),
  sitesInAlert: z.number().int(),
  royaltiesDue: money,
  royaltyBasisLabel: z.string(),
  royaltyStatus: z.enum(['to_issue', 'issued', 'paid']),
  standardizationLabel: z.string(),
  ranking: z.array(siteRanking),
  exception: networkException.nullable(),
});
export type NetworkSummary = z.infer<typeof networkSummary>;
