import { z } from 'zod';

/**
 * Stable enumerations shared front↔back. These mirror the PostgreSQL enum types
 * created in `@pilotage/db`. Values are snake_case to match the DB; UI labels
 * (FR) are resolved through i18n, not stored here.
 */

export const tenantType = z.enum(['independent', 'multi_site', 'network']);
export type TenantType = z.infer<typeof tenantType>;

export const tenantStatus = z.enum(['active', 'suspended', 'closed']);
export type TenantStatus = z.infer<typeof tenantStatus>;

export const siteStatus = z.enum(['active', 'paused', 'closed']);
export type SiteStatus = z.infer<typeof siteStatus>;

export const machineKind = z.enum(['washer', 'dryer', 'combo', 'dispenser']);
export type MachineKind = z.infer<typeof machineKind>;

export const machineBrand = z.enum([
  'speed_queen',
  'girbau',
  'miele',
  'electrolux',
  'danube',
  'other',
]);
export type MachineBrand = z.infer<typeof machineBrand>;

export const paymentCentralBrand = z.enum([
  'lm_control',
  'eas',
  'myosis',
  'm_innov',
  'comestero',
  'other',
]);
export type PaymentCentralBrand = z.infer<typeof paymentCentralBrand>;

/** Live supervision state of a machine (M1). `offline` = no recent telemetry. */
export const machineState = z.enum([
  'free',
  'running',
  'finished',
  'out_of_service',
  'offline',
]);
export type MachineState = z.infer<typeof machineState>;

export const paymentMethod = z.enum(['contactless', 'cash', 'card', 'wallet']);
export type PaymentMethod = z.infer<typeof paymentMethod>;

export const ticketStatus = z.enum([
  'open',
  'assigned',
  'in_progress',
  'resolved',
  'closed',
]);
export type TicketStatus = z.infer<typeof ticketStatus>;

export const ticketPriority = z.enum(['low', 'medium', 'high', 'critical']);
export type TicketPriority = z.infer<typeof ticketPriority>;

export const ticketSource = z.enum(['alarm', 'customer', 'operator', 'plan']);
export type TicketSource = z.infer<typeof ticketSource>;

export const priceSlot = z.enum(['standard', 'offpeak', 'peak', 'weekend']);
export type PriceSlot = z.infer<typeof priceSlot>;

export const maintenancePlanTrigger = z.enum(['cycles', 'calendar']);
export type MaintenancePlanTrigger = z.infer<typeof maintenancePlanTrigger>;

export const technicianType = z.enum(['internal', 'external']);
export type TechnicianType = z.infer<typeof technicianType>;

export const loyaltyTier = z.enum(['bronze', 'silver', 'gold']);
export type LoyaltyTier = z.infer<typeof loyaltyTier>;

export const campaignChannel = z.enum(['sms', 'email', 'push']);
export type CampaignChannel = z.infer<typeof campaignChannel>;

export const chargeType = z.enum([
  'rent',
  'energy',
  'maintenance',
  'leasing',
  'other',
]);
export type ChargeType = z.infer<typeof chargeType>;

export const accountingExportKind = z.enum(['fec', 'journal']);
export type AccountingExportKind = z.infer<typeof accountingExportKind>;

export const accountingProvider = z.enum([
  'sage',
  'cegid',
  'pennylane',
  'quickbooks',
]);
export type AccountingProvider = z.infer<typeof accountingProvider>;

/** Categories of external connector shown in the Settings → Connectors UI. */
export const connectorKind = z.enum([
  'payment_central',
  'machine_brand',
  'energy',
  'accounting',
  'messaging',
  'llm',
  'billing',
]);
export type ConnectorKind = z.infer<typeof connectorKind>;

export const connectorStatus = z.enum([
  'not_connected',
  'connecting',
  'connected',
  'error',
]);
export type ConnectorStatus = z.infer<typeof connectorStatus>;

/** Remote device actions — app enqueues, data repo executes (Should). */
export const deviceCommandType = z.enum([
  'set_out_of_service',
  'set_in_service',
  'refund',
  'start_cycle',
]);
export type DeviceCommandType = z.infer<typeof deviceCommandType>;

export const deviceCommandStatus = z.enum([
  'queued',
  'sent',
  'acked',
  'failed',
]);
export type DeviceCommandStatus = z.infer<typeof deviceCommandStatus>;

/** RBAC scope granularity (EF-M9-03). */
export const scopeType = z.enum(['tenant', 'network', 'site', 'machine']);
export type ScopeType = z.infer<typeof scopeType>;

export const notificationSeverity = z.enum(['critical', 'warning', 'info']);
export type NotificationSeverity = z.infer<typeof notificationSeverity>;

export const reconciliationStatus = z.enum([
  'reconciled',
  'tolerated',
  'to_review',
  'critical',
]);
export type ReconciliationStatus = z.infer<typeof reconciliationStatus>;

/** Domain module identifiers (M1–M12) used by feature flags and permissions. */
export const moduleKey = z.enum([
  'M1',
  'M2',
  'M3',
  'M4',
  'M5',
  'M6',
  'M7',
  'M8',
  'M9',
  'M10',
  'M11',
  'M12',
]);
export type ModuleKey = z.infer<typeof moduleKey>;
