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
ALTER TABLE "stock_take_items" ADD CONSTRAINT "stock_take_items_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_take_items" ADD CONSTRAINT "stock_take_items_stock_take_id_stock_takes_id_fk" FOREIGN KEY ("stock_take_id") REFERENCES "public"."stock_takes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_take_items" ADD CONSTRAINT "stock_take_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_takes" ADD CONSTRAINT "stock_takes_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_takes" ADD CONSTRAINT "stock_takes_completed_by_id_users_id_fk" FOREIGN KEY ("completed_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_takes" ADD CONSTRAINT "stock_takes_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "stock_take_items_take_product_idx" ON "stock_take_items" USING btree ("stock_take_id","product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "stock_takes_store_number_idx" ON "stock_takes" USING btree ("store_id","number");--> statement-breakpoint
CREATE UNIQUE INDEX "stock_takes_store_draft_idx" ON "stock_takes" USING btree ("store_id") WHERE "stock_takes"."status" = 'DRAFT';--> statement-breakpoint
CREATE INDEX "stock_takes_store_date_idx" ON "stock_takes" USING btree ("store_id","date");