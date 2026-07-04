import { z } from 'zod';
import { uuid, isoTimestamp } from '../ids';

/**
 * Superuser back-office (LavoPilot team console). Cross-tenant support tickets,
 * the group (tenant) registry, and account management. Distinct from the
 * per-tenant Settings screen: these endpoints are gated by `superuser`, not by
 * tenant RBAC. Ticket *creation* is open to any authenticated user (the floating
 * support widget); everything else is staff-only.
 */

export const supportTicketStatus = z.enum(['open', 'pending', 'resolved', 'closed']);
export type SupportTicketStatus = z.infer<typeof supportTicketStatus>;

export const supportTicketPriority = z.enum(['low', 'normal', 'high', 'urgent']);
export type SupportTicketPriority = z.infer<typeof supportTicketPriority>;

export const supportTicketCategory = z.enum(['billing', 'technical', 'account', 'feature', 'other']);
export type SupportTicketCategory = z.infer<typeof supportTicketCategory>;

export const supportMessage = z.object({
  id: uuid,
  authorName: z.string(),
  authorRole: z.enum(['client', 'staff']),
  body: z.string(),
  at: isoTimestamp,
});
export type SupportMessage = z.infer<typeof supportMessage>;

export const supportTicket = z.object({
  id: uuid,
  ref: z.string(), // human ref, e.g. "SUP-1042"
  subject: z.string(),
  groupId: uuid,
  groupName: z.string(),
  requesterName: z.string(),
  requesterEmail: z.string(),
  status: supportTicketStatus,
  priority: supportTicketPriority,
  category: supportTicketCategory,
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
  messages: z.array(supportMessage),
});
export type SupportTicket = z.infer<typeof supportTicket>;

/** Submitted by the floating support widget (group/requester come from session). */
export const createSupportTicketInput = z.object({
  subject: z.string().trim().min(3).max(160),
  body: z.string().trim().min(1).max(5000),
  category: supportTicketCategory.default('other'),
  priority: supportTicketPriority.default('normal'),
});
export type CreateSupportTicketInput = z.infer<typeof createSupportTicketInput>;

/**
 * Staff action on a ticket: post a reply, change status, or both. `body` is
 * optional so a pure status transition (close/reopen) needs no message text;
 * at least one of `body`/`status` must be present.
 */
export const replyTicketInput = z
  .object({
    ticketId: uuid,
    body: z.string().trim().min(1).max(5000).optional(),
    status: supportTicketStatus.optional(),
  })
  .refine((v) => v.body !== undefined || v.status !== undefined, {
    message: 'body or status required',
  });
export type ReplyTicketInput = z.infer<typeof replyTicketInput>;

// ──────────────────────────────── Groups ───────────────────────────────────

export const groupPlan = z.enum(['starter', 'growth', 'scale', 'enterprise']);
export type GroupPlan = z.infer<typeof groupPlan>;

export const groupStatus = z.enum(['active', 'trial', 'past_due', 'suspended']);
export type GroupStatus = z.infer<typeof groupStatus>;

/** A tenant/group of laundromats — the SaaS customer. */
export const tenantGroup = z.object({
  id: uuid,
  name: z.string(),
  plan: groupPlan,
  status: groupStatus,
  sitesCount: z.number().int(),
  usersCount: z.number().int(),
  mrrCents: z.number().int(), // monthly recurring revenue
  ownerEmail: z.string(),
  createdAt: isoTimestamp,
});
export type TenantGroup = z.infer<typeof tenantGroup>;

// ─────────────────────────────── Accounts ──────────────────────────────────

export const accountRole = z.enum(['owner', 'manager', 'accountant', 'technician', 'viewer']);
export type AccountRole = z.infer<typeof accountRole>;

export const accountStatus = z.enum(['active', 'invited', 'suspended']);
export type AccountStatus = z.infer<typeof accountStatus>;

export const accountUser = z.object({
  id: uuid,
  groupId: uuid,
  groupName: z.string(),
  fullName: z.string(),
  email: z.string(),
  role: accountRole,
  status: accountStatus,
  lastActiveAt: isoTimestamp.nullable(),
  createdAt: isoTimestamp,
});
export type AccountUser = z.infer<typeof accountUser>;

export const createAccountInput = z.object({
  groupId: uuid,
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(200),
  role: accountRole.default('viewer'),
});
export type CreateAccountInput = z.infer<typeof createAccountInput>;

export const updateAccountInput = z.object({
  id: uuid,
  role: accountRole.optional(),
  status: accountStatus.optional(),
});
export type UpdateAccountInput = z.infer<typeof updateAccountInput>;
