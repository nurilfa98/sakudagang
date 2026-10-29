// Form tambah & edit barang. Tanpa `product` = tambah (ada bagian stok awal),
// dengan `product` = edit (harga modal & stok tidak di sini: berubah lewat
// pembelian / opname).
//
// onSubmit + startTransition agar isian tidak hilang saat validasi gagal
// (lihat store-form.tsx).

"use client";

import { LoaderCircleIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useActionState, useEffect, useState, type FormEvent } from "react";
import { RupiahInput } from "@/components/rupiah-input";
import { TextField } from "@/components/text-field";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createProduct, updateProduct } from "@/features/products/actions";
import { UNIT_SUGGESTIONS } from "@/features/products/constants";
import type { CategoryItem, ProductDetail } from "@/features/products/queries";
import { notify } from "@/lib/notify";

type Props = {
  categories: Pick<CategoryItem, "id" | "name">[];
  product?: ProductDetail;
};

export function ProductForm({ categories, product }: Props) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(product ? updateProduct : createProduct, undefined);
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? "");

  const error = state && !state.success ? state : undefined;
  const fieldError = (name: string) => error?.fieldErrors?.[name]?.[0];

  useEffect(() => {
    if (!state) return;
    if (!state.success) {
      if (!state.fieldErrors) notify.error(state.message);
      return;
    }
    if (product) {
      notify.success("Perubahan disimpan.");
    } else {
      notify.success("Barang berhasil ditambahkan.");
      router.push("/products");
    }
  }, [state, product, router]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  const categoryItems = categories.map((c) => ({ value: c.id, label: c.name }));

  return (
    <form onSubmit={handleSubmit} className="max-w-xl">
      {product && <input type="hidden" name="productId" value={product.id} />}
      <input type="hidden" name="categoryId" value={categoryId} />
      <FieldGroup>
        <TextField
          name="name"
          label="Nama barang"
          defaultValue={product?.name}
          placeholder="Minyak Goreng 1 L"
          autoComplete="off"
          required
          description="Produk yang sama dengan kemasan berbeda adalah barang berbeda, mis. “Gula 1 kg” dan “Gula ½ kg”."
          error={fieldError("name")}
        />

        <Field data-invalid={!!fieldError("categoryId")}>
          <FieldLabel htmlFor="categoryId">Kategori</FieldLabel>
          <Select value={categoryId} onValueChange={(value) => setCategoryId(String(value ?? ""))} items={categoryItems}>
            <SelectTrigger id="categoryId" className="w-full" aria-invalid={!!fieldError("categoryId")}>
              <SelectValue placeholder="Pilih kategori" />
            </SelectTrigger>
            <SelectContent>
              {categoryItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!fieldError("categoryId") && (
            <FieldDescription>
              Kelola daftar kategori di{" "}
              <Link href="/products/categories" className="underline">
                halaman kategori
              </Link>
              .
            </FieldDescription>
          )}
          <FieldError>{fieldError("categoryId")}</FieldError>
        </Field>

        <div className="grid gap-6 sm:grid-cols-2">
          <TextField
            name="unit"
            label="Satuan"
            defaultValue={product?.unit ?? "pcs"}
            placeholder="pcs"
            autoComplete="off"
            list="unit-suggestions"
            required
            error={fieldError("unit")}
          />
          <datalist id="unit-suggestions">
            {UNIT_SUGGESTIONS.map((unit) => (
              <option key={unit} value={unit} />
            ))}
          </datalist>

          <Field data-invalid={!!fieldError("sellingPrice")}>
            <FieldLabel htmlFor="sellingPrice">Harga jual</FieldLabel>
            <RupiahInput
              id="sellingPrice"
              name="sellingPrice"
              defaultValue={product?.sellingPrice}
              placeholder="18.500"
              required
              aria-invalid={!!fieldError("sellingPrice")}
            />
            <FieldError>{fieldError("sellingPrice")}</FieldError>
          </Field>
        </div>

        <Field data-invalid={!!fieldError("minStock")}>
          <FieldLabel htmlFor="minStock">Stok minimum</FieldLabel>
          <Input
            id="minStock"
            name="minStock"
            inputMode="numeric"
            defaultValue={product?.minStock ?? ""}
            placeholder="Kosongkan bila tidak dipantau"
            className="max-w-48 tabular-nums"
            aria-invalid={!!fieldError("minStock")}
          />
          {!fieldError("minStock") && (
            <FieldDescription>Bila stok ≤ angka ini, barang masuk daftar “perlu restock” di beranda.</FieldDescription>
          )}
          <FieldError>{fieldError("minStock")}</FieldError>
        </Field>

        {!product && (
          <FieldSet>
            <FieldLegend>Stok awal (opsional)</FieldLegend>
            <FieldDescription>
              Isi bila barang ini sudah ada di rak. Harga modal per satuan dipakai untuk menghitung laba sampai
              ada pembelian berikutnya. Kosongkan bila stok mulai dari nol.
            </FieldDescription>
            <div className="grid gap-6 sm:grid-cols-2">
              <Field data-invalid={!!fieldError("initialStock")}>
                <FieldLabel htmlFor="initialStock">Jumlah stok awal</FieldLabel>
                <Input
                  id="initialStock"
                  name="initialStock"
                  inputMode="numeric"
                  placeholder="0"
                  className="tabular-nums"
                  aria-invalid={!!fieldError("initialStock")}
                />
                <FieldError>{fieldError("initialStock")}</FieldError>
              </Field>
              <Field data-invalid={!!fieldError("initialCostPrice")}>
                <FieldLabel htmlFor="initialCostPrice">Harga modal per satuan</FieldLabel>
                <RupiahInput
                  id="initialCostPrice"
                  name="initialCostPrice"
                  placeholder="17.000"
                  aria-invalid={!!fieldError("initialCostPrice")}
                />
                <FieldError>{fieldError("initialCostPrice")}</FieldError>
              </Field>
            </div>
          </FieldSet>
        )}

        <Field orientation="horizontal">
          <Button type="submit" disabled={pending}>
            {pending && <LoaderCircleIcon className="animate-spin" />}
            {pending ? "Menyimpan..." : product ? "Simpan perubahan" : "Simpan barang"}
          </Button>
          <Button variant="outline" nativeButton={false} render={<Link href="/products" />}>
            {product ? "Kembali" : "Batal"}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  );
}
