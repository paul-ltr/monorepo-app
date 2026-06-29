import { z } from 'zod';
import { uuid, isoTimestamp } from '../ids';
import { money } from '../money';
import { accountingProvider, accountingExportKind, connectorStatus } from '../enums';

/** M6 — Finances & compta. */
export const siteMargin = z.object({
  siteId: uuid,
  siteName: z.string(),
  revenue: money,
  charges: money,
  margin: money,
  marginPct: z.number(),
});
export type SiteMargin = z.infer<typeof siteMargin>;

export const accountingConnectorRow = z.object({
  provider: accountingProvider,
  name: z.string(),
  status: connectorStatus,
});
export type AccountingConnectorRow = z.infer<typeof accountingConnectorRow>;

export const financeSummary = z.object({
  periodLabel: z.string(),
  consolidatedRevenue: money,
  charges: money,
  netMargin: money,
  vatCollected: money,
  margins: z.array(siteMargin),
  connectors: z.array(accountingConnectorRow),
});
export type FinanceSummary = z.infer<typeof financeSummary>;

export const accountingExport = z.object({
  id: uuid,
  kind: accountingExportKind,
  periodLabel: z.string(),
  status: z.enum(['generating', 'ready', 'error']),
  fileKey: z.string().nullable(),
  createdAt: isoTimestamp,
});
export type AccountingExport = z.infer<typeof accountingExport>;

export const generateFecInput = z.object({
  /** Inclusive period bounds, ISO date (YYYY-MM-DD). */
  from: z.string(),
  to: z.string(),
});
export type GenerateFecInput = z.infer<typeof generateFecInput>;
