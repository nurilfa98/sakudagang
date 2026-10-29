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
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_product_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."product_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "product_categories_store_name_idx" ON "product_categories" USING btree ("store_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "products_store_name_idx" ON "products" USING btree ("store_id","name");--> statement-breakpoint
CREATE INDEX "products_store_active_idx" ON "products" USING btree ("store_id","is_active");--> statement-breakpoint
CREATE INDEX "products_category_idx" ON "products" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "stock_movements_product_idx" ON "stock_movements" USING btree ("store_id","product_id","created_at");--> statement-breakpoint
CREATE INDEX "stock_movements_reference_idx" ON "stock_movements" USING btree ("reference_table","reference_id");--> statement-breakpoint
-- Ditambahkan manual: kategori barang awal untuk toko yang SUDAH ada sebelum
-- migration ini (toko baru diisi oleh action "buat toko", lib/store-defaults.ts).
INSERT INTO "product_categories" ("id", "store_id", "name", "sort_order")
SELECT gen_random_uuid()::text, s."id", c."name", c."sort_order"
FROM "stores" s
CROSS JOIN (VALUES
  ('Sembako', 1), ('Minuman', 2), ('Makanan ringan', 3),
  ('Rokok', 4), ('Kebutuhan rumah', 5), ('Lainnya', 6)
) AS c("name", "sort_order")
WHERE NOT EXISTS (SELECT 1 FROM "product_categories" pc WHERE pc."store_id" = s."id");
