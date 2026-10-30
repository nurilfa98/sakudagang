// Lembar hitung stok opname (DRAFT). Pemilik mengisi stok fisik per barang,
// bisa bertahap ("Simpan draf"), lalu "Selesaikan opname".
//
// - "Stok sistem" = stok terkini (bukan saat draf dibuat); server mengambil
//   ulang angka ini saat menyelesaikan, jadi selisih di layar = selisih final
//   bila tidak ada penjualan di antaranya.
// - Selisih ≠ 0 wajib diberi alasan; alasan & catatan muncul hanya saat ada selisih.
// - Hanya baris yang berubah yang dikirim ke server. Meninggalkan halaman
//   dengan perubahan belum tersimpan memunculkan peringatan browser.

"use client";

import { CheckCheckIcon, LoaderCircleIcon, SaveIcon, SearchIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { ConfirmButton } from "@/components/confirm-button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { completeStockTake, deleteStockTakeDraft, saveStockTakeCounts } from "@/features/stock-takes/actions";
import { STOCK_TAKE_REASON_LABELS, STOCK_TAKE_REASONS, type StockTakeReason } from "@/features/stock-takes/constants";
import type { StockTakeItemDetail } from "@/features/stock-takes/queries";
import type { StockTakeCountInput } from "@/features/stock-takes/schemas";
import { shrinkageValue, stockTakeDifference } from "@/features/stock-takes/service";
import { formatRupiah } from "@/lib/format";
import { notify } from "@/lib/notify";
import { cn } from "@/lib/utils";

type Count = { physical: string; reason: StockTakeReason | null; note: string };

type View = "ALL" | "UNCOUNTED" | "DIFFERENT";

const VIEW_LABELS: Record<View, string> = {
  ALL: "Semua barang",
  UNCOUNTED: "Belum dihitung",
  DIFFERENT: "Ada selisih",
};

const REASON_ITEMS = STOCK_TAKE_REASONS.map((value) => ({ value, label: STOCK_TAKE_REASON_LABELS[value] }));

export function StockTakeSheet({
  stockTakeId,
  number,
  items,
}: {
  stockTakeId: string;
  number: string;
  items: StockTakeItemDetail[];
}) {
  const router = useRouter();
  const [counts, setCounts] = useState<Record<string, Count>>(() =>
    Object.fromEntries(
      items.map((item) => [
        item.productId,
        { physical: item.physicalQty?.toString() ?? "", reason: item.reason, note: item.note ?? "" },
      ]),
    ),
  );
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [view, setView] = useState<View>("ALL");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, startSaving] = useTransition();
  const [completing, startCompleting] = useTransition();

  // Peringatan browser bila meninggalkan halaman dengan hitungan belum tersimpan.
  useEffect(() => {
    if (dirty.size === 0) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const rows = useMemo(
    () =>
      items.map((item) => {
        const count = counts[item.productId];
        const physical = count.physical === "" ? null : Number(count.physical);
        const difference = physical === null ? null : stockTakeDifference(physical, item.systemQty);
        return { ...item, count, physical, difference };
      }),
    [items, counts],
  );

  const counted = rows.filter((row) => row.physical !== null);
  const different = counted.filter((row) => row.difference !== 0);
  const missingReason = different.filter((row) => !row.count.reason);
  const estimatedShrinkage = different.reduce((sum, row) => sum + shrinkageValue(row.difference!, row.costPrice), 0);

  const visible = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    return rows.filter((row) => {
      if (view === "UNCOUNTED" && row.physical !== null) return false;
      if (view === "DIFFERENT" && (row.difference === null || row.difference === 0)) return false;
      const text = `${row.productName} ${row.categoryName}`.toLowerCase();
      return words.every((word) => text.includes(word));
    });
  }, [rows, query, view]);

  function update(productId: string, patch: Partial<Count>) {
    setCounts((current) => ({ ...current, [productId]: { ...current[productId], ...patch } }));
    setDirty((current) => new Set(current).add(productId));
  }

  function changedItems(): StockTakeCountInput[] {
    return [...dirty].map((productId) => {
      const count = counts[productId];
      return {
        productId,
        physicalQty: count.physical === "" ? null : Number(count.physical),
        reason: count.reason,
        note: count.note || null,
      };
    });
  }

  function handleSave() {
    startSaving(async () => {
      const result = await saveStockTakeCounts(stockTakeId, changedItems());
      if (!result.success) notify.error(result.message);
      else {
        setDirty(new Set());
        notify.success("Draf opname tersimpan.");
      }
    });
  }

  function handleComplete() {
    startCompleting(async () => {
      const result = await completeStockTake(stockTakeId, changedItems());
      if (!result.success) {
        notify.error(result.message);
        return;
      }
      setDirty(new Set());
      setConfirmOpen(false);
      notify.success(
        `${number} selesai. ${result.data.adjusted} barang disesuaikan, penyusutan ${formatRupiah(result.data.totalShrinkage)}.`,
      );
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cari barang atau kategori"
            className="pl-8"
            aria-label="Cari barang"
          />
        </div>
        <div className="flex gap-1" role="radiogroup" aria-label="Tampilkan">
          {(Object.keys(VIEW_LABELS) as View[]).map((value) => (
            <Button
              key={value}
              size="sm"
              role="radio"
              aria-checked={view === value}
              variant={view === value ? "brand" : "outline"}
              onClick={() => setView(value)}
              className="h-8"
            >
              {VIEW_LABELS[value]}
            </Button>
          ))}
        </div>
      </div>

      <ul className="flex flex-col divide-y rounded-xl border bg-card">
        {visible.length === 0 && (
          <li className="p-6 text-center text-sm text-muted-foreground">Tidak ada barang pada tampilan ini.</li>
        )}
        {visible.map((row) => (
          <li key={row.productId} className="flex flex-col gap-2 p-3">
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{row.productName}</p>
                <p className="text-xs text-muted-foreground">
                  {row.categoryName} · sistem{" "}
                  <span className={cn("tabular-nums", row.systemQty < 0 && "text-rose-700 dark:text-rose-300")}>
                    {row.systemQty.toLocaleString("id-ID")}
                  </span>{" "}
                  {row.unit}
                </p>
              </div>
              <Input
                inputMode="numeric"
                value={row.count.physical}
                onChange={(event) => update(row.productId, { physical: event.target.value.replace(/\D/g, "").slice(0, 9) })}
                onFocus={(event) => event.target.select()}
                placeholder="Fisik"
                className="h-9 w-20 text-right tabular-nums"
                aria-label={`Stok fisik ${row.productName}`}
              />
              <span
                className={cn(
                  "w-14 text-right text-sm font-medium tabular-nums",
                  row.difference === null && "text-muted-foreground",
                  row.difference !== null && row.difference < 0 && "text-rose-700 dark:text-rose-300",
                  row.difference !== null && row.difference > 0 && "text-emerald-700 dark:text-emerald-300",
                )}
              >
                {row.difference === null ? "–" : row.difference > 0 ? `+${row.difference}` : row.difference}
              </span>
            </div>
            {row.difference !== null && row.difference !== 0 && (
              <div className="grid gap-2 sm:grid-cols-[200px_1fr]">
                <Select
                  value={row.count.reason}
                  onValueChange={(reason) => update(row.productId, { reason: reason as StockTakeReason })}
                  items={REASON_ITEMS}
                >
                  <SelectTrigger
                    className="w-full"
                    aria-label={`Alasan selisih ${row.productName}`}
                    aria-invalid={!row.count.reason}
                  >
                    <SelectValue placeholder="Pilih alasan selisih" />
                  </SelectTrigger>
                  <SelectContent>
                    {REASON_ITEMS.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  value={row.count.note}
                  onChange={(event) => update(row.productId, { note: event.target.value })}
                  placeholder="Catatan (opsional)"
                  maxLength={255}
                  aria-label={`Catatan ${row.productName}`}
                />
              </div>
            )}
          </li>
        ))}
      </ul>

      <div className="flex justify-start">
        <ConfirmButton
          label="Hapus draf opname"
          variant="ghost"
          icon={<Trash2Icon />}
          dialogTitle={`Hapus ${number}?`}
          dialogDescription="Semua hitungan di draf ini hilang. Stok barang tidak berubah karena opname belum diselesaikan."
          confirmLabel="Hapus draf"
          onConfirm={async () => {
            const result = await deleteStockTakeDraft(stockTakeId);
            if (!result.success) notify.error(result.message);
            else {
              setDirty(new Set());
              notify.success("Draf opname dihapus.");
              router.push("/stock-takes");
            }
          }}
        />
      </div>

      {/* Ringkasan & tombol, melekat di bawah layar. */}
      <div className="sticky bottom-0 z-20 -mx-4 border-t bg-background/95 px-4 py-3 backdrop-blur">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Dihitung <span className="font-medium text-foreground tabular-nums">{counted.length}</span> dari{" "}
            {rows.length} · selisih <span className="font-medium text-foreground tabular-nums">{different.length}</span> ·
            perkiraan susut{" "}
            <span className="font-medium text-rose-700 tabular-nums dark:text-rose-300">
              {formatRupiah(estimatedShrinkage)}
            </span>
            {dirty.size > 0 && <span className="text-amber-700 dark:text-amber-300"> · belum disimpan</span>}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" disabled={saving || dirty.size === 0} onClick={handleSave}>
              {saving ? <LoaderCircleIcon className="animate-spin" /> : <SaveIcon />}
              Simpan draf
            </Button>
            <Button disabled={counted.length === 0} onClick={() => setConfirmOpen(true)}>
              <CheckCheckIcon />
              Selesaikan
            </Button>
          </div>
        </div>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={(open) => !completing && setConfirmOpen(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Selesaikan {number}?</AlertDialogTitle>
            <AlertDialogDescription>
              {missingReason.length > 0
                ? `${missingReason.length} barang dengan selisih belum diberi alasan. Pilih alasannya dulu (tampilan "Ada selisih").`
                : `Stok ${different.length} barang akan disesuaikan dengan hitungan fisik dan penyusutan sekitar ${formatRupiah(estimatedShrinkage)} dicatat hari ini. ${rows.length - counted.length} barang yang belum dihitung tidak berubah. Opname yang selesai tidak bisa diubah.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={completing}>Kembali</AlertDialogCancel>
            {missingReason.length > 0 ? (
              <Button
                onClick={() => {
                  setView("DIFFERENT");
                  setConfirmOpen(false);
                }}
              >
                Tampilkan barang
              </Button>
            ) : (
              <Button disabled={completing} onClick={handleComplete}>
                {completing && <LoaderCircleIcon className="animate-spin" />}
                Selesaikan opname
              </Button>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
