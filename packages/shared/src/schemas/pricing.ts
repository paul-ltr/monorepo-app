import { z } from 'zod';
import { uuid } from '../ids';
import { money } from '../money';
import { priceSlot } from '../enums';

/** M7 — Tarifs & yield. */
export const priceGridRow = z.object({
  programId: uuid,
  programLabel: z.string(), // "Lavage 8 kg"
  prices: z.record(priceSlot, money), // standard/offpeak/peak/weekend → amount
});
export type PriceGridRow = z.infer<typeof priceGridRow>;

export const promotion = z.object({
  id: uuid,
  label: z.string(),
  scopeLabel: z.string(), // "Tous les sites" / "Lyon-3" / "Réseau"
  status: z.enum(['active', 'scheduled', 'draft']),
});
export type Promotion = z.infer<typeof promotion>;

/** A 24h yield band for the modulation strip. */
export const yieldBand = z.object({
  slot: priceSlot,
  fromHour: z.number().int().min(0).max(24),
  toHour: z.number().int().min(0).max(24),
});
export type YieldBand = z.infer<typeof yieldBand>;

export const pricingSummary = z.object({
  gridName: z.string(),
  grid: z.array(priceGridRow),
  yieldBands: z.array(yieldBand),
  promotions: z.array(promotion),
});
export type PricingSummary = z.infer<typeof pricingSummary>;

/** Remote price push (M7 Should). */
export const pushPricesInput = z.object({
  pricePlanId: uuid,
  siteIds: z.array(uuid).optional(),
});
export type PushPricesInput = z.infer<typeof pushPricesInput>;
