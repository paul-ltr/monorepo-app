import { z } from 'zod';
import { uuid, isoTimestamp } from '../ids';
import { ticketStatus, ticketPriority, ticketSource } from '../enums';

/** M4 — Maintenance & GMAO. */
export const ticket = z.object({
  id: uuid,
  code: z.string(), // #2241
  title: z.string(),
  siteId: uuid,
  siteName: z.string(),
  machineCode: z.string().nullable(),
  priority: ticketPriority,
  status: ticketStatus,
  source: ticketSource,
  slaLabel: z.string(), // "SLA 2 h" / "—"
  slaDueAt: isoTimestamp.nullable(),
  openedAt: isoTimestamp,
});
export type Ticket = z.infer<typeof ticket>;

export const technicianTask = z.object({
  time: z.string(), // "09:00"
  technicianName: z.string(),
  task: z.string(),
  siteName: z.string(),
  status: z.enum(['en_route', 'planned', 'to_confirm', 'done']),
});
export type TechnicianTask = z.infer<typeof technicianTask>;

export const maintenancePlanItem = z.object({
  label: z.string(),
  dueLabel: z.string(), // "Dans 240 cyc." / "Dans 18 j" / "À jour"
  urgency: z.enum(['ok', 'soon', 'overdue']),
});
export type MaintenancePlanItem = z.infer<typeof maintenancePlanItem>;

export const maintenanceSummary = z.object({
  openTickets: z.number().int(),
  criticalTickets: z.number().int(),
  mttrHours: z.number(),
  mtbfDays: z.number().int(),
  availabilityPct: z.number(),
  machinesTracked: z.number().int(),
  tickets: z.array(ticket),
  worklist: z.array(technicianTask),
  plans: z.array(maintenancePlanItem),
});
export type MaintenanceSummary = z.infer<typeof maintenanceSummary>;

export const createTicketInput = z.object({
  title: z.string().min(3),
  siteId: uuid,
  machineId: uuid.optional(),
  priority: ticketPriority.default('medium'),
  source: ticketSource.default('operator'),
  description: z.string().optional(),
});
export type CreateTicketInput = z.infer<typeof createTicketInput>;
