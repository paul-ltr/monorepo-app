import { z } from 'zod';
import { uuid } from '../ids';
import { money } from '../money';
import { loyaltyTier, campaignChannel } from '../enums';

/** M3 / M8 — Clients & fidélité (partial: read models + segmentation). */
export const customerSegment = z.object({
  id: uuid,
  name: z.string(),
  count: z.number().int(),
  definitionLabel: z.string(),
  /** Relative bar width 0–100 for the UI. */
  sharePct: z.number(),
});
export type CustomerSegment = z.infer<typeof customerSegment>;

export const loyaltyTierCount = z.object({
  tier: loyaltyTier,
  count: z.number().int(),
});
export type LoyaltyTierCount = z.infer<typeof loyaltyTierCount>;

export const campaignStatus = z.enum(['active', 'draft', 'scheduled']);
export type CampaignStatus = z.infer<typeof campaignStatus>;

export const campaign = z.object({
  id: uuid,
  label: z.string(),
  channel: campaignChannel,
  status: campaignStatus,
  audienceLabel: z.string(),
});
export type Campaign = z.infer<typeof campaign>;

export const createCampaignInput = z.object({
  label: z.string().min(2),
  channel: campaignChannel,
  audienceLabel: z.string().optional(),
  status: campaignStatus.default('draft'),
});
export type CreateCampaignInput = z.infer<typeof createCampaignInput>;

export const customersSummary = z.object({
  activeCustomers: z.number().int(),
  walletTotal: money,
  loyaltyRatePct: z.number(),
  referrals30d: z.number().int(),
  segments: z.array(customerSegment),
  loyaltyTiers: z.array(loyaltyTierCount),
  campaigns: z.array(campaign),
});
export type CustomersSummary = z.infer<typeof customersSummary>;
