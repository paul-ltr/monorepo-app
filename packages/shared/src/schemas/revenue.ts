import { z } from 'zod';
import { uuid, isoTimestamp } from '../ids';
import { money } from '../money';
import { paymentMethod, reconciliationStatus } from '../enums';
import { dataFreshness } from './common';

/** M2 — Recettes & monétique. */
export const reconciliationRow = z.object({
  siteId: uuid,
  siteName: z.string(),
  /** Expected from counted cycles. */
  theoretical: money,
  /** Actually collected (cash + electronic settlement). */
  collected: money,
  /** Read from the payment terminal/central. */
  terminal: money,
  variance: money,
  status: reconciliationStatus,
});
export type ReconciliationRow = z.infer<typeof reconciliationRow>;

export const paymentMethodBreakdown = z.object({
  method: paymentMethod,
  amount: money,
  pct: z.number(),
});
export type PaymentMethodBreakdown = z.infer<typeof paymentMethodBreakdown>;

export const refund = z.object({
  id: uuid,
  reason: z.string(),
  machineCode: z.string().nullable(),
  siteName: z.string(),
  at: isoTimestamp,
  amount: money,
});
export type Refund = z.infer<typeof refund>;

export const revenueSummary = z.object({
  collected: money,
  averageBasket: money,
  cycles: z.number().int(),
  reconciliationVariance: money,
  sitesToVerify: z.number().int(),
  cashToCollect: money,
  cashCollectorCount: z.number().int(),
  reconciliation: z.array(reconciliationRow),
  methods: z.array(paymentMethodBreakdown),
  recentRefunds: z.array(refund),
  freshness: dataFreshness,
});
export type RevenueSummary = z.infer<typeof revenueSummary>;

/** Refund approval (M2 Should — refund workflow). */
export const approveRefundInput = z.object({
  cycleRef: z.string(),
  amount: money,
  reason: z.string().min(3),
});
export type ApproveRefundInput = z.infer<typeof approveRefundInput>;
