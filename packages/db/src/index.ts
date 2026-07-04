export * as schema from './schema';
export * from './schema';
/** Read-only ingest/analytics tables owned by the data repo (SELECT-only). */
export * as readModels from './schema/readmodels';
export { createDb, withTenantContext } from './client';
export type { Database, Schema, TenantContextOpts } from './client';
