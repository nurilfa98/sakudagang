CREATE TABLE "document_sequences" (
	"store_id" varchar(36) NOT NULL,
	"prefix" varchar(5) NOT NULL,
	"period_year" smallint NOT NULL,
	"period_month" smallint NOT NULL,
	"last_value" integer NOT NULL,
	CONSTRAINT "document_sequences_store_id_prefix_period_year_period_month_pk" PRIMARY KEY("store_id","prefix","period_year","period_month")
);
--> statement-breakpoint
CREATE TABLE "purchase_items" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"store_id" varchar(36) NOT NULL,
	"purchase_id" varchar(36) NOT NULL,
	"product_id" varchar(36) NOT NULL,
	"product_name" varchar(100) NOT NULL,
	"qty" integer NOT NULL,
	"unit_cost" bigint NOT NULL,
	"subtotal" bigint NOT NULL,
	"cost_price_before" bigint NOT NULL,
	"cost_price_after" bigint NOT NULL,
	"new_selling_price" bigint,
	CONSTRAINT "purchase_items_qty_check" CHECK ("purchase_items"."qty" > 0)
);
--> statement-breakpoint
CREATE TABLE "purchases" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"store_id" varchar(36) NOT NULL,
	"number" varchar(20) NOT NULL,
	"period_year" smallint NOT NULL,
	"period_month" smallint NOT NULL,
	"date" date NOT NULL,
	"note" varchar(500),
	"total" bigint NOT NULL,
	"status" varchar(20) DEFAULT 'COMPLETED' NOT NULL,
	"void_reason" varchar(500),
	"voided_by_id" varchar(36),
	"voided_at" timestamp with time zone,
	"created_by_id" varchar(36) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "purchases_status_check" CHECK ("purchases"."status" IN ('COMPLETED', 'VOIDED'))
);
--> statement-breakpoint
ALTER TABLE "document_sequences" ADD CONSTRAINT "document_sequences_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_purchase_id_purchases_id_fk" FOREIGN KEY ("purchase_id") REFERENCES "public"."purchases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_voided_by_id_users_id_fk" FOREIGN KEY ("voided_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "purchase_items_purchase_product_idx" ON "purchase_items" USING btree ("purchase_id","product_id");--> statement-breakpoint
CREATE INDEX "purchase_items_product_idx" ON "purchase_items" USING btree ("store_id","product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "purchases_store_number_idx" ON "purchases" USING btree ("store_id","number");--> statement-breakpoint
CREATE INDEX "purchases_store_date_idx" ON "purchases" USING btree ("store_id","date");