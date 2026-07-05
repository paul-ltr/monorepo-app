/**
 * @pilotage/shared — the single-sourced contract between the web app and the
 * API. Enums mirror the Postgres enum types; Zod schemas double as runtime
 * validators and (via z.infer) the TypeScript types both sides import.
 */
export * from './enums';
export * from './ids';
export * from './money';
export * from './errors';
export * from './auth';
export * from './feature-flags';
export * from './schemas/common';
export * from './schemas/supervision';
export * from './schemas/revenue';
export * from './schemas/energy';
export * from './schemas/maintenance';
export * from './schemas/pricing';
export * from './schemas/customers';
export * from './schemas/finance';
export * from './schemas/network';
export * from './schemas/admin';
export * from './schemas/notifications';
export * from './schemas/console';
export * from './schemas/connectors';
export * from './schemas/electrolux';
export * from './schemas/miele';
export * from './connectors-sim';
export * from './supervision-sim';
export * from './pennylane';
export * from './electrolux';
export * from './miele';
