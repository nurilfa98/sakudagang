// Halaman /products/[id]: data barang, stok & harga modal, riwayat mutasi, status.
// Hanya Pemilik (product:manage); Kasir melihat barang lewat daftar/kasir saja.

import { ArrowLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { ToneBadge } from "@/components/tone-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ProductForm } from "@/features/products/components/product-form";
import { ProductStatusActions } from "@/features/products/components/product-status-actions";
import { StockMovementsTable } from "@/features/products/components/stock-movements-table";
import { getProduct, listCategories, listStockMovements } from "@/features/products/queries";
import { parseStockMovementFilters } from "@/features/products/schemas";
import { isLowStock } from "@/features/products/service";
import { requireStore } from "@/lib/auth/dal";
import { can } from "@/lib/auth/permissions";
import { yearsSince } from "@/lib/filters";
import { formatRupiah } from "@/lib/format";

export const metadata: Metadata = {
  title: "Detail Barang",
};

export default function ProductDetailPage({ params, searchParams }: PageProps<"/products/[id]">) {
  return (
    <>
      <div>
        <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/products" />}>
          <ArrowLeftIcon />
          Daftar barang
        </Button>
      </div>
      <Suspense fallback={<ProductDetailSkeleton />}>
        {params.then(({ id }) => (
          <ProductDetailContent id={id} searchParams={searchParams} />
        ))}
      </Suspense>
    </>
  );
}

// Filter riwayat mutasi (?type=&year=&month=) dibaca dari searchParams.
async function ProductDetailContent({
  id,
  searchParams,
}: { id: string } & Pick<PageProps<"/products/[id]">, "searchParams">) {
  const actor = await requireStore("product:manage");
  const withCost = can(actor, "product:view-cost");
  const product = await getProduct(actor.storeId, id, { withCost });
  // Barang toko lain = "tidak ditemukan".
  if (!product) notFound();

  const filters = parseStockMovementFilters(await searchParams);
  const [categories, movements] = await Promise.all([
    listCategories(actor.storeId),
    listStockMovements(actor.storeId, product.id, { withCost, ...filters }),
  ]);
  // Pilihan tahun: sejak barang dibuat sampai tahun ini.
  const years = yearsSince(product.createdAt.getFullYear());
  const low = isLowStock(product.stock, product.minStock);
  const margin = product.costPrice == null ? null : product.sellingPrice - product.costPrice;

  return (
    <>
      <PageHeader
        title={product.name}
        description={`${product.categoryName} · ${product.unit}`}
        action={
          product.isActive ? (
            <ToneBadge tone="success">Aktif</ToneBadge>
          ) : (
            <ToneBadge tone="pending" className="text-slate-900 dark:text-slate-100">
              Nonaktif
            </ToneBadge>
          )
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat
          label="Stok saat ini"
          value={`${product.stock.toLocaleString("id-ID")} ${product.unit}`}
          hint={
            product.stock < 0
              ? "Stok minus: luruskan lewat pembelian atau stok opname."
              : low
                ? `Di bawah stok minimum (${product.minStock}).`
                : product.minStock != null
                  ? `Stok minimum ${product.minStock}.`
                  : "Stok minimum tidak dipantau."
          }
          tone={product.stock < 0 ? "danger" : low ? "warning" : undefined}
        />
        <Stat
          label="Harga modal (rata-rata)"
          value={product.costPrice == null ? "-" : formatRupiah(product.costPrice)}
          hint="Berubah otomatis saat ada pembelian."
        />
        <Stat
          label="Laba kotor per satuan"
          value={margin == null ? "-" : formatRupiah(margin)}
          hint={`Harga jual ${formatRupiah(product.sellingPrice)}`}
          tone={margin != null && margin < 0 ? "danger" : undefined}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Data barang</CardTitle>
          <CardDescription>Nama, kategori, satuan, harga jual, dan stok minimum.</CardDescription>
        </CardHeader>
        <CardContent>
          <ProductForm categories={categories} product={product} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Riwayat mutasi stok</CardTitle>
          <CardDescription>Stok awal, pembelian, penjualan, dan opname; terbaru di atas.</CardDescription>
        </CardHeader>
        <CardContent>
          <StockMovementsTable movements={movements} unit={product.unit} withCost={withCost} filters={filters} years={years} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Status</CardTitle>
          <CardDescription>Barang yang tidak dijual lagi cukup dinonaktifkan.</CardDescription>
        </CardHeader>
        <CardContent>
          <ProductStatusActions product={product} />
        </CardContent>
      </Card>
    </>
  );
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint: string; tone?: "danger" | "warning" }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        <span
          className={
            tone === "danger"
              ? "font-mono text-2xl font-semibold text-rose-700 tabular-nums dark:text-rose-300"
              : tone === "warning"
                ? "font-mono text-2xl font-semibold text-amber-700 tabular-nums dark:text-amber-300"
                : "font-mono text-2xl font-semibold tabular-nums"
          }
        >
          {value}
        </span>
        <CardDescription>{hint}</CardDescription>
      </CardContent>
    </Card>
  );
}

function ProductDetailSkeleton() {
  return (
    <>
      <Skeleton className="h-12 w-64" />
      <div className="grid gap-4 sm:grid-cols-3">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
      <Skeleton className="h-96 w-full" />
    </>
  );
}
