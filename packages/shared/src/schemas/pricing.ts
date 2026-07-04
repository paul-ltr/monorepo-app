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

export const promotionType = z.enum(['percentage', 'amount', 'bonus']);
export type PromotionType = z.infer<typeof promotionType>;

export const promotionStatus = z.enum(['active', 'scheduled', 'draft', 'paused']);
export type PromotionStatus = z.infer<typeof promotionStatus>;

export const promotion = z.object({
  id: uuid,
  label: z.string(),
  scopeLabel: z.string(), // "Tous les sites" / "Lyon-3" / "Réseau"
  status: promotionStatus,
  type: promotionType,
  /** % for percentage, cents for amount, free cycles for bonus. */
  value: z.number(),
});
export type Promotion = z.infer<typeof promotion>;

export const createPromotionInput = z.object({
  label: z.string().min(2),
  type: promotionType,
  value: z.number(),
  scopeLabel: z.string().optional(),
  status: z.enum(['active', 'scheduled', 'draft']).default('draft'),
});
export type CreatePromotionInput = z.infer<typeof createPromotionInput>;

/** A time-of-day yield band for the modulation strip. */
export const yieldBand = z.object({
  slot: priceSlot,
  fromHour: z.number().int().min(0).max(24),
  toHour: z.number().int().min(0).max(24),
});
export type YieldBand = z.infer<typeof yieldBand>;

/** Days of the week — yield pricing is configurable per day. */
export const weekday = z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);
export type Weekday = z.infer<typeof weekday>;

/** Yield bands per day of the week (empty/absent day → uses the standard grid). */
export const yieldSchedule = z.record(weekday, z.array(yieldBand));
export type YieldSchedule = z.infer<typeof yieldSchedule>;

export const pricingSummary = z.object({
  gridName: z.string(),
  grid: z.array(priceGridRow),
  yieldSchedule,
  promotions: z.array(promotion),
});
export type PricingSummary = z.infer<typeof pricingSummary>;

/** Remote price push (M7 Should). */
export const pushPricesInput = z.object({
  pricePlanId: uuid,
  siteIds: z.array(uuid).optional(),
});
export type PushPricesInput = z.infer<typeof pushPricesInput>;
