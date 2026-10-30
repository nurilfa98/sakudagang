// Form catat pembelian (barang masuk). Pemilik memilih barang satu per satu
// dari kotak pencarian, lalu mengisi qty, harga beli per satuan, dan
// (opsional) harga jual baru per baris.
//
// Setiap baris menampilkan pratinjau harga modal rata-rata baru (rumus yang
// sama dengan server, features/products/service.ts) dan peringatan bila harga
// jual akan berada di bawah harga modal. Angka final tetap dihitung server.
//
// Baris dikirim sebagai JSON di field "items"; error per baris dari server
// berkunci "items.<index>.<field>".

"use client";

import { LoaderCircleIcon, PackageSearchIcon, Trash2Icon, TriangleAlertIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useActionState, useEffect, useState, type FormEvent } from "react";
import { RupiahInput } from "@/components/rupiah-input";
import { TextField } from "@/components/text-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { calculateAverageCost } from "@/features/products/service";
import { createPurchase } from "@/features/purchases/actions";
import { MAX_PURCHASE_ITEMS } from "@/features/purchases/constants";
import type { PurchasableProduct } from "@/features/purchases/queries";
import { formatRupiah } from "@/lib/format";
import { notify } from "@/lib/notify";
import { cn } from "@/lib/utils";

type Line = {
  product: PurchasableProduct;
  qty: string;
  unitCost: number | null;
  newSellingPrice: number | null;
};

export function PurchaseForm({ products, today }: { products: PurchasableProduct[]; today: string }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(createPurchase, undefined);
  const [lines, setLines] = useState<Line[]>([]);
  const [query, setQuery] = useState("");

  const error = state && !state.success ? state : undefined;
  const fieldError = (name: string) => error?.fieldErrors?.[name]?.[0];

  useEffect(() => {
    if (!state) return;
    if (!state.success) {
      if (!state.fieldErrors) notify.error(state.message);
      return;
    }
    notify.success("Pembelian tersimpan. Stok dan harga modal sudah diperbarui.");
    router.push(`/purchases/${state.data.id}`);
  }, [state, router]);

  const added = new Set(lines.map((line) => line.product.id));
  const available = products.filter((product) => !added.has(product.id));
  const total = lines.reduce((sum, line) => sum + (parseQty(line.qty) ?? 0) * (line.unitCost ?? 0), 0);

  function addLine(product: PurchasableProduct) {
    // Harga beli diisi harga modal saat ini sebagai titik awal (sering sama).
    setLines((current) => [
      ...current,
      { product, qty: "", unitCost: product.costPrice > 0 ? product.costPrice : null, newSellingPrice: null },
    ]);
    setQuery("");
  }

  function updateLine(productId: string, patch: Partial<Omit<Line, "product">>) {
    setLines((current) => current.map((line) => (line.product.id === productId ? { ...line, ...patch } : line)));
  }

  function removeLine(productId: string) {
    setLines((current) => current.filter((line) => line.product.id !== productId));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    formData.set(
      "items",
      JSON.stringify(
        lines.map((line) => ({
          productId: line.product.id,
          qty: line.qty,
          unitCost: line.unitCost == null ? "" : String(line.unitCost),
          newSellingPrice: line.newSellingPrice == null ? "" : String(line.newSellingPrice),
        })),
      ),
    );
    startTransition(() => formAction(formData));
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Data belanja</CardTitle>
          <CardDescription>Ongkos angkut, bensin, dan parkir dicatat di Pengeluaran, bukan di sini.</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup className="max-w-xl">
            <TextField
              name="date"
              label="Tanggal belanja"
              type="date"
              defaultValue={today}
              max={today}
              required
              className="max-w-48"
              error={fieldError("date")}
            />
            <TextField
              name="note"
              label="Catatan (opsional)"
              placeholder="Belanja di grosir Pak Haji"
              autoComplete="off"
              maxLength={500}
              error={fieldError("note")}
            />
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Barang</CardTitle>
          <CardDescription>
            Cari barang lalu isi jumlah dan harga beli per satuan. Barang baru dibuat dulu di menu{" "}
            <Link href="/products/new" className="underline">
              Barang
            </Link>
            .
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Field data-invalid={!!fieldError("items")}>
            <FieldLabel htmlFor="product-search" className="sr-only">
              Tambah barang
            </FieldLabel>
            <Combobox
              items={available}
              value={null}
              onValueChange={(product: PurchasableProduct | null) => product && addLine(product)}
              itemToStringLabel={(product: PurchasableProduct) => product.name}
              inputValue={query}
              // Hanya ketikan user yang mengisi kotak; setelah barang dipilih
              // kotak dikosongkan lagi untuk pencarian barang berikutnya.
              onInputValueChange={(value, { reason }) => setQuery(reason === "input-change" ? value : "")}
              disabled={lines.length >= MAX_PURCHASE_ITEMS}
            >
              <ComboboxInput
                id="product-search"
                placeholder={products.length ? "Cari nama barang untuk ditambahkan" : "Belum ada barang aktif"}
                className="w-full"
                aria-invalid={!!fieldError("items")}
              />
              <ComboboxContent>
                <ComboboxEmpty>Barang tidak ditemukan.</ComboboxEmpty>
                <ComboboxList>
                  {(product: PurchasableProduct) => (
                    <ComboboxItem key={product.id} value={product}>
                      <span className="flex-1 truncate">{product.name}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        stok {product.stock.toLocaleString("id-ID")} {product.unit}
                      </span>
                    </ComboboxItem>
                  )}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
            <FieldError>{fieldError("items")}</FieldError>
          </Field>

          {lines.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
              <PackageSearchIcon className="size-6" />
              Belum ada barang di pembelian ini.
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {lines.map((line, index) => (
                <PurchaseLine
                  key={line.product.id}
                  line={line}
                  error={(field) => fieldError(`items.${index}.${field}`)}
                  onChange={(patch) => updateLine(line.product.id, patch)}
                  onRemove={() => removeLine(line.product.id)}
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-4 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col">
          <span className="text-sm text-muted-foreground">
            Total pembelian · {lines.length} barang
          </span>
          <span className="font-mono text-2xl font-semibold tabular-nums">{formatRupiah(total)}</span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" nativeButton={false} render={<Link href="/purchases" />}>
            Batal
          </Button>
          <Button type="submit" disabled={pending || lines.length === 0}>
            {pending && <LoaderCircleIcon className="animate-spin" />}
            {pending ? "Menyimpan..." : "Simpan pembelian"}
          </Button>
        </div>
      </div>
    </form>
  );
}

function PurchaseLine({
  line,
  error,
  onChange,
  onRemove,
}: {
  line: Line;
  error: (field: "productId" | "qty" | "unitCost" | "newSellingPrice") => string | undefined;
  onChange: (patch: Partial<Omit<Line, "product">>) => void;
  onRemove: () => void;
}) {
  const { product } = line;
  const qty = parseQty(line.qty);
  const id = (field: string) => `${field}-${product.id}`;

  // Pratinjau rumus server: rata-rata tertimbang, stok lama ≤ 0 → harga beli.
  const costAfter = qty && line.unitCost ? calculateAverageCost(product.stock, product.costPrice, qty, line.unitCost) : null;
  const sellingPrice = line.newSellingPrice ?? product.sellingPrice;
  const sellingBelowCost = costAfter != null && sellingPrice < costAfter;

  return (
    <li className="flex flex-col gap-3 rounded-lg border p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium">{product.name}</p>
          <p className="text-xs text-muted-foreground">
            Stok {product.stock.toLocaleString("id-ID")} {product.unit} · modal {formatRupiah(product.costPrice)} · jual{" "}
            {formatRupiah(product.sellingPrice)}
          </p>
          {error("productId") && <p className="text-sm text-destructive">{error("productId")}</p>}
        </div>
        <Button type="button" variant="ghost" size="icon-sm" onClick={onRemove} aria-label={`Hapus ${product.name}`}>
          <Trash2Icon />
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Field data-invalid={!!error("qty")}>
          <FieldLabel htmlFor={id("qty")}>Jumlah ({product.unit})</FieldLabel>
          <Input
            id={id("qty")}
            inputMode="numeric"
            autoComplete="off"
            autoFocus
            value={line.qty}
            onChange={(event) => onChange({ qty: event.target.value.replace(/\D/g, "").slice(0, 9) })}
            placeholder="0"
            className="tabular-nums"
            aria-invalid={!!error("qty")}
          />
          <FieldError>{error("qty")}</FieldError>
        </Field>
        <Field data-invalid={!!error("unitCost")}>
          <FieldLabel htmlFor={id("unitCost")}>Harga beli / {product.unit}</FieldLabel>
          <RupiahInput
            id={id("unitCost")}
            defaultValue={line.unitCost}
            onValueChange={(unitCost) => onChange({ unitCost })}
            placeholder="18.500"
            aria-invalid={!!error("unitCost")}
          />
          <FieldError>{error("unitCost")}</FieldError>
        </Field>
        <Field data-invalid={!!error("newSellingPrice")}>
          <FieldLabel htmlFor={id("newSellingPrice")}>Harga jual baru</FieldLabel>
          <RupiahInput
            id={id("newSellingPrice")}
            defaultValue={line.newSellingPrice}
            onValueChange={(newSellingPrice) => onChange({ newSellingPrice })}
            placeholder="Tidak berubah"
            aria-invalid={!!error("newSellingPrice")}
          />
          {error("newSellingPrice") ? (
            <FieldError>{error("newSellingPrice")}</FieldError>
          ) : (
            <FieldDescription>Kosongkan bila tetap.</FieldDescription>
          )}
        </Field>
      </div>

      <div className="flex flex-col gap-1 border-t pt-3 text-sm sm:flex-row sm:items-center sm:justify-between">
        <span className="text-muted-foreground">
          Harga modal{" "}
          <span className="tabular-nums">{formatRupiah(product.costPrice)}</span> →{" "}
          <span className={cn("font-medium tabular-nums", costAfter != null && "text-foreground")}>
            {costAfter == null ? "…" : formatRupiah(costAfter)}
          </span>
        </span>
        <span className="font-medium tabular-nums">
          Subtotal {formatRupiah((qty ?? 0) * (line.unitCost ?? 0))}
        </span>
      </div>
      {sellingBelowCost && (
        <p className="flex items-center gap-1.5 text-sm text-amber-700 dark:text-amber-300">
          <TriangleAlertIcon className="size-4 shrink-0" />
          Harga jual {formatRupiah(sellingPrice)} di bawah harga modal baru. Isi harga jual baru bila perlu naik.
        </p>
      )}
    </li>
  );
}

// Isi kotak qty (hanya angka) → bilangan bulat > 0, selain itu null.
function parseQty(value: string) {
  const qty = Number(value);
  return value && Number.isInteger(qty) && qty > 0 ? qty : null;
}
