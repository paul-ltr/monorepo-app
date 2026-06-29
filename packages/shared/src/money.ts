import { z } from 'zod';

/**
 * Money is always integer **cents** + an ISO-4217 currency. Never floats.
 * In the DB the amount is a `bigint`; over JSON we transport it as a `number`
 * (safe for realistic laundromat amounts) — switch to string if amounts can
 * exceed Number.MAX_SAFE_INTEGER.
 */
export const currencyCode = z
  .string()
  .length(3)
  .regex(/^[A-Z]{3}$/, 'ISO-4217 currency code');
export type CurrencyCode = z.infer<typeof currencyCode>;

export const money = z.object({
  amountCents: z.number().int(),
  currency: currencyCode.default('EUR'),
});
export type Money = z.infer<typeof money>;

export const eur = (amountCents: number): Money => ({ amountCents, currency: 'EUR' });

/** Format cents for display. Defaults to fr-FR / EUR (the product default). */
export function formatMoney(
  m: Money,
  locale = 'fr-FR',
  options: Intl.NumberFormatOptions = {},
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: m.currency,
    ...options,
  }).format(m.amountCents / 100);
}

export const addMoney = (a: Money, b: Money): Money => {
  if (a.currency !== b.currency) {
    throw new Error(`Cannot add ${a.currency} and ${b.currency}`);
  }
  return { amountCents: a.amountCents + b.amountCents, currency: a.currency };
};
