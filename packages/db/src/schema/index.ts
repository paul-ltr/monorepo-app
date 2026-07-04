/** The full `core` schema — every table, re-exported for Drizzle + the API. */
export * from './_columns';
export * from './enums';
export * from './tenancy';
export * from './rbac';
export * from './assets';
export * from './pricing';
export * from './customers';
export * from './maintenance';
export * from './finance';
export * from './ops';
export * from './console';
// NB: `readmodels` (ingest/analytics) is intentionally NOT re-exported here — it
// must stay out of the Drizzle migration schema (the data repo owns that DDL).
// The API imports it via `readModels` from the package root.
