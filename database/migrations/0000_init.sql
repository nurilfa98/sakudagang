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
CREATE TABLE "document_sequences" (
	"store_id" varchar(36) NOT NULL,
	"prefix" varchar(5) NOT NULL,
	"period_year" smallint NOT NULL,
	"period_month" smallint NOT NULL,
	"last_value" integer NOT NULL,
	CONSTRAINT "document_sequences_store_id_prefix_period_year_period_month_pk" PRIMARY KEY("store_id","prefix","period_year","period_month")
);
--> statement-breakpoint
CREATE TABLE "expense_categories" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"store_id" varchar(36) NOT NULL,
	"name" varchar(50) NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"store_id" varchar(36) NOT NULL,
	"date" date NOT NULL,
	"category_id" varchar(36) NOT NULL,
	"amount" bigint NOT NULL,
	"note" varchar(500),
	"created_by_id" varchar(36) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "expenses_amount_check" CHECK ("expenses"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "login_attempts" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"email" varchar(100) NOT NULL,
	"ip_address" varchar(45),
	"success" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_bank_accounts" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"bank_name" varchar(50) NOT NULL,
	"account_number" varchar(50) NOT NULL,
	"account_name" varchar(100) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_settings" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"admin_phone" varchar(20),
	"qris_image_key" varchar(255),
	"free_days" integer DEFAULT 14 NOT NULL,
	"grace_days" integer DEFAULT 3 NOT NULL,
	"discount_6" integer DEFAULT 10 NOT NULL,
	"discount_12" integer DEFAULT 20 NOT NULL,
	"relief_days" integer DEFAULT 10 NOT NULL,
	"relief_drop_percent" integer DEFAULT 20 NOT NULL,
	"relief_max_6" integer DEFAULT 1 NOT NULL,
	"relief_max_12" integer DEFAULT 2 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_categories" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"store_id" varchar(36) NOT NULL,
	"name" varchar(50) NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"store_id" varchar(36) NOT NULL,
	"category_id" varchar(36) NOT NULL,
	"name" varchar(100) NOT NULL,
	"unit" varchar(20) NOT NULL,
	"cost_price" bigint DEFAULT 0 NOT NULL,
	"selling_price" bigint NOT NULL,
	"stock" integer DEFAULT 0 NOT NULL,
	"min_stock" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
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
CREATE TABLE "stock_movements" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"store_id" varchar(36) NOT NULL,
	"product_id" varchar(36) NOT NULL,
	"type" varchar(20) NOT NULL,
	"qty" integer NOT NULL,
	"stock_after" integer NOT NULL,
	"cost_price" bigint NOT NULL,
	"reference_table" varchar(30),
	"reference_id" varchar(36),
	"note" varchar(255),
	"created_by_id" varchar(36) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stock_movements_type_check" CHECK ("stock_movements"."type" IN ('INITIAL', 'PURCHASE', 'PURCHASE_VOID', 'SALE', 'SALE_VOID', 'STOCK_TAKE'))
);
--> statement-breakpoint
CREATE TABLE "stock_take_items" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"store_id" varchar(36) NOT NULL,
	"stock_take_id" varchar(36) NOT NULL,
	"product_id" varchar(36) NOT NULL,
	"product_name" varchar(100) NOT NULL,
	"system_qty" integer NOT NULL,
	"physical_qty" integer,
	"difference" integer,
	"reason" varchar(20),
	"note" varchar(255),
	"cost_price" bigint,
	"shrinkage_value" bigint,
	CONSTRAINT "stock_take_items_reason_check" CHECK ("stock_take_items"."reason" IS NULL OR "stock_take_items"."reason" IN ('DAMAGED', 'EXPIRED', 'LOST', 'PERSONAL_USE', 'MISCOUNT', 'OTHER'))
);
--> statement-breakpoint
CREATE TABLE "stock_takes" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"store_id" varchar(36) NOT NULL,
	"number" varchar(20) NOT NULL,
	"date" date NOT NULL,
	"status" varchar(10) DEFAULT 'DRAFT' NOT NULL,
	"note" varchar(500),
	"total_shrinkage" bigint,
	"completed_by_id" varchar(36),
	"completed_at" timestamp with time zone,
	"created_by_id" varchar(36) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stock_takes_status_check" CHECK ("stock_takes"."status" IN ('DRAFT', 'COMPLETED'))
);
--> statement-breakpoint
CREATE TABLE "store_plan_prices" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"store_id" varchar(36) NOT NULL,
	"months" smallint NOT NULL,
	"price" bigint NOT NULL,
	"note" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stores" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"business_type" varchar(50),
	"address" varchar(255),
	"phone" varchar(20),
	"timezone" varchar(50) DEFAULT 'Asia/Jakarta' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"subscription_until" timestamp with time zone DEFAULT now() NOT NULL,
	"last_reminder_key" varchar(20),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription_payments" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"subscription_id" varchar(36) NOT NULL,
	"store_id" varchar(36) NOT NULL,
	"status" varchar(20) NOT NULL,
	"proof_key" varchar(255),
	"note" varchar(255),
	"amount_received" bigint,
	"review_note" varchar(255),
	"reviewed_at" timestamp with time zone,
	"reviewed_by_id" varchar(36),
	"created_by_id" varchar(36) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscription_payments_status_check" CHECK ("subscription_payments"."status" IN ('PENDING', 'ACCEPTED', 'REJECTED'))
);
--> statement-breakpoint
CREATE TABLE "subscription_plans" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"months" smallint NOT NULL,
	"price" bigint DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscription_plans_months_unique" UNIQUE("months")
);
--> statement-breakpoint
CREATE TABLE "subscription_reliefs" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"store_id" varchar(36) NOT NULL,
	"subscription_id" varchar(36) NOT NULL,
	"period_year" smallint NOT NULL,
	"period_month" smallint NOT NULL,
	"revenue" bigint NOT NULL,
	"baseline_revenue" bigint NOT NULL,
	"drop_percent" integer,
	"status" varchar(15) NOT NULL,
	"days" smallint DEFAULT 0 NOT NULL,
	"until_after" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"revoked_by_id" varchar(36),
	"revoke_note" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscription_reliefs_status_check" CHECK ("subscription_reliefs"."status" IN ('GRANTED', 'REVOKED', 'NOT_MET', 'QUOTA_USED', 'NO_DATA'))
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"store_id" varchar(36) NOT NULL,
	"months" smallint NOT NULL,
	"price" bigint NOT NULL,
	"status" varchar(20) NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"amount_paid" bigint DEFAULT 0 NOT NULL,
	"note" varchar(255),
	"rejected_at" timestamp with time zone,
	"rejection_note" varchar(255),
	"relief_days" smallint,
	"relief_drop_percent" smallint,
	"relief_max" smallint,
	"created_by_id" varchar(36) NOT NULL,
	"confirmed_by_id" varchar(36),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_status_check" CHECK ("subscriptions"."status" IN ('PENDING', 'CLAIMED', 'UNDERPAID', 'ACTIVE', 'REJECTED', 'CANCELLED'))
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"store_id" varchar(36),
	"role" varchar(20) NOT NULL,
	"full_name" varchar(100) NOT NULL,
	"email" varchar(100) NOT NULL,
	"phone" varchar(20),
	"password_hash" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"must_change_password" boolean DEFAULT true NOT NULL,
	"session_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_role_check" CHECK ("users"."role" IN ('SUPERADMIN', 'OWNER', 'CASHIER'))
);
--> statement-breakpoint
ALTER TABLE "credit_payments" ADD CONSTRAINT "credit_payments_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_payments" ADD CONSTRAINT "credit_payments_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_payments" ADD CONSTRAINT "credit_payments_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_payments" ADD CONSTRAINT "credit_payments_voided_by_id_users_id_fk" FOREIGN KEY ("voided_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_payments" ADD CONSTRAINT "credit_payments_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_sequences" ADD CONSTRAINT "document_sequences_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_categories" ADD CONSTRAINT "expense_categories_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_category_id_expense_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."expense_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_product_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."product_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_purchase_id_purchases_id_fk" FOREIGN KEY ("purchase_id") REFERENCES "public"."purchases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_voided_by_id_users_id_fk" FOREIGN KEY ("voided_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_voided_by_id_users_id_fk" FOREIGN KEY ("voided_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_take_items" ADD CONSTRAINT "stock_take_items_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_take_items" ADD CONSTRAINT "stock_take_items_stock_take_id_stock_takes_id_fk" FOREIGN KEY ("stock_take_id") REFERENCES "public"."stock_takes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_take_items" ADD CONSTRAINT "stock_take_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_takes" ADD CONSTRAINT "stock_takes_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_takes" ADD CONSTRAINT "stock_takes_completed_by_id_users_id_fk" FOREIGN KEY ("completed_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_takes" ADD CONSTRAINT "stock_takes_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_plan_prices" ADD CONSTRAINT "store_plan_prices_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_payments" ADD CONSTRAINT "subscription_payments_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_payments" ADD CONSTRAINT "subscription_payments_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_payments" ADD CONSTRAINT "subscription_payments_reviewed_by_id_users_id_fk" FOREIGN KEY ("reviewed_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_payments" ADD CONSTRAINT "subscription_payments_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_reliefs" ADD CONSTRAINT "subscription_reliefs_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_reliefs" ADD CONSTRAINT "subscription_reliefs_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_reliefs" ADD CONSTRAINT "subscription_reliefs_revoked_by_id_users_id_fk" FOREIGN KEY ("revoked_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_confirmed_by_id_users_id_fk" FOREIGN KEY ("confirmed_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "credit_payments_sale_idx" ON "credit_payments" USING btree ("store_id","sale_id");--> statement-breakpoint
CREATE INDEX "credit_payments_customer_idx" ON "credit_payments" USING btree ("store_id","customer_id");--> statement-breakpoint
CREATE INDEX "credit_payments_date_idx" ON "credit_payments" USING btree ("store_id","date");--> statement-breakpoint
CREATE INDEX "customers_store_name_idx" ON "customers" USING btree ("store_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "expense_categories_store_name_idx" ON "expense_categories" USING btree ("store_id","name");--> statement-breakpoint
CREATE INDEX "expenses_store_date_idx" ON "expenses" USING btree ("store_id","date");--> statement-breakpoint
CREATE INDEX "expenses_category_idx" ON "expenses" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "login_attempts_email_idx" ON "login_attempts" USING btree ("email","created_at");--> statement-breakpoint
CREATE INDEX "login_attempts_ip_idx" ON "login_attempts" USING btree ("ip_address","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "product_categories_store_name_idx" ON "product_categories" USING btree ("store_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "products_store_name_idx" ON "products" USING btree ("store_id","name");--> statement-breakpoint
CREATE INDEX "products_store_active_idx" ON "products" USING btree ("store_id","is_active");--> statement-breakpoint
CREATE INDEX "products_category_idx" ON "products" USING btree ("category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "purchase_items_purchase_product_idx" ON "purchase_items" USING btree ("purchase_id","product_id");--> statement-breakpoint
CREATE INDEX "purchase_items_product_idx" ON "purchase_items" USING btree ("store_id","product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "purchases_store_number_idx" ON "purchases" USING btree ("store_id","number");--> statement-breakpoint
CREATE INDEX "purchases_store_date_idx" ON "purchases" USING btree ("store_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "sale_items_sale_product_idx" ON "sale_items" USING btree ("sale_id","product_id");--> statement-breakpoint
CREATE INDEX "sale_items_product_idx" ON "sale_items" USING btree ("store_id","product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sales_store_number_idx" ON "sales" USING btree ("store_id","number");--> statement-breakpoint
CREATE INDEX "sales_store_date_idx" ON "sales" USING btree ("store_id","date","status");--> statement-breakpoint
CREATE INDEX "sales_store_customer_idx" ON "sales" USING btree ("store_id","customer_id","payment_status");--> statement-breakpoint
CREATE INDEX "sales_created_by_idx" ON "sales" USING btree ("created_by_id");--> statement-breakpoint
CREATE INDEX "stock_movements_product_idx" ON "stock_movements" USING btree ("store_id","product_id","created_at");--> statement-breakpoint
CREATE INDEX "stock_movements_reference_idx" ON "stock_movements" USING btree ("reference_table","reference_id");--> statement-breakpoint
CREATE UNIQUE INDEX "stock_take_items_take_product_idx" ON "stock_take_items" USING btree ("stock_take_id","product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "stock_takes_store_number_idx" ON "stock_takes" USING btree ("store_id","number");--> statement-breakpoint
CREATE UNIQUE INDEX "stock_takes_store_draft_idx" ON "stock_takes" USING btree ("store_id") WHERE "stock_takes"."status" = 'DRAFT';--> statement-breakpoint
CREATE INDEX "stock_takes_store_date_idx" ON "stock_takes" USING btree ("store_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "store_plan_prices_store_months_idx" ON "store_plan_prices" USING btree ("store_id","months");--> statement-breakpoint
CREATE INDEX "subscription_payments_subscription_idx" ON "subscription_payments" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX "subscription_payments_status_idx" ON "subscription_payments" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "subscription_reliefs_store_period_idx" ON "subscription_reliefs" USING btree ("store_id","period_year","period_month");--> statement-breakpoint
CREATE INDEX "subscription_reliefs_subscription_idx" ON "subscription_reliefs" USING btree ("subscription_id","status");--> statement-breakpoint
CREATE INDEX "subscriptions_store_idx" ON "subscriptions" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "subscriptions_status_idx" ON "subscriptions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "users_store_id_idx" ON "users" USING btree ("store_id");--> statement-breakpoint
-- Ditambahkan manual: data awal yang wajib ada (lihat docs/BUSINESS-FLOW.md §14).
-- Baris pengaturan platform tunggal (nilai bawaan dari DEFAULT kolom) dan tiga
-- paket standar (harga 0 = belum dijual, diisi Superadmin di menu Pengaturan).
-- Aman dijalankan ulang.
INSERT INTO "platform_settings" ("id") VALUES ('default') ON CONFLICT ("id") DO NOTHING;--> statement-breakpoint
INSERT INTO "subscription_plans" ("id", "months", "price") VALUES
  (gen_random_uuid()::text, 1, 0),
  (gen_random_uuid()::text, 6, 0),
  (gen_random_uuid()::text, 12, 0)
ON CONFLICT ("months") DO NOTHING;
