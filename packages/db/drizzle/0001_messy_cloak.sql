CREATE TYPE "core"."support_ticket_category" AS ENUM('billing', 'technical', 'account', 'feature', 'other');--> statement-breakpoint
CREATE TYPE "core"."support_ticket_priority" AS ENUM('low', 'normal', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "core"."support_ticket_status" AS ENUM('open', 'pending', 'resolved', 'closed');--> statement-breakpoint
CREATE TABLE "core"."support_message" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"ticket_id" uuid NOT NULL,
	"author_name" text NOT NULL,
	"author_role" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"meta" jsonb
);
--> statement-breakpoint
CREATE TABLE "core"."support_ticket" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"ref" text NOT NULL,
	"subject" text NOT NULL,
	"requester_name" text NOT NULL,
	"requester_email" text NOT NULL,
	"status" "core"."support_ticket_status" DEFAULT 'open' NOT NULL,
	"priority" "core"."support_ticket_priority" DEFAULT 'normal' NOT NULL,
	"category" "core"."support_ticket_category" DEFAULT 'other' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "core"."support_message" ADD CONSTRAINT "support_message_ticket_id_support_ticket_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "core"."support_ticket"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."support_ticket" ADD CONSTRAINT "support_ticket_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "core"."tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "support_message_ticket_idx" ON "core"."support_message" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "support_ticket_tenant_idx" ON "core"."support_ticket" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "support_ticket_status_idx" ON "core"."support_ticket" USING btree ("status");