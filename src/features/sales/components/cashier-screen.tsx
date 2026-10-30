// Layar kasir (BUSINESS-FLOW §5), dioptimalkan untuk HP:
//
//   [Cari barang]                         │ Keranjang
//   daftar barang (ketuk = tambah)        │ qty −/+ · harga (bisa diubah) · subtotal
//                                         │ Metode: Tunai / QRIS / Bon
//                                         │ Uang diterima + kembalian / pelanggan
//                                         │ [Simpan transaksi]
//
// Di layar sempit keranjang berada di bawah daftar barang, dengan bilah total
// melekat di bawah layar untuk melompat ke pembayaran.
//
// - Daftar barang TIDAK berisi harga modal (CashierProduct). Kasir boleh
//   mengubah harga per transaksi; batas "tidak di bawah harga modal" dicek
//   server dan pesannya tidak menyebut harga modal.
// - Stok minus diperbolehkan: kasir hanya melihat peringatan "Stok sistem".
// - Enter di kotak cari menambahkan hasil pertama (cepat dengan keyboard).
// - Setelah tersimpan, server me-revalidate halaman sehingga stok di daftar
//   ikut terbarui; keranjang dikosongkan untuk transaksi berikutnya.

"use client";

import {
  BanknoteIcon,
  CheckCircle2Icon,
  HandCoinsIcon,
  LoaderCircleIcon,
  MinusIcon,
  PencilIcon,
  PlusIcon,
  QrCodeIcon,
  SearchIcon,
  ShoppingCartIcon,
  Trash2Icon,
  TriangleAlertIcon,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState, useTransition } from "react";
import { RupiahInput } from "@/components/rupiah-input";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { CustomerPicker } from "@/features/credits/components/customer-picker";
import type { CustomerOption } from "@/features/credits/queries";
import { createSale, type SaleSaved } from "@/features/sales/actions";
import { MAX_SALE_ITEMS, PAYMENT_METHOD_LABELS, type PaymentMethod } from "@/features/sales/constants";
import type { CashierProduct } from "@/features/sales/queries";
import { formatRupiah } from "@/lib/format";
import { notify } from "@/lib/notify";
import { cn } from "@/lib/utils";

type CartLine = { productId: string; qty: number; sellingPrice: number };

// Berapa barang hasil pencarian yang ditampilkan sekaligus.
const RESULT_LIMIT = 60;

const METHOD_ICONS: Record<PaymentMethod, React.ReactNode> = {
  CASH: <BanknoteIcon />,
  QRIS: <QrCodeIcon />,
  CREDIT: <HandCoinsIcon />,
};

export function CashierScreen({
  products,
  customers: initialCustomers,
}: {
  products: CashierProduct[];
  customers: CustomerOption[];
}) {
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [cashReceived, setCashReceived] = useState<number | null>(null);
  // Mengganti key memasang ulang RupiahInput agar tombol nominal cepat bisa mengisinya.
  const [cashKey, setCashKey] = useState(0);
  const [customers, setCustomers] = useState(initialCustomers);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [saved, setSaved] = useState<SaleSaved | null>(null);
  const [pending, startTransition] = useTransition();

  const productById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);

  const results = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    const matches = words.length
      ? products.filter((product) => {
          const text = `${product.name} ${product.categoryName}`.toLowerCase();
          return words.every((word) => text.includes(word));
        })
      : products;
    return matches.slice(0, RESULT_LIMIT);
  }, [products, query]);

  // Barang yang dinonaktifkan pemilik saat keranjang terisi otomatis terbuang.
  const lines = cart.flatMap((line) => {
    const product = productById.get(line.productId);
    return product ? [{ ...line, product }] : [];
  });
  const total = lines.reduce((sum, line) => sum + line.qty * line.sellingPrice, 0);
  const itemCount = lines.reduce((sum, line) => sum + line.qty, 0);
  const change = cashReceived != null ? cashReceived - total : null;

  const errors = {
    cart: lines.length === 0 ? "Keranjang masih kosong" : undefined,
    cash: method === "CASH" && (cashReceived == null || cashReceived < total) ? "Uang diterima kurang dari total" : undefined,
    customer: method === "CREDIT" && !customerId ? "Pilih pelanggan untuk bon" : undefined,
  };

  function addProduct(product: CashierProduct) {
    setCart((current) => {
      const existing = current.find((line) => line.productId === product.id);
      if (existing) {
        return current.map((line) => (line.productId === product.id ? { ...line, qty: line.qty + 1 } : line));
      }
      if (current.length >= MAX_SALE_ITEMS) {
        notify.warning(`Maksimal ${MAX_SALE_ITEMS} barang per transaksi.`);
        return current;
      }
      return [...current, { productId: product.id, qty: 1, sellingPrice: product.sellingPrice }];
    });
  }

  function updateLine(productId: string, patch: Partial<CartLine>) {
    setCart((current) => current.map((line) => (line.productId === productId ? { ...line, ...patch } : line)));
  }

  function removeLine(productId: string) {
    setCart((current) => current.filter((line) => line.productId !== productId));
  }

  function setCash(value: number | null) {
    setCashReceived(value);
    setCashKey((key) => key + 1);
  }

  function handleSave() {
    if (errors.cart || errors.cash || errors.customer) {
      setShowErrors(true);
      return;
    }
    startTransition(async () => {
      const result = await createSale({
        paymentMethod: method,
        customerId: method === "CREDIT" ? customerId : null,
        cashReceived: method === "CASH" ? cashReceived : null,
        items: lines.map((line) => ({ productId: line.productId, qty: line.qty, sellingPrice: line.sellingPrice })),
      });
      if (!result.success) {
        notify.error(result.message);
        return;
      }
      setSaved(result.data);
      setCart([]);
      setMethod("CASH");
      setCash(null);
      setCustomerId(null);
      setShowErrors(false);
    });
  }

  function startNext() {
    setSaved(null);
    searchRef.current?.focus();
  }

  return (
    <div className="grid gap-4 pb-20 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start lg:pb-0">
      {/* Daftar barang */}
      <Card className="gap-3">
        <CardHeader>
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && results[0]) {
                  event.preventDefault();
                  addProduct(results[0]);
                  setQuery("");
                }
              }}
              placeholder="Cari barang (Enter = tambah hasil pertama)"
              autoComplete="off"
              autoFocus
              className="h-10 pl-8"
              aria-label="Cari barang"
            />
          </div>
        </CardHeader>
        <CardContent>
          {results.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {products.length ? "Barang tidak ditemukan." : "Belum ada barang aktif."}
            </p>
          ) : (
            <ul className="-mx-2 max-h-[55vh] overflow-y-auto lg:max-h-[calc(100vh-14rem)]">
              {results.map((product) => {
                const inCart = cart.find((line) => line.productId === product.id)?.qty;
                return (
                  <li key={product.id}>
                    <button
                      type="button"
                      onClick={() => addProduct(product)}
                      className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{product.name}</p>
                        <p
                          className={cn(
                            "text-xs text-muted-foreground",
                            product.stock <= 0 && "text-rose-700 dark:text-rose-300",
                          )}
                        >
                          {product.categoryName} · stok {product.stock.toLocaleString("id-ID")} {product.unit}
                        </p>
                      </div>
                      <span className="text-sm font-medium whitespace-nowrap tabular-nums">
                        {formatRupiah(product.sellingPrice)}
                      </span>
                      {inCart ? (
                        <span className="flex size-6 items-center justify-center rounded-full bg-brand text-xs font-semibold text-brand-foreground tabular-nums">
                          {inCart}
                        </span>
                      ) : (
                        <PlusIcon className="size-4 text-muted-foreground" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Keranjang & pembayaran */}
      <Card id="checkout" className="gap-4 lg:sticky lg:top-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCartIcon className="size-4" />
            Keranjang
            {itemCount > 0 && (
              <span className="text-sm font-normal text-muted-foreground">({itemCount.toLocaleString("id-ID")} item)</span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {lines.length === 0 ? (
            <p
              className={cn(
                "rounded-lg border border-dashed py-6 text-center text-sm text-muted-foreground",
                showErrors && errors.cart && "border-destructive text-destructive",
              )}
            >
              Ketuk barang di daftar untuk menambahkannya.
            </p>
          ) : (
            <ul className="flex flex-col divide-y">
              {lines.map((line) => (
                <CartRow
                  key={line.productId}
                  line={line}
                  onQty={(qty) => updateLine(line.productId, { qty })}
                  onPrice={(sellingPrice) => updateLine(line.productId, { sellingPrice })}
                  onRemove={() => removeLine(line.productId)}
                />
              ))}
            </ul>
          )}

          <div className="flex items-baseline justify-between border-t pt-3">
            <span className="text-sm text-muted-foreground">Total</span>
            <span className="font-mono text-2xl font-semibold tabular-nums">{formatRupiah(total)}</span>
          </div>

          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Metode bayar">
            {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((value) => (
              <Button
                key={value}
                type="button"
                role="radio"
                aria-checked={method === value}
                variant={method === value ? "brand" : "outline"}
                onClick={() => setMethod(value)}
              >
                {METHOD_ICONS[value]}
                {PAYMENT_METHOD_LABELS[value]}
              </Button>
            ))}
          </div>

          {method === "CASH" && (
            <Field data-invalid={showErrors && !!errors.cash}>
              <FieldLabel htmlFor="cash-received">Uang diterima</FieldLabel>
              <RupiahInput
                key={cashKey}
                id="cash-received"
                defaultValue={cashReceived}
                onValueChange={setCashReceived}
                placeholder="0"
                className="h-10 text-base"
                aria-invalid={showErrors && !!errors.cash}
              />
              <div className="flex flex-wrap gap-1.5">
                {cashSuggestions(total).map((amount, index) => (
                  <Button key={amount} type="button" size="sm" variant="outline" onClick={() => setCash(amount)}>
                    {index === 0 ? "Uang pas" : formatRupiah(amount)}
                  </Button>
                ))}
              </div>
              {showErrors && errors.cash ? (
                <FieldError>{errors.cash}</FieldError>
              ) : (
                change != null &&
                change >= 0 && (
                  <p className="flex items-baseline justify-between text-sm">
                    <span className="text-muted-foreground">Kembalian</span>
                    <span className="font-mono text-lg font-semibold text-emerald-700 tabular-nums dark:text-emerald-300">
                      {formatRupiah(change)}
                    </span>
                  </p>
                )
              )}
            </Field>
          )}

          {method === "QRIS" && (
            <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
              Pastikan pembayaran QRIS sebesar {formatRupiah(total)} sudah masuk sebelum menyimpan.
            </p>
          )}

          {method === "CREDIT" && (
            <Field data-invalid={showErrors && !!errors.customer}>
              <FieldLabel>Pelanggan</FieldLabel>
              <CustomerPicker
                customers={customers}
                value={customerId}
                onChange={setCustomerId}
                onCreated={(customer) =>
                  setCustomers((current) => [...current, customer].sort((a, b) => a.name.localeCompare(b.name)))
                }
                invalid={showErrors && !!errors.customer}
              />
              {showErrors && errors.customer ? (
                <FieldError>{errors.customer}</FieldError>
              ) : (
                <p className="text-sm text-muted-foreground">Dicatat sebagai piutang sampai dilunasi.</p>
              )}
            </Field>
          )}

          <Button size="lg" className="h-11 text-base" disabled={pending} onClick={handleSave}>
            {pending && <LoaderCircleIcon className="animate-spin" />}
            {pending ? "Menyimpan..." : "Simpan transaksi"}
          </Button>
        </CardContent>
      </Card>

      {/* Bilah total di HP: melompat ke keranjang & pembayaran. */}
      {lines.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-20 flex items-center justify-between gap-3 border-t bg-background/95 px-4 py-3 backdrop-blur lg:hidden">
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">{itemCount.toLocaleString("id-ID")} item</span>
            <span className="font-mono text-lg font-semibold tabular-nums">{formatRupiah(total)}</span>
          </div>
          <Button nativeButton={false} render={<a href="#checkout" />}>
            Bayar
          </Button>
        </div>
      )}

      <AlertDialog open={saved !== null} onOpenChange={(open) => !open && startNext()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <CheckCircle2Icon className="size-5 text-emerald-600" />
              Transaksi tersimpan
            </AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-mono">{saved?.number}</span> · total {formatRupiah(saved?.total ?? 0)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {saved?.change != null && (
            <div className="flex flex-col items-center gap-1 rounded-lg bg-emerald-50 py-4 dark:bg-emerald-950/40">
              <span className="text-sm text-muted-foreground">Kembalian</span>
              <span className="font-mono text-3xl font-semibold text-emerald-700 tabular-nums dark:text-emerald-300">
                {formatRupiah(saved.change)}
              </span>
            </div>
          )}
          <AlertDialogFooter>
            <Button variant="outline" nativeButton={false} render={<Link href={`/sales/${saved?.id ?? ""}`} />}>
              Lihat detail
            </Button>
            <Button autoFocus onClick={startNext}>
              Transaksi baru
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CartRow({
  line,
  onQty,
  onPrice,
  onRemove,
}: {
  line: CartLine & { product: CashierProduct };
  onQty: (qty: number) => void;
  onPrice: (price: number) => void;
  onRemove: () => void;
}) {
  const { product } = line;
  const [editingPrice, setEditingPrice] = useState(false);
  const priceChanged = line.sellingPrice !== product.sellingPrice;
  const overStock = line.qty > product.stock;

  return (
    <li className="flex flex-col gap-2 py-3 first:pt-0">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{product.name}</p>
          {editingPrice ? (
            <RupiahInput
              defaultValue={line.sellingPrice}
              onValueChange={(value) => value && onPrice(value)}
              onBlur={() => setEditingPrice(false)}
              onKeyDown={(event) => event.key === "Enter" && setEditingPrice(false)}
              autoFocus
              className="mt-1 h-8 w-36"
              aria-label={`Harga ${product.name}`}
            />
          ) : (
            <button
              type="button"
              onClick={() => setEditingPrice(true)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              @ {formatRupiah(line.sellingPrice)}
              {priceChanged && <span className="text-amber-700 dark:text-amber-300">(diubah)</span>}
              <PencilIcon className="size-3" />
            </button>
          )}
        </div>
        <span className="text-sm font-medium whitespace-nowrap tabular-nums">
          {formatRupiah(line.qty * line.sellingPrice)}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            onClick={() => onQty(Math.max(1, line.qty - 1))}
            disabled={line.qty <= 1}
            aria-label={`Kurangi ${product.name}`}
          >
            <MinusIcon />
          </Button>
          <Input
            inputMode="numeric"
            value={line.qty}
            onChange={(event) => onQty(Math.max(1, Number(event.target.value.replace(/\D/g, "").slice(0, 6)) || 1))}
            onFocus={(event) => event.target.select()}
            className="h-7 w-14 text-center tabular-nums"
            aria-label={`Jumlah ${product.name}`}
          />
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            onClick={() => onQty(line.qty + 1)}
            aria-label={`Tambah ${product.name}`}
          >
            <PlusIcon />
          </Button>
          <span className="ml-1 text-xs text-muted-foreground">{product.unit}</span>
        </div>
        <Button type="button" size="icon-sm" variant="ghost" onClick={onRemove} aria-label={`Hapus ${product.name}`}>
          <Trash2Icon />
        </Button>
      </div>
      {overStock && (
        <p className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-300">
          <TriangleAlertIcon className="size-3.5 shrink-0" />
          Stok sistem: {product.stock.toLocaleString("id-ID")} {product.unit}. Tetap bisa disimpan.
        </p>
      )}
    </li>
  );
}

// Tombol nominal cepat: uang pas, lalu pembulatan ke atas ke pecahan uang
// yang umum dibayarkan (5 rb, 10 rb, 50 rb, 100 rb). Maksimal 4 tombol.
function cashSuggestions(total: number) {
  if (total <= 0) return [];
  const roundUp = (step: number) => Math.ceil(total / step) * step;
  return [...new Set([total, roundUp(5_000), roundUp(10_000), roundUp(50_000), roundUp(100_000)])].slice(0, 4);
}
