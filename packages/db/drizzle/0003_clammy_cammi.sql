CREATE TABLE "core"."site_contact" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"value" text NOT NULL,
	"label" text,
	"is_alert_recipient" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."yield_window" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"site_id" uuid,
	"price_plan_id" uuid,
	"day_of_week" smallint,
	"slot" "core"."price_slot" DEFAULT 'standard' NOT NULL,
	"from_hour" integer DEFAULT 0 NOT NULL,
	"to_hour" integer DEFAULT 24 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "core"."site" ADD COLUMN "pdl" text;--> statement-breakpoint
ALTER TABLE "core"."site" ADD COLUMN "pce" text;--> statement-breakpoint
ALTER TABLE "core"."promotion" ADD COLUMN "code" text;--> statement-breakpoint
ALTER TABLE "core"."promotion" ADD COLUMN "status" text DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE "core"."promotion" ADD COLUMN "ends_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "core"."site_contact" ADD CONSTRAINT "site_contact_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "core"."tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."site_contact" ADD CONSTRAINT "site_contact_site_id_site_id_fk" FOREIGN KEY ("site_id") REFERENCES "core"."site"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."yield_window" ADD CONSTRAINT "yield_window_site_id_site_id_fk" FOREIGN KEY ("site_id") REFERENCES "core"."site"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."yield_window" ADD CONSTRAINT "yield_window_price_plan_id_price_plan_id_fk" FOREIGN KEY ("price_plan_id") REFERENCES "core"."price_plan"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "site_contact_site_idx" ON "core"."site_contact" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "yield_window_plan_idx" ON "core"."yield_window" USING btree ("price_plan_id");--> statement-breakpoint
ALTER TABLE "core"."site" ADD CONSTRAINT "site_pdl_digits14" CHECK ("core"."site"."pdl" IS NULL OR "core"."site"."pdl" ~ '^[0-9]{14}$');--> statement-breakpoint
ALTER TABLE "core"."site" ADD CONSTRAINT "site_pce_digits14" CHECK ("core"."site"."pce" IS NULL OR "core"."site"."pce" ~ '^[0-9]{14}$');--> statement-breakpoint
ALTER TABLE "core"."site_contact" ADD CONSTRAINT "site_contact_kind_check" CHECK ("core"."site_contact"."kind" IN ('email','phone'));