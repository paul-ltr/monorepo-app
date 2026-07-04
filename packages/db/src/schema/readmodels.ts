import { bigint, date, doublePrecision, integer, jsonb, pgSchema, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * READ-ONLY mappings of the `ingest` / `analytics` schemas the **data repo**
 * (monorepo-data) owns and populates. The app has SELECT-only on these
 * (CONTRACTS.md §1); we never migrate or write them — `drizzle.config` keeps
 * `schemaFilter: ['core']` so these are excluded from generated DDL. Columns
 * mirror `monorepo-data/src/db/tables.py`; keep in sync with that contract.
 */
const ingest = pgSchema('ingest');
const analytics = pgSchema('analytics');

// ── ingest ──────────────────────────────────────────────────────────────────
export const machineStatusCurrent = ingest.table('machine_status_current', {
  machineId: uuid('machine_id').primaryKey(),
  tenantId: uuid('tenant_id').notNull(),
  siteId: uuid('site_id').notNull(),
  state: text('state').notNull(),
  cycleEndsAt: timestamp('cycle_ends_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }),
  source: text('source').notNull(),
});

export const paymentEvent = ingest.table('payment_event', {
  id: bigint('id', { mode: 'number' }).primaryKey(),
  tenantId: uuid('tenant_id').notNull(),
  siteId: uuid('site_id').notNull(),
  machineId: uuid('machine_id'),
  centralId: uuid('central_id'),
  amountCents: bigint('amount_cents', { mode: 'number' }).notNull(),
  currency: text('currency').notNull(),
  method: text('method').notNull(),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
  source: text('source').notNull(),
});

export const energyDaily = ingest.table('energy_daily', {
  id: bigint('id', { mode: 'number' }).primaryKey(),
  tenantId: uuid('tenant_id').notNull(),
  siteId: uuid('site_id').notNull(),
  prm: text('prm').notNull(),
  businessDate: date('business_date').notNull(),
  measure: text('measure').notNull(),
  value: doublePrecision('value').notNull(),
  unit: text('unit').notNull(),
});

// ── analytics ─────────────────────────────────────────────────────────────
export const siteKpiDaily = analytics.table('site_kpi_daily', {
  tenantId: uuid('tenant_id').notNull(),
  siteId: uuid('site_id').notNull(),
  businessDate: date('business_date').notNull(),
  revenueCents: bigint('revenue_cents', { mode: 'number' }).notNull(),
  cycles: integer('cycles').notNull(),
  occupancyPct: doublePrecision('occupancy_pct'),
  energyKwh: doublePrecision('energy_kwh'),
  waterL: doublePrecision('water_l'),
  gasKwh: doublePrecision('gas_kwh'),
  downtimeMin: integer('downtime_min'),
  marginCents: bigint('margin_cents', { mode: 'number' }),
});

export const machineKpiDaily = analytics.table('machine_kpi_daily', {
  tenantId: uuid('tenant_id').notNull(),
  siteId: uuid('site_id').notNull(),
  machineId: uuid('machine_id').notNull(),
  businessDate: date('business_date').notNull(),
  cycles: integer('cycles').notNull(),
  revenueCents: bigint('revenue_cents', { mode: 'number' }).notNull(),
  uptimePct: doublePrecision('uptime_pct'),
  energyKwh: doublePrecision('energy_kwh'),
});

export const revenueReconciliation = analytics.table('revenue_reconciliation', {
  id: bigint('id', { mode: 'number' }).primaryKey(),
  tenantId: uuid('tenant_id').notNull(),
  siteId: uuid('site_id').notNull(),
  period: text('period').notNull(),
  theoreticalCents: bigint('theoretical_cents', { mode: 'number' }).notNull(),
  collectedCents: bigint('collected_cents', { mode: 'number' }).notNull(),
  terminalCents: bigint('terminal_cents', { mode: 'number' }).notNull(),
  discrepancyCents: bigint('discrepancy_cents', { mode: 'number' }).notNull(),
  status: text('status').notNull(),
  flags: jsonb('flags'),
  computedAt: timestamp('computed_at', { withTimezone: true }),
});

export const energyBenchmark = analytics.table('energy_benchmark', {
  tenantId: uuid('tenant_id').notNull(),
  siteId: uuid('site_id').notNull(),
  period: text('period').notNull(),
  kwhPerCycle: doublePrecision('kwh_per_cycle'),
  peerPercentile: doublePrecision('peer_percentile'),
});

export const complianceOperat = analytics.table('compliance_operat', {
  tenantId: uuid('tenant_id').notNull(),
  siteId: uuid('site_id').notNull(),
  year: integer('year').notNull(),
  kwhPerM2: doublePrecision('kwh_per_m2'),
  target2030: doublePrecision('target_2030'),
  target2040: doublePrecision('target_2040'),
  target2050: doublePrecision('target_2050'),
  status: text('status').notNull(),
  datasetS3Key: text('dataset_s3_key'),
  reportS3Key: text('report_s3_key'),
  computedAt: timestamp('computed_at', { withTimezone: true }),
});

export const machineHealth = analytics.table('machine_health', {
  machineId: uuid('machine_id').primaryKey(),
  tenantId: uuid('tenant_id').notNull(),
  siteId: uuid('site_id').notNull(),
  healthScore: doublePrecision('health_score'),
  failureRisk: doublePrecision('failure_risk'),
  topSignals: jsonb('top_signals'),
  computedAt: timestamp('computed_at', { withTimezone: true }),
});

export const energyAnomaly = analytics.table('energy_anomaly', {
  id: bigint('id', { mode: 'number' }).primaryKey(),
  tenantId: uuid('tenant_id').notNull(),
  siteId: uuid('site_id').notNull(),
  machineId: uuid('machine_id'),
  detectedAt: timestamp('detected_at', { withTimezone: true }),
  type: text('type').notNull(),
  severity: text('severity').notNull(),
  expected: doublePrecision('expected'),
  actual: doublePrecision('actual'),
});

export const insight = analytics.table('insight', {
  id: bigint('id', { mode: 'number' }).primaryKey(),
  tenantId: uuid('tenant_id').notNull(),
  scopeType: text('scope_type').notNull(),
  scopeId: uuid('scope_id'),
  period: text('period'),
  text: text('text').notNull(),
  sources: jsonb('sources'),
  model: text('model'),
  generatedAt: timestamp('generated_at', { withTimezone: true }),
});

export const jobRun = analytics.table('job_run', {
  id: bigint('id', { mode: 'number' }).primaryKey(),
  job: text('job').notNull(),
  tenantId: uuid('tenant_id'),
  businessDate: date('business_date'),
  startedAt: timestamp('started_at', { withTimezone: true }),
  endedAt: timestamp('ended_at', { withTimezone: true }),
  status: text('status').notNull(),
  rows: bigint('rows', { mode: 'number' }),
  llmTokens: bigint('llm_tokens', { mode: 'number' }),
  notes: text('notes'),
});
