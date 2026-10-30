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
ALTER TABLE "expense_categories" ADD CONSTRAINT "expense_categories_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_category_id_expense_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."expense_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "expense_categories_store_name_idx" ON "expense_categories" USING btree ("store_id","name");--> statement-breakpoint
CREATE INDEX "expenses_store_date_idx" ON "expenses" USING btree ("store_id","date");--> statement-breakpoint
CREATE INDEX "expenses_category_idx" ON "expenses" USING btree ("category_id");--> statement-breakpoint
-- Ditambahkan manual: kategori pengeluaran awal untuk toko yang SUDAH ada
-- sebelum migration ini (toko baru diisi oleh action "buat toko", lib/store-defaults.ts).
INSERT INTO "expense_categories" ("id", "store_id", "name", "sort_order")
SELECT gen_random_uuid()::text, s."id", c."name", c."sort_order"
FROM "stores" s
CROSS JOIN (VALUES
  ('Listrik & air', 1), ('Transport', 2), ('Kemasan/plastik', 3),
  ('Gaji', 4), ('Sewa', 5), ('Lainnya', 6)
) AS c("name", "sort_order")
WHERE NOT EXISTS (SELECT 1 FROM "expense_categories" ec WHERE ec."store_id" = s."id");
