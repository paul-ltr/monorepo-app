import { z } from 'zod';

/**
 * M1/M12 — Miele 3rd Party API connector contracts (OAuth 2.0 authorization-code).
 * These schemas double as the API request/response validators and the shared
 * TypeScript types. See ../miele.ts for the endpoint/flow constants.
 */

/** Step 1 — build the Miele consent URL for a given locale group (`vg`). */
export const mieleAuthorizeInput = z.object({
  /** Locale group used at Miele@home registration, e.g. fr-FR, de-DE. */
  vg: z.string().trim().min(2).max(8).default('fr-FR'),
  /** Optional friendly label so several accounts are distinguishable. */
  label: z.string().trim().max(80).optional(),
});
export type MieleAuthorizeInput = z.infer<typeof mieleAuthorizeInput>;

export const mieleAuthorizeResult = z.object({
  authorizeUrl: z.string(),
  /** Opaque state token; echoed on the callback and to /complete. */
  state: z.string(),
  /** True when no Miele client is configured and the flow is simulated. */
  simulated: z.boolean(),
});
export type MieleAuthorizeResult = z.infer<typeof mieleAuthorizeResult>;

/** Step 3 — after the consent redirect returns, drain the cached outcome. */
export const mieleCompleteInput = z.object({ state: z.string().min(1) });
export type MieleCompleteInput = z.infer<typeof mieleCompleteInput>;

/** One appliance retrieved from the account, with its shop association (if any). */
export const mieleAppliance = z.object({
  applianceId: z.string(),
  name: z.string(),
  /** Miele device type label (e.g. "Washing machine"). */
  type: z.string(),
  model: z.string().nullable(),
  serial: z.string().nullable(),
  connected: z.boolean(),
  accountId: z.string(),
  siteId: z.string().nullable(),
  siteName: z.string().nullable(),
  machineId: z.string().nullable(),
});
export type MieleAppliance = z.infer<typeof mieleAppliance>;

/** A connected Miele account (one per OAuth login). */
export const mieleAccount = z.object({
  id: z.string(),
  label: z.string(),
  vg: z.string(),
  applianceCount: z.number(),
  simulated: z.boolean(),
  connectedAt: z.string(),
});
export type MieleAccount = z.infer<typeof mieleAccount>;

export const mieleStatus = z.object({
  accounts: z.array(mieleAccount),
  appliances: z.array(mieleAppliance),
  simulated: z.boolean(),
});
export type MieleStatus = z.infer<typeof mieleStatus>;

export const mieleCompleteResult = z.object({
  status: z.enum(['connected', 'error']),
  account: mieleAccount.nullable(),
  appliances: z.array(mieleAppliance),
  message: z.string(),
  simulated: z.boolean(),
});
export type MieleCompleteResult = z.infer<typeof mieleCompleteResult>;

export const mieleAssociateInput = z.object({
  accountId: z.string().min(1),
  applianceId: z.string().min(1),
  siteId: z.string().min(1),
});
export type MieleAssociateInput = z.infer<typeof mieleAssociateInput>;

export const mieleDisconnectInput = z.object({
  accountId: z.string().min(1),
});
export type MieleDisconnectInput = z.infer<typeof mieleDisconnectInput>;
