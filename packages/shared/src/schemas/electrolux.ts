import { z } from 'zod';

/**
 * M1/M12 — Electrolux OneApp/OCP connector contracts. These schemas double as
 * the API request/response validators and the TypeScript types shared by the
 * Settings wizard and the NestJS controller. See ../electrolux.ts for the
 * endpoint/flow constants.
 */

export const electroluxBrand = z.enum(['electrolux', 'aeg']);
export type ElectroluxBrandKind = z.infer<typeof electroluxBrand>;

/** Connect an Electrolux group account with its consumer email + password. */
export const electroluxConnectInput = z.object({
  email: z.string().trim(),
  password: z.string(),
  /** ISO 3166-1 alpha-2, used for the Gigya identity-provider lookup. */
  countryCode: z.string().trim().length(2).default('FR'),
  brand: electroluxBrand.default('electrolux'),
  /** Optional friendly label so several accounts are distinguishable. */
  label: z.string().trim().max(80).optional(),
});
export type ElectroluxConnectInput = z.infer<typeof electroluxConnectInput>;

/** One appliance retrieved from the account, with its shop association (if any). */
export const electroluxAppliance = z.object({
  applianceId: z.string(),
  name: z.string(),
  /** OCP deviceType (e.g. WASHING_MACHINE, TUMBLE_DRYER) or a friendly label. */
  type: z.string(),
  model: z.string().nullable(),
  serial: z.string().nullable(),
  connected: z.boolean(),
  /** The account this appliance belongs to. */
  accountId: z.string(),
  /** Set once the appliance is associated with a shop (site). */
  siteId: z.string().nullable(),
  siteName: z.string().nullable(),
  /** The core.machine row id created on association, when persisted. */
  machineId: z.string().nullable(),
});
export type ElectroluxAppliance = z.infer<typeof electroluxAppliance>;

/** A connected Electrolux account (one per group login). */
export const electroluxAccount = z.object({
  id: z.string(),
  label: z.string(),
  brand: electroluxBrand,
  countryCode: z.string(),
  applianceCount: z.number(),
  /** True when no live login happened (demo / ELECTROLUX_ENABLED=false). */
  simulated: z.boolean(),
  connectedAt: z.string(),
});
export type ElectroluxAccount = z.infer<typeof electroluxAccount>;

/** Full connector state for the Settings screen. */
export const electroluxStatus = z.object({
  accounts: z.array(electroluxAccount),
  appliances: z.array(electroluxAppliance),
  simulated: z.boolean(),
});
export type ElectroluxStatus = z.infer<typeof electroluxStatus>;

export const electroluxConnectResult = z.object({
  status: z.enum(['connected', 'error']),
  account: electroluxAccount.nullable(),
  appliances: z.array(electroluxAppliance),
  message: z.string(),
  simulated: z.boolean(),
});
export type ElectroluxConnectResult = z.infer<typeof electroluxConnectResult>;

/** Associate one appliance with a shop (site) → creates/updates a core.machine. */
export const electroluxAssociateInput = z.object({
  accountId: z.string().min(1),
  applianceId: z.string().min(1),
  siteId: z.string().min(1),
});
export type ElectroluxAssociateInput = z.infer<typeof electroluxAssociateInput>;

export const electroluxDisconnectInput = z.object({
  accountId: z.string().min(1),
});
export type ElectroluxDisconnectInput = z.infer<typeof electroluxDisconnectInput>;
