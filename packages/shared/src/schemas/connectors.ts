import { z } from 'zod';

/**
 * M5/M12 — energy connector onboarding contracts (Enedis Data Connect &
 * GRDF ADICT). These schemas double as the API request/response validators and
 * the TypeScript types shared by the web wizard and the NestJS controller.
 */

export const energyProvider = z.enum(['enedis', 'grdf']);
export type EnergyProvider = z.infer<typeof energyProvider>;

/** A single consumption reading (daily energy in kWh). */
export const consumptionPoint = z.object({
  date: z.string(), // YYYY-MM-DD (local day)
  kwh: z.number(),
});
export type ConsumptionPoint = z.infer<typeof consumptionPoint>;

/** A first slice of metering history retrieved to seed the Énergie screens. */
export const connectorHistory = z.object({
  provider: energyProvider,
  /** PRM/PDL (Enedis) or PCE (GRDF). */
  usagePointId: z.string(),
  unit: z.string(), // 'kWh'
  from: z.string(), // YYYY-MM-DD
  to: z.string(), // YYYY-MM-DD
  total: z.number(), // sum over the window, kWh
  points: z.array(consumptionPoint),
  /** True when the response is a graceful simulation (no live credentials). */
  simulated: z.boolean(),
});
export type ConnectorHistory = z.infer<typeof connectorHistory>;

// ─────────────────────────────── Enedis ────────────────────────────────────

export const enedisMeterKind = z.enum(['pdl', 'c4']);
export type EnedisMeterKind = z.infer<typeof enedisMeterKind>;

/** Step 1 — confirm the PRM/PDL number or the postal address before consent. */
export const enedisValidateInput = z
  .object({
    siteId: z.string().min(1),
    kind: enedisMeterKind.default('pdl'),
    mode: z.enum(['prm', 'address']),
    prm: z.string().optional(),
    address: z.string().optional(),
  })
  .refine((v) => (v.mode === 'prm' ? !!v.prm : !!v.address), {
    message: 'prm or address required for the chosen mode',
  });
export type EnedisValidateInput = z.infer<typeof enedisValidateInput>;

export const enedisValidateResult = z.object({
  valid: z.boolean(),
  /** Normalised 14-digit PRM when the number was supplied and well-formed. */
  prm: z.string().nullable(),
  /** Cleaned-up address echoed back when in address mode. */
  address: z.string().nullable(),
  /** Human-readable confirmation line shown under the field. */
  label: z.string(),
  message: z.string(),
});
export type EnedisValidateResult = z.infer<typeof enedisValidateResult>;

/** Step 2 — build the Data Connect consent (authorize) URL for the customer. */
export const enedisAuthorizeInput = z.object({
  siteId: z.string().min(1),
  kind: enedisMeterKind.default('pdl'),
  prm: z.string().nullable().optional(),
  address: z.string().optional(),
});
export type EnedisAuthorizeInput = z.infer<typeof enedisAuthorizeInput>;

export const enedisAuthorizeResult = z.object({
  authorizeUrl: z.string(),
  /** Opaque state token; echoed back on the callback and to /complete. */
  state: z.string(),
  /** True when no Enedis client is configured and the flow is simulated. */
  simulated: z.boolean(),
});
export type EnedisAuthorizeResult = z.infer<typeof enedisAuthorizeResult>;

/** Step 3 — after the consent redirect returns, exchange + fetch first history. */
export const enedisCompleteInput = z.object({ state: z.string().min(1) });
export type EnedisCompleteInput = z.infer<typeof enedisCompleteInput>;

export const enedisCompleteResult = z.object({
  status: z.enum(['connected', 'error']),
  usagePointId: z.string(),
  message: z.string(),
  history: connectorHistory.nullable(),
});
export type EnedisCompleteResult = z.infer<typeof enedisCompleteResult>;

// ──────────────────────────────── GRDF ─────────────────────────────────────

/** Test the ADICT client_credentials against a PCE (14-digit gas meter id). */
export const grdfTestInput = z.object({
  siteId: z.string().min(1),
  pce: z.string().min(1),
});
export type GrdfTestInput = z.infer<typeof grdfTestInput>;

export const grdfTestResult = z.object({
  ok: z.boolean(),
  pce: z.string(),
  /** True when the OAuth client_credentials token was obtained. */
  tokenObtained: z.boolean(),
  message: z.string(),
  simulated: z.boolean(),
});
export type GrdfTestResult = z.infer<typeof grdfTestResult>;

export const grdfHistoryInput = z.object({
  siteId: z.string().min(1),
  pce: z.string().min(1),
});
export type GrdfHistoryInput = z.infer<typeof grdfHistoryInput>;

// ─────────────────────────── Pennylane (accounting) ────────────────────────

/** Current Pennylane connection state for the Finances / Settings screens. */
export const pennylaneStatus = z.object({
  connected: z.boolean(),
  /** Connected company name (from Pennylane), when known. */
  company: z.string().nullable(),
  /** True when no Pennylane client is configured and the flow is simulated. */
  simulated: z.boolean(),
  /** Access-token expiry (ISO), when connected. */
  expiresAt: z.string().nullable(),
});
export type PennylaneStatus = z.infer<typeof pennylaneStatus>;

/** Step 1 — build the OAuth authorize URL and register the state. */
export const pennylaneAuthorizeResult = z.object({
  authorizeUrl: z.string(),
  state: z.string(),
  simulated: z.boolean(),
});
export type PennylaneAuthorizeResult = z.infer<typeof pennylaneAuthorizeResult>;

/** Step 2 — after the OAuth redirect returns, exchange the code for tokens. */
export const pennylaneCompleteInput = z.object({
  state: z.string().min(1),
  code: z.string().optional(),
});
export type PennylaneCompleteInput = z.infer<typeof pennylaneCompleteInput>;

export const pennylaneCompleteResult = z.object({
  status: z.enum(['connected', 'error']),
  company: z.string().nullable(),
  message: z.string(),
  simulated: z.boolean(),
  expiresAt: z.string().nullable(),
});
export type PennylaneCompleteResult = z.infer<typeof pennylaneCompleteResult>;
