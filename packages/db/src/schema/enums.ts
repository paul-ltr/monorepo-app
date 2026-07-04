import { core } from './_columns';

/**
 * Postgres enum types in `core`. These are the DB-side mirror of the unions in
 * @pilotage/shared/enums — keep the two in sync.
 */
export const tenantTypeEnum = core.enum('tenant_type', [
  'independent',
  'multi_site',
  'network',
]);
export const tenantStatusEnum = core.enum('tenant_status', ['active', 'suspended', 'closed']);
export const siteStatusEnum = core.enum('site_status', ['active', 'paused', 'closed']);
export const scopeTypeEnum = core.enum('scope_type', ['tenant', 'network', 'site', 'machine']);

export const machineKindEnum = core.enum('machine_kind', [
  'washer',
  'dryer',
  'combo',
  'dispenser',
]);
export const machineBrandEnum = core.enum('machine_brand', [
  'speed_queen',
  'girbau',
  'miele',
  'electrolux',
  'danube',
  'other',
]);
export const paymentCentralBrandEnum = core.enum('payment_central_brand', [
  'lm_control',
  'eas',
  'myosis',
  'm_innov',
  'comestero',
  'other',
]);
export const machineStateEnum = core.enum('machine_state', [
  'free',
  'running',
  'finished',
  'out_of_service',
  'offline',
]);

export const paymentMethodEnum = core.enum('payment_method', [
  'contactless',
  'cash',
  'card',
  'wallet',
]);
export const priceSlotEnum = core.enum('price_slot', [
  'standard',
  'offpeak',
  'peak',
  'weekend',
]);

export const ticketStatusEnum = core.enum('ticket_status', [
  'open',
  'assigned',
  'in_progress',
  'resolved',
  'closed',
]);
export const ticketPriorityEnum = core.enum('ticket_priority', [
  'low',
  'medium',
  'high',
  'critical',
]);
export const ticketSourceEnum = core.enum('ticket_source', [
  'alarm',
  'customer',
  'operator',
  'plan',
]);
export const maintenancePlanTriggerEnum = core.enum('maintenance_plan_trigger', [
  'cycles',
  'calendar',
]);
export const technicianTypeEnum = core.enum('technician_type', ['internal', 'external']);

export const loyaltyTierEnum = core.enum('loyalty_tier', ['bronze', 'silver', 'gold']);
export const campaignChannelEnum = core.enum('campaign_channel', ['sms', 'email', 'push']);

export const chargeTypeEnum = core.enum('charge_type', [
  'rent',
  'energy',
  'maintenance',
  'leasing',
  'other',
]);
export const accountingExportKindEnum = core.enum('accounting_export_kind', ['fec', 'journal']);
export const accountingProviderEnum = core.enum('accounting_provider', [
  'sage',
  'cegid',
  'pennylane',
  'quickbooks',
]);

export const connectorKindEnum = core.enum('connector_kind', [
  'payment_central',
  'machine_brand',
  'energy',
  'accounting',
  'messaging',
  'llm',
  'billing',
]);
export const connectorStatusEnum = core.enum('connector_status', [
  'not_connected',
  'connecting',
  'connected',
  'error',
]);

export const deviceCommandTypeEnum = core.enum('device_command_type', [
  'set_out_of_service',
  'set_in_service',
  'refund',
  'start_cycle',
]);
export const deviceCommandStatusEnum = core.enum('device_command_status', [
  'queued',
  'sent',
  'acked',
  'failed',
]);

export const notificationSeverityEnum = core.enum('notification_severity', [
  'critical',
  'warning',
  'info',
]);

export const supportTicketStatusEnum = core.enum('support_ticket_status', [
  'open',
  'pending',
  'resolved',
  'closed',
]);
export const supportTicketPriorityEnum = core.enum('support_ticket_priority', [
  'low',
  'normal',
  'high',
  'urgent',
]);
export const supportTicketCategoryEnum = core.enum('support_ticket_category', [
  'billing',
  'technical',
  'account',
  'feature',
  'other',
]);
