CREATE TABLE "customers" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"store_id" varchar(36) NOT NULL,
	"name" varchar(100) NOT NULL,
	"phone" varchar(20),
	"note" varchar(500),
	"allow_credit" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sale_items" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"store_id" varchar(36) NOT NULL,
	"sale_id" varchar(36) NOT NULL,
	"product_id" varchar(36) NOT NULL,
	"product_name" varchar(100) NOT NULL,
	"qty" integer NOT NULL,
	"selling_price" bigint NOT NULL,
	"cost_price" bigint NOT NULL,
	"subtotal" bigint NOT NULL,
	"gross_profit" bigint NOT NULL,
	CONSTRAINT "sale_items_qty_check" CHECK ("sale_items"."qty" > 0)
);
--> statement-breakpoint
CREATE TABLE "sales" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"store_id" varchar(36) NOT NULL,
	"number" varchar(20) NOT NULL,
	"period_year" smallint NOT NULL,
	"period_month" smallint NOT NULL,
	"date" date NOT NULL,
	"payment_method" varchar(10) NOT NULL,
	"customer_id" varchar(36),
	"total" bigint NOT NULL,
	"total_cost" bigint NOT NULL,
	"total_gross_profit" bigint NOT NULL,
	"cash_received" bigint,
	"payment_status" varchar(15) NOT NULL,
	"status" varchar(15) DEFAULT 'COMPLETED' NOT NULL,
	"void_reason" varchar(500),
	"voided_by_id" varchar(36),
	"voided_at" timestamp with time zone,
	"created_by_id" varchar(36) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sales_payment_method_check" CHECK ("sales"."payment_method" IN ('CASH', 'QRIS', 'CREDIT')),
	CONSTRAINT "sales_payment_status_check" CHECK ("sales"."payment_status" IN ('PAID', 'UNPAID')),
	CONSTRAINT "sales_status_check" CHECK ("sales"."status" IN ('COMPLETED', 'VOIDED')),
	CONSTRAINT "sales_credit_customer_check" CHECK ("sales"."payment_method" <> 'CREDIT' OR "sales"."customer_id" IS NOT NULL)
);
--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_voided_by_id_users_id_fk" FOREIGN KEY ("voided_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "customers_store_name_idx" ON "customers" USING btree ("store_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "sale_items_sale_product_idx" ON "sale_items" USING btree ("sale_id","product_id");--> statement-breakpoint
CREATE INDEX "sale_items_product_idx" ON "sale_items" USING btree ("store_id","product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sales_store_number_idx" ON "sales" USING btree ("store_id","number");--> statement-breakpoint
CREATE INDEX "sales_store_date_idx" ON "sales" USING btree ("store_id","date","status");--> statement-breakpoint
CREATE INDEX "sales_store_customer_idx" ON "sales" USING btree ("store_id","customer_id","payment_status");--> statement-breakpoint
CREATE INDEX "sales_created_by_idx" ON "sales" USING btree ("created_by_id");