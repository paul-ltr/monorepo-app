CREATE SCHEMA "core";
--> statement-breakpoint
CREATE TYPE "core"."accounting_export_kind" AS ENUM('fec', 'journal');--> statement-breakpoint
CREATE TYPE "core"."accounting_provider" AS ENUM('sage', 'cegid', 'pennylane', 'quickbooks');--> statement-breakpoint
CREATE TYPE "core"."campaign_channel" AS ENUM('sms', 'email', 'push');--> statement-breakpoint
CREATE TYPE "core"."charge_type" AS ENUM('rent', 'energy', 'maintenance', 'leasing', 'other');--> statement-breakpoint
CREATE TYPE "core"."connector_kind" AS ENUM('payment_central', 'machine_brand', 'energy', 'accounting', 'messaging', 'llm', 'billing');--> statement-breakpoint
CREATE TYPE "core"."connector_status" AS ENUM('not_connected', 'connecting', 'connected', 'error');--> statement-breakpoint
CREATE TYPE "core"."device_command_status" AS ENUM('queued', 'sent', 'acked', 'failed');--> statement-breakpoint
CREATE TYPE "core"."device_command_type" AS ENUM('set_out_of_service', 'set_in_service', 'refund', 'start_cycle');--> statement-breakpoint
CREATE TYPE "core"."loyalty_tier" AS ENUM('bronze', 'silver', 'gold');--> statement-breakpoint
CREATE TYPE "core"."machine_brand" AS ENUM('speed_queen', 'girbau', 'miele', 'electrolux', 'danube', 'other');--> statement-breakpoint
CREATE TYPE "core"."machine_kind" AS ENUM('washer', 'dryer', 'combo', 'dispenser');--> statement-breakpoint
CREATE TYPE "core"."machine_state" AS ENUM('free', 'running', 'finished', 'out_of_service', 'offline');--> statement-breakpoint
CREATE TYPE "core"."maintenance_plan_trigger" AS ENUM('cycles', 'calendar');--> statement-breakpoint
CREATE TYPE "core"."notification_severity" AS ENUM('critical', 'warning', 'info');--> statement-breakpoint
CREATE TYPE "core"."payment_central_brand" AS ENUM('lm_control', 'eas', 'myosis', 'm_innov', 'comestero', 'other');--> statement-breakpoint
CREATE TYPE "core"."payment_method" AS ENUM('contactless', 'cash', 'card', 'wallet');--> statement-breakpoint
CREATE TYPE "core"."price_slot" AS ENUM('standard', 'offpeak', 'peak', 'weekend');--> statement-breakpoint
CREATE TYPE "core"."scope_type" AS ENUM('tenant', 'network', 'site', 'machine');--> statement-breakpoint
CREATE TYPE "core"."site_status" AS ENUM('active', 'paused', 'closed');--> statement-breakpoint
CREATE TYPE "core"."technician_type" AS ENUM('internal', 'external');--> statement-breakpoint
CREATE TYPE "core"."tenant_status" AS ENUM('active', 'suspended', 'closed');--> statement-breakpoint
CREATE TYPE "core"."tenant_type" AS ENUM('independent', 'multi_site', 'network');--> statement-breakpoint
CREATE TYPE "core"."ticket_priority" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "core"."ticket_source" AS ENUM('alarm', 'customer', 'operator', 'plan');--> statement-breakpoint
CREATE TYPE "core"."ticket_status" AS ENUM('open', 'assigned', 'in_progress', 'resolved', 'closed');--> statement-breakpoint
CREATE TABLE "core"."app_user" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"cognito_sub" text,
	"email" text NOT NULL,
	"full_name" text NOT NULL,
	"locale" text DEFAULT 'fr-FR' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "app_user_cognito_sub_unique" UNIQUE("cognito_sub")
);
--> statement-breakpoint
CREATE TABLE "core"."network" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."site" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"network_id" uuid,
	"name" text NOT NULL,
	"address" text,
	"city" text,
	"postal_code" text,
	"lat" double precision,
	"lng" double precision,
	"surface_m2" double precision,
	"timezone" text DEFAULT 'Europe/Paris' NOT NULL,
	"opening_hours" jsonb,
	"status" "core"."site_status" DEFAULT 'active' NOT NULL,
	"opened_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "core"."tenant" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"name" text NOT NULL,
	"type" "core"."tenant_type" DEFAULT 'independent' NOT NULL,
	"status" "core"."tenant_status" DEFAULT 'active' NOT NULL,
	"locale" text DEFAULT 'fr-FR' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."tenant_branding" (
	"tenant_id" uuid PRIMARY KEY NOT NULL,
	"app_name" text NOT NULL,
	"logo_url" text,
	"primary_color" text DEFAULT '#1B4DB3' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."permission" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"module" text NOT NULL,
	CONSTRAINT "permission_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "core"."role" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" uuid,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."role_permission" (
	"role_id" uuid NOT NULL,
	"permission_id" uuid NOT NULL,
	CONSTRAINT "role_permission_role_id_permission_id_pk" PRIMARY KEY("role_id","permission_id")
);
--> statement-breakpoint
CREATE TABLE "core"."user_role" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"scope_type" "core"."scope_type" DEFAULT 'tenant' NOT NULL,
	"scope_id" uuid
);
--> statement-breakpoint
CREATE TABLE "core"."machine" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"central_id" uuid,
	"kind" "core"."machine_kind" NOT NULL,
	"brand" "core"."machine_brand" DEFAULT 'other' NOT NULL,
	"model" text,
	"serial" text NOT NULL,
	"capacity_kg" integer,
	"install_date" date,
	"warranty_until" date,
	"expected_life_cycles" integer,
	"status" "core"."machine_state" DEFAULT 'offline' NOT NULL,
	"external_ref" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."payment_central" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"brand" "core"."payment_central_brand" NOT NULL,
	"model" text,
	"max_outputs" integer,
	"external_ref" text,
	"installed_at" date,
	"status" text DEFAULT 'connected' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."program" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"machine_id" uuid,
	"code" text NOT NULL,
	"label" text NOT NULL,
	"default_duration_min" integer,
	"kind" "core"."machine_kind" DEFAULT 'washer' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."price" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"price_plan_id" uuid NOT NULL,
	"machine_kind" "core"."machine_kind",
	"machine_id" uuid,
	"program_id" uuid,
	"slot" "core"."price_slot" DEFAULT 'standard' NOT NULL,
	"amount_cents" bigint NOT NULL,
	"currency" char(3) DEFAULT 'EUR' NOT NULL,
	"valid_from" timestamp with time zone,
	"valid_to" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."price_plan" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"site_id" uuid,
	"name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."promotion" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"label" text NOT NULL,
	"scope" text DEFAULT 'tenant' NOT NULL,
	"type" text DEFAULT 'percentage' NOT NULL,
	"value" bigint,
	"schedule" jsonb,
	"active" boolean DEFAULT false NOT NULL,
	"starts_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."campaign" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"label" text NOT NULL,
	"channel" "core"."campaign_channel" NOT NULL,
	"segment_id" uuid,
	"content" jsonb,
	"schedule" jsonb,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."customer" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"external_auth_id" text,
	"email" text,
	"phone" text,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"consent" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "core"."customer_subscription" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"plan" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"period" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."loyalty_account" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"points" integer DEFAULT 0 NOT NULL,
	"tier" "core"."loyalty_tier" DEFAULT 'bronze' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."loyalty_transaction" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"loyalty_account_id" uuid NOT NULL,
	"delta" integer NOT NULL,
	"reason" text,
	"ref" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."segment" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"definition" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."wallet" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"balance_cents" bigint DEFAULT 0 NOT NULL,
	"currency" char(3) DEFAULT 'EUR' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."maintenance_plan" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"machine_id" uuid NOT NULL,
	"trigger" "core"."maintenance_plan_trigger" DEFAULT 'calendar' NOT NULL,
	"threshold" integer,
	"last_done_at" timestamp with time zone,
	"next_due_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."maintenance_ticket" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"machine_id" uuid,
	"source" "core"."ticket_source" DEFAULT 'operator' NOT NULL,
	"priority" "core"."ticket_priority" DEFAULT 'medium' NOT NULL,
	"status" "core"."ticket_status" DEFAULT 'open' NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"probable_cause" text,
	"assigned_technician_id" uuid,
	"sla_due_at" timestamp with time zone,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."part" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"sku" text NOT NULL,
	"label" text NOT NULL,
	"stock_qty" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."part_usage" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"ticket_id" uuid NOT NULL,
	"part_id" uuid NOT NULL,
	"qty" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."technician" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid,
	"name" text NOT NULL,
	"type" "core"."technician_type" DEFAULT 'internal' NOT NULL,
	"contact" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."ticket_event" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"ticket_id" uuid NOT NULL,
	"type" text NOT NULL,
	"note" text,
	"by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."accounting_connector" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"provider" "core"."accounting_provider" NOT NULL,
	"config" jsonb,
	"secret_ref" text,
	"status" text DEFAULT 'not_connected' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."accounting_export" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"kind" "core"."accounting_export_kind" NOT NULL,
	"period" text NOT NULL,
	"status" text DEFAULT 'generating' NOT NULL,
	"file_s3_key" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."charge" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"site_id" uuid,
	"type" "core"."charge_type" NOT NULL,
	"amount_cents" bigint NOT NULL,
	"currency" char(3) DEFAULT 'EUR' NOT NULL,
	"period" text,
	"recurring" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."invoice" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"stripe_invoice_id" text,
	"amount_cents" bigint NOT NULL,
	"currency" char(3) DEFAULT 'EUR' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"period" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."royalty_invoice" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"network_id" uuid NOT NULL,
	"site_id" uuid,
	"period" text NOT NULL,
	"amount_cents" bigint NOT NULL,
	"currency" char(3) DEFAULT 'EUR' NOT NULL,
	"status" text DEFAULT 'to_issue' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."royalty_rule" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"network_id" uuid NOT NULL,
	"basis" text DEFAULT 'revenue' NOT NULL,
	"rate_bps" integer NOT NULL,
	"scope" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."saas_subscription" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"stripe_customer_id" text,
	"plan" text DEFAULT 'starter' NOT NULL,
	"sites" integer,
	"status" text DEFAULT 'trialing' NOT NULL,
	"current_period_end" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."audit_log" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid,
	"action" text NOT NULL,
	"entity_type" text,
	"entity_id" text,
	"before" jsonb,
	"after" jsonb,
	"ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."connector_config" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"site_id" uuid,
	"kind" "core"."connector_kind" NOT NULL,
	"provider" text NOT NULL,
	"config" jsonb,
	"secret_ref" text,
	"status" "core"."connector_status" DEFAULT 'not_connected' NOT NULL,
	"last_sync_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."device_command" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"machine_id" uuid NOT NULL,
	"type" "core"."device_command_type" NOT NULL,
	"payload" jsonb,
	"status" "core"."device_command_status" DEFAULT 'queued' NOT NULL,
	"requested_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"executed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "core"."notification" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid,
	"severity" "core"."notification_severity" DEFAULT 'info' NOT NULL,
	"type" text,
	"title" text NOT NULL,
	"body" text,
	"link" text,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "core"."app_user" ADD CONSTRAINT "app_user_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "core"."tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."network" ADD CONSTRAINT "network_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "core"."tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."site" ADD CONSTRAINT "site_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "core"."tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."site" ADD CONSTRAINT "site_network_id_network_id_fk" FOREIGN KEY ("network_id") REFERENCES "core"."network"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."tenant_branding" ADD CONSTRAINT "tenant_branding_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "core"."tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."role" ADD CONSTRAINT "role_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "core"."tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."role_permission" ADD CONSTRAINT "role_permission_role_id_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "core"."role"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."role_permission" ADD CONSTRAINT "role_permission_permission_id_permission_id_fk" FOREIGN KEY ("permission_id") REFERENCES "core"."permission"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."user_role" ADD CONSTRAINT "user_role_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "core"."app_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."user_role" ADD CONSTRAINT "user_role_role_id_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "core"."role"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."machine" ADD CONSTRAINT "machine_site_id_site_id_fk" FOREIGN KEY ("site_id") REFERENCES "core"."site"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."machine" ADD CONSTRAINT "machine_central_id_payment_central_id_fk" FOREIGN KEY ("central_id") REFERENCES "core"."payment_central"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."payment_central" ADD CONSTRAINT "payment_central_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "core"."tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."payment_central" ADD CONSTRAINT "payment_central_site_id_site_id_fk" FOREIGN KEY ("site_id") REFERENCES "core"."site"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."program" ADD CONSTRAINT "program_machine_id_machine_id_fk" FOREIGN KEY ("machine_id") REFERENCES "core"."machine"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."price" ADD CONSTRAINT "price_price_plan_id_price_plan_id_fk" FOREIGN KEY ("price_plan_id") REFERENCES "core"."price_plan"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."price" ADD CONSTRAINT "price_machine_id_machine_id_fk" FOREIGN KEY ("machine_id") REFERENCES "core"."machine"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."price" ADD CONSTRAINT "price_program_id_program_id_fk" FOREIGN KEY ("program_id") REFERENCES "core"."program"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."price_plan" ADD CONSTRAINT "price_plan_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "core"."tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."price_plan" ADD CONSTRAINT "price_plan_site_id_site_id_fk" FOREIGN KEY ("site_id") REFERENCES "core"."site"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."campaign" ADD CONSTRAINT "campaign_segment_id_segment_id_fk" FOREIGN KEY ("segment_id") REFERENCES "core"."segment"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."customer_subscription" ADD CONSTRAINT "customer_subscription_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "core"."customer"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."loyalty_account" ADD CONSTRAINT "loyalty_account_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "core"."customer"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."loyalty_transaction" ADD CONSTRAINT "loyalty_transaction_loyalty_account_id_loyalty_account_id_fk" FOREIGN KEY ("loyalty_account_id") REFERENCES "core"."loyalty_account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."wallet" ADD CONSTRAINT "wallet_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "core"."customer"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."maintenance_plan" ADD CONSTRAINT "maintenance_plan_machine_id_machine_id_fk" FOREIGN KEY ("machine_id") REFERENCES "core"."machine"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."maintenance_ticket" ADD CONSTRAINT "maintenance_ticket_site_id_site_id_fk" FOREIGN KEY ("site_id") REFERENCES "core"."site"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."maintenance_ticket" ADD CONSTRAINT "maintenance_ticket_machine_id_machine_id_fk" FOREIGN KEY ("machine_id") REFERENCES "core"."machine"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."maintenance_ticket" ADD CONSTRAINT "maintenance_ticket_assigned_technician_id_technician_id_fk" FOREIGN KEY ("assigned_technician_id") REFERENCES "core"."technician"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."part_usage" ADD CONSTRAINT "part_usage_ticket_id_maintenance_ticket_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "core"."maintenance_ticket"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."part_usage" ADD CONSTRAINT "part_usage_part_id_part_id_fk" FOREIGN KEY ("part_id") REFERENCES "core"."part"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."technician" ADD CONSTRAINT "technician_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "core"."app_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."ticket_event" ADD CONSTRAINT "ticket_event_ticket_id_maintenance_ticket_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "core"."maintenance_ticket"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."ticket_event" ADD CONSTRAINT "ticket_event_by_user_id_app_user_id_fk" FOREIGN KEY ("by_user_id") REFERENCES "core"."app_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."accounting_export" ADD CONSTRAINT "accounting_export_created_by_app_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "core"."app_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."charge" ADD CONSTRAINT "charge_site_id_site_id_fk" FOREIGN KEY ("site_id") REFERENCES "core"."site"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."royalty_invoice" ADD CONSTRAINT "royalty_invoice_network_id_network_id_fk" FOREIGN KEY ("network_id") REFERENCES "core"."network"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."royalty_invoice" ADD CONSTRAINT "royalty_invoice_site_id_site_id_fk" FOREIGN KEY ("site_id") REFERENCES "core"."site"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."royalty_rule" ADD CONSTRAINT "royalty_rule_network_id_network_id_fk" FOREIGN KEY ("network_id") REFERENCES "core"."network"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."audit_log" ADD CONSTRAINT "audit_log_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "core"."app_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."connector_config" ADD CONSTRAINT "connector_config_site_id_site_id_fk" FOREIGN KEY ("site_id") REFERENCES "core"."site"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."device_command" ADD CONSTRAINT "device_command_site_id_site_id_fk" FOREIGN KEY ("site_id") REFERENCES "core"."site"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."device_command" ADD CONSTRAINT "device_command_machine_id_machine_id_fk" FOREIGN KEY ("machine_id") REFERENCES "core"."machine"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."device_command" ADD CONSTRAINT "device_command_requested_by_app_user_id_fk" FOREIGN KEY ("requested_by") REFERENCES "core"."app_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."notification" ADD CONSTRAINT "notification_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "core"."app_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "app_user_tenant_idx" ON "core"."app_user" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "app_user_tenant_email_idx" ON "core"."app_user" USING btree ("tenant_id",lower("email"));--> statement-breakpoint
CREATE INDEX "network_tenant_idx" ON "core"."network" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "site_tenant_idx" ON "core"."site" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "site_network_idx" ON "core"."site" USING btree ("network_id");--> statement-breakpoint
CREATE UNIQUE INDEX "role_tenant_key_idx" ON "core"."role" USING btree ("tenant_id","key");--> statement-breakpoint
CREATE INDEX "user_role_user_idx" ON "core"."user_role" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "machine_tenant_idx" ON "core"."machine" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "machine_site_idx" ON "core"."machine" USING btree ("site_id");--> statement-breakpoint
CREATE UNIQUE INDEX "machine_tenant_serial_idx" ON "core"."machine" USING btree ("tenant_id","serial");--> statement-breakpoint
CREATE INDEX "machine_oos_idx" ON "core"."machine" USING btree ("site_id") WHERE status = 'out_of_service';--> statement-breakpoint
CREATE INDEX "payment_central_site_idx" ON "core"."payment_central" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "program_tenant_idx" ON "core"."program" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "price_plan_idx" ON "core"."price" USING btree ("price_plan_id");--> statement-breakpoint
CREATE INDEX "price_plan_tenant_idx" ON "core"."price_plan" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "promotion_tenant_idx" ON "core"."promotion" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "campaign_tenant_idx" ON "core"."campaign" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "customer_tenant_idx" ON "core"."customer" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "segment_tenant_idx" ON "core"."segment" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "ticket_tenant_idx" ON "core"."maintenance_ticket" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "ticket_site_idx" ON "core"."maintenance_ticket" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "ticket_open_idx" ON "core"."maintenance_ticket" USING btree ("tenant_id","priority") WHERE status in ('open','assigned','in_progress');--> statement-breakpoint
CREATE INDEX "ticket_event_ticket_idx" ON "core"."ticket_event" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "charge_tenant_idx" ON "core"."charge" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "audit_tenant_idx" ON "core"."audit_log" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "connector_tenant_idx" ON "core"."connector_config" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "device_command_tenant_idx" ON "core"."device_command" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "device_command_status_idx" ON "core"."device_command" USING btree ("status");--> statement-breakpoint
CREATE INDEX "notification_tenant_idx" ON "core"."notification" USING btree ("tenant_id");