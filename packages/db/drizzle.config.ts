import { defineConfig } from 'drizzle-kit';

const url =
  process.env.DATABASE_URL ?? 'postgres://pilotage:pilotage@localhost:5432/pilotage';

export default defineConfig({
  schema: './src/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url },
  // We own only the `core` schema; ingest/analytics belong to the data repo.
  schemaFilter: ['core'],
  verbose: true,
  strict: true,
});
