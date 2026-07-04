import { z } from 'zod';
import { uuid, isoTimestamp } from '../ids';
import { dataFreshness } from './common';

/** M5 — Énergie & conformité (OPERAT / décret tertiaire). */
export const operatTarget = z.object({
  year: z.number().int(), // 2030 / 2040 / 2050
  reductionPct: z.number(), // -40 / -50 / -60
  status: z.enum(['reached', 'behind', 'ahead']),
  gapPts: z.number().nullable(),
});
export type OperatTarget = z.infer<typeof operatTarget>;

export const operatTrajectory = z.object({
  /** Current intensity in kWh/m²/year. */
  currentKwhM2Year: z.number(),
  baseKwhM2Year: z.number(),
  /** Achieved reduction vs base (negative = reduction). */
  reductionPct: z.number(),
  onTrack: z.boolean(),
  targets: z.array(operatTarget),
});
export type OperatTrajectory = z.infer<typeof operatTrajectory>;

export const energyMeter = z.object({
  kind: z.enum(['electricity', 'water', 'gas']),
  value: z.number(),
  unit: z.string(), // kWh / m³ / kWh PCS
  deltaPct: z.number(),
  anomaly: z.string().nullable(),
  /** Small sparkline series for the card. */
  series: z.array(z.number()),
  /** True when the figures come from a live connector (Enedis/GRDF), not an estimate. */
  live: z.boolean().optional(),
});
export type EnergyMeter = z.infer<typeof energyMeter>;

export const energyHeatRow = z.object({
  siteName: z.string(),
  /** One value per month column, in kWh/m²/month. */
  cells: z.array(z.number()),
});
export type EnergyHeatRow = z.infer<typeof energyHeatRow>;

export const energySummary = z.object({
  trajectory: operatTrajectory,
  meters: z.array(energyMeter),
  heatmapMonths: z.array(z.string()),
  heatmap: z.array(energyHeatRow),
  siteCount: z.number().int(),
  freshness: dataFreshness,
});
export type EnergySummary = z.infer<typeof energySummary>;

/** OPERAT dossier generation (M5 MVP). */
export const generateOperatInput = z.object({
  year: z.number().int(),
  siteIds: z.array(uuid).optional(), // default: all in scope
});
export type GenerateOperatInput = z.infer<typeof generateOperatInput>;

export const operatReport = z.object({
  id: uuid,
  year: z.number().int(),
  status: z.enum(['generating', 'ready', 'error']),
  siteCount: z.number().int(),
  fileKey: z.string().nullable(),
  createdAt: isoTimestamp,
});
export type OperatReport = z.infer<typeof operatReport>;
