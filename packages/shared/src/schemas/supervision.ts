import { z } from 'zod';
import { uuid, isoTimestamp } from '../ids';
import { money } from '../money';
import {
  machineKind,
  machineBrand,
  machineState,
  notificationSeverity,
  deviceCommandType,
  deviceCommandStatus,
} from '../enums';
import { dataFreshness, kpiDelta } from './common';

/** M1 — Machines & supervision. */
export const machine = z.object({
  id: uuid,
  siteId: uuid,
  code: z.string(), // e.g. LL-03
  name: z.string(),
  kind: machineKind,
  brand: machineBrand,
  model: z.string().nullable(),
  serial: z.string(),
  capacityKg: z.number().nullable(),
  status: machineState,
});
export type Machine = z.infer<typeof machine>;

/** Live status row (from ingest.machine_status_current via the API). */
export const machineStatus = z.object({
  machineId: uuid,
  code: z.string(),
  name: z.string(),
  kind: machineKind,
  state: machineState,
  /** Free text like "Fin dans 14 min" / "À vider" / "Erreur E-04". */
  detail: z.string(),
  cyclesToday: z.number().int(),
  revenueToday: money,
  /** Seconds until the running cycle ends, if applicable. */
  etaSeconds: z.number().int().nullable().optional(),
  freshness: dataFreshness,
});
export type MachineStatus = z.infer<typeof machineStatus>;

export const machineCycle = z.object({
  at: isoTimestamp,
  program: z.string(),
  durationMin: z.number().int(),
  amount: money,
});
export type MachineCycle = z.infer<typeof machineCycle>;

export const machineDetail = machine.extend({
  status: machineState,
  statusDetail: z.string(),
  cyclesToday: z.number().int(),
  uptime30dPct: z.number(),
  energyPerCycleKwh: z.number().nullable(),
  history: z.array(machineCycle),
  openTicketId: z.string().nullable(),
});
export type MachineDetail = z.infer<typeof machineDetail>;

/** Per-site KPI row for the multi-site dashboard "Performance par site". */
export const siteKpi = z.object({
  siteId: uuid,
  name: z.string(),
  revenue: money,
  occupancyPct: z.number(),
  uptimePct: z.number(),
  /** Benchmark percentile vs peers (0–100). */
  benchmarkPercentile: z.number(),
  openAlerts: z.number().int(),
});
export type SiteKpi = z.infer<typeof siteKpi>;

export const dashboardAlert = z.object({
  id: uuid,
  severity: notificationSeverity,
  title: z.string(),
  siteName: z.string(),
  at: isoTimestamp,
  /** Icon hint the web maps to an SVG (power/droplet/euro/alert/wrench). */
  icon: z.enum(['power', 'droplet', 'euro', 'alert', 'wrench']),
});
export type DashboardAlert = z.infer<typeof dashboardAlert>;

/** Aggregate payload for GET /dashboard. */
export const dashboardSummary = z.object({
  scopeLabel: z.string(),
  revenueToday: money,
  revenueDelta: kpiDelta,
  revenueYesterday: money,
  machinesActive: z.number().int(),
  machinesTotal: z.number().int(),
  machinesOutOfService: z.number().int(),
  sitesWithOosCount: z.number().int(),
  energyVsRefPct: z.number(),
  openTickets: z.number().int(),
  criticalTickets: z.number().int(),
  sites: z.array(siteKpi),
  alerts: z.array(dashboardAlert),
  freshness: dataFreshness,
});
export type DashboardSummary = z.infer<typeof dashboardSummary>;

/** Status counters for the Machines screen header. */
export const machineStateCounts = z.object({
  free: z.number().int(),
  running: z.number().int(),
  finished: z.number().int(),
  out_of_service: z.number().int(),
  offline: z.number().int(),
});
export type MachineStateCounts = z.infer<typeof machineStateCounts>;

/** SSE event pushed on the live machine feed. */
export const machineStatusEvent = z.object({
  type: z.literal('machine_status'),
  data: machineStatus,
});
export type MachineStatusEvent = z.infer<typeof machineStatusEvent>;

/** Remote action request (Should — enqueued into core.device_command). */
export const deviceCommandRequest = z.object({
  machineId: uuid,
  type: deviceCommandType,
  payload: z.record(z.unknown()).optional(),
});
export type DeviceCommandRequest = z.infer<typeof deviceCommandRequest>;

export const deviceCommand = z.object({
  id: uuid,
  machineId: uuid,
  type: deviceCommandType,
  status: deviceCommandStatus,
  createdAt: isoTimestamp,
  executedAt: isoTimestamp.nullable(),
});
export type DeviceCommand = z.infer<typeof deviceCommand>;

export const createMachineInput = machine
  .omit({ id: true, status: true })
  .extend({ status: machineState.default('offline') });
export type CreateMachineInput = z.infer<typeof createMachineInput>;
