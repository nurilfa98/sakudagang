CREATE TABLE "credit_payments" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"store_id" varchar(36) NOT NULL,
	"sale_id" varchar(36) NOT NULL,
	"customer_id" varchar(36) NOT NULL,
	"date" date NOT NULL,
	"amount" bigint NOT NULL,
	"payment_method" varchar(10) NOT NULL,
	"status" varchar(15) DEFAULT 'COMPLETED' NOT NULL,
	"void_reason" varchar(500),
	"voided_by_id" varchar(36),
	"voided_at" timestamp with time zone,
	"created_by_id" varchar(36) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credit_payments_amount_check" CHECK ("credit_payments"."amount" > 0),
	CONSTRAINT "credit_payments_method_check" CHECK ("credit_payments"."payment_method" IN ('CASH', 'QRIS')),
	CONSTRAINT "credit_payments_status_check" CHECK ("credit_payments"."status" IN ('COMPLETED', 'VOIDED'))
);
--> statement-breakpoint
ALTER TABLE "credit_payments" ADD CONSTRAINT "credit_payments_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_payments" ADD CONSTRAINT "credit_payments_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_payments" ADD CONSTRAINT "credit_payments_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_payments" ADD CONSTRAINT "credit_payments_voided_by_id_users_id_fk" FOREIGN KEY ("voided_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_payments" ADD CONSTRAINT "credit_payments_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "credit_payments_sale_idx" ON "credit_payments" USING btree ("store_id","sale_id");--> statement-breakpoint
CREATE INDEX "credit_payments_customer_idx" ON "credit_payments" USING btree ("store_id","customer_id");--> statement-breakpoint
CREATE INDEX "credit_payments_date_idx" ON "credit_payments" USING btree ("store_id","date");