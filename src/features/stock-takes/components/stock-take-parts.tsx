// Bagian kecil halaman stok opname: badge status, tombol "Mulai opname",
// tabel hasil opname yang sudah selesai, dan daftar opname.

"use client";

import { ClipboardListIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmButton } from "@/components/confirm-button";
import { ToneBadge } from "@/components/tone-badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { startStockTake } from "@/features/stock-takes/actions";
import { STOCK_TAKE_REASON_LABELS, STOCK_TAKE_STATUS_LABELS, type StockTakeStatus } from "@/features/stock-takes/constants";
import type { StockTakeItemDetail, StockTakeListItem } from "@/features/stock-takes/queries";
import { formatRupiah } from "@/lib/format";
import { notify } from "@/lib/notify";
import { cn } from "@/lib/utils";

export function StockTakeStatusBadge({ status }: { status: StockTakeStatus }) {
  return (
    <ToneBadge tone={status === "DRAFT" ? "active" : "success"}>{STOCK_TAKE_STATUS_LABELS[status]}</ToneBadge>
  );
}

export function StartStockTakeButton() {
  const router = useRouter();
  return (
    <ConfirmButton
      label="Mulai opname"
      variant="brand"
      icon={<ClipboardListIcon />}
      dialogTitle="Mulai stok opname?"
      dialogDescription="Daftar hitung dibuat untuk semua barang aktif. Sebaiknya dilakukan saat toko tutup; penjualan tetap boleh berjalan karena stok sistem diambil ulang saat opname diselesaikan."
      confirmLabel="Mulai"
      onConfirm={async () => {
        const result = await startStockTake();
        if (!result.success) notify.error(result.message);
        else router.push(`/stock-takes/${result.data.id}`);
      }}
    />
  );
}

export function StockTakesList({ stockTakes }: { stockTakes: StockTakeListItem[] }) {
  if (stockTakes.length === 0) {
    return (
      <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
        Belum pernah stok opname. Lakukan di akhir bulan untuk mencocokkan stok fisik dengan sistem.
      </p>
    );
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nomor</TableHead>
          <TableHead className="hidden sm:table-cell">Tanggal</TableHead>
          <TableHead className="text-right">Dihitung</TableHead>
          <TableHead className="text-right">Penyusutan</TableHead>
          <TableHead className="hidden sm:table-cell">Status</TableHead>
          <TableHead className="hidden md:table-cell">Oleh</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {stockTakes.map((stockTake) => (
          <TableRow key={stockTake.id} className="relative">
            <TableCell>
              <Link
                href={`/stock-takes/${stockTake.id}`}
                className="font-mono font-medium after:absolute after:inset-0 hover:underline"
              >
                {stockTake.number}
              </Link>
              <p className="text-xs text-muted-foreground sm:hidden">{stockTake.dateLabel}</p>
            </TableCell>
            <TableCell className="hidden whitespace-nowrap sm:table-cell">{stockTake.dateLabel}</TableCell>
            <TableCell className="text-right tabular-nums">
              {stockTake.countedCount} / {stockTake.itemCount}
            </TableCell>
            <TableCell className="text-right whitespace-nowrap tabular-nums">
              {stockTake.totalShrinkage == null ? "-" : formatRupiah(stockTake.totalShrinkage)}
            </TableCell>
            <TableCell className="hidden sm:table-cell">
              <StockTakeStatusBadge status={stockTake.status} />
            </TableCell>
            <TableCell className="hidden whitespace-nowrap text-muted-foreground md:table-cell">
              {stockTake.createdByName}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// Hasil opname selesai: bawaan hanya barang dengan selisih; bisa tampilkan semua.
export function StockTakeResultTable({ items }: { items: StockTakeItemDetail[] }) {
  const [showAll, setShowAll] = useState(false);
  const counted = items.filter((item) => item.physicalQty !== null);
  const visible = showAll ? counted : counted.filter((item) => item.difference !== 0);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={() => setShowAll((value) => !value)}>
          {showAll ? "Hanya yang selisih" : `Tampilkan semua yang dihitung (${counted.length})`}
        </Button>
      </div>
      {visible.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Semua barang yang dihitung cocok dengan sistem.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Barang</TableHead>
              <TableHead className="hidden text-right sm:table-cell">Sistem</TableHead>
              <TableHead className="hidden text-right sm:table-cell">Fisik</TableHead>
              <TableHead className="text-right">Selisih</TableHead>
              <TableHead className="hidden md:table-cell">Alasan</TableHead>
              <TableHead className="text-right">Susut</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((item) => (
              <TableRow key={item.productId}>
                <TableCell>
                  <Link href={`/products/${item.productId}`} className="font-medium hover:underline">
                    {item.productName}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {item.reason ? STOCK_TAKE_REASON_LABELS[item.reason] : item.categoryName}
                    {item.note && ` · ${item.note}`}
                  </p>
                </TableCell>
                <TableCell className="hidden text-right tabular-nums sm:table-cell">{item.systemQty}</TableCell>
                <TableCell className="hidden text-right tabular-nums sm:table-cell">{item.physicalQty}</TableCell>
                <TableCell
                  className={cn(
                    "text-right font-medium tabular-nums",
                    (item.difference ?? 0) < 0 && "text-rose-700 dark:text-rose-300",
                    (item.difference ?? 0) > 0 && "text-emerald-700 dark:text-emerald-300",
                  )}
                >
                  {(item.difference ?? 0) > 0 ? `+${item.difference}` : item.difference} {item.unit}
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  {item.reason ? STOCK_TAKE_REASON_LABELS[item.reason] : "-"}
                </TableCell>
                <TableCell className="text-right whitespace-nowrap tabular-nums">
                  {item.shrinkageValue ? formatRupiah(item.shrinkageValue) : "-"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
