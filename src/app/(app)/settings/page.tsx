// Halaman /settings (Superadmin): pengaturan platform SakuDagang.
// - Harga paket standar (1 / 6 / 12 bulan).
// - Pembayaran & kontak: WhatsApp admin, rekening, gambar QRIS statis.
// - Masa gratis & tenggang.
// - Harga khusus per toko (hasil negosiasi), dengan tautan ke form per toko.

import { PencilIcon, PlusIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BankAccountsManager } from "@/features/settings/components/bank-accounts-manager";
import { PlatformSettingsForm } from "@/features/settings/components/platform-settings-form";
import { QrisImageForm } from "@/features/settings/components/qris-image-form";
import { listBankAccounts } from "@/features/settings/queries";
import { PlanPricesForm } from "@/features/subscriptions/components/plan-prices-form";
import { listPlans, listStorePriceOverrides } from "@/features/subscriptions/queries";
import { requirePermission } from "@/lib/auth/dal";
import { formatRupiah } from "@/lib/format";
import { getPlatformSettings } from "@/lib/platform-settings";

export const metadata: Metadata = {
  title: "Pengaturan",
};

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Pengaturan" description="Harga langganan, cara pembayaran, dan kontak admin SakuDagang." />
      <Suspense fallback={<SettingsSkeleton />}>
        <SettingsContent />
      </Suspense>
    </>
  );
}

async function SettingsContent() {
  await requirePermission("settings:manage");
  const [plans, settings, overrides, bankAccounts] = await Promise.all([
    listPlans(),
    getPlatformSettings(),
    listStorePriceOverrides(),
    listBankAccounts(),
  ]);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Harga paket standar</CardTitle>
          <CardDescription>Berlaku untuk semua toko yang tidak punya harga khusus.</CardDescription>
        </CardHeader>
        <CardContent>
          <PlanPricesForm plans={plans} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pembayaran & kontak</CardTitle>
          <CardDescription>Ditampilkan di halaman Langganan toko saat ada tagihan.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-8">
          <PlatformSettingsForm settings={settings} />
          <div className="flex flex-col gap-2 border-t pt-6">
            <p className="text-sm font-medium">Rekening bank tujuan transfer</p>
            <p className="text-sm text-muted-foreground">
              Boleh lebih dari satu atau dikosongkan. Semua rekening ditampilkan berjajar ke pemilik toko saat memilih paket.
            </p>
            <BankAccountsManager accounts={bankAccounts} />
          </div>
          <div className="flex flex-col gap-2 border-t pt-6">
            <p className="text-sm font-medium">QRIS statis</p>
            <QrisImageForm imageKey={settings.qrisImageKey} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-col gap-1.5">
              <CardTitle>Harga khusus per toko</CardTitle>
              <CardDescription>Hasil negosiasi; menggantikan harga standar untuk toko itu.</CardDescription>
            </div>
            <Button variant="outline" nativeButton={false} render={<Link href="/stores" />}>
              <PlusIcon />
              Pilih toko
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {overrides.length === 0 ? (
            <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              Belum ada toko dengan harga khusus. Buka detail toko, lalu &ldquo;Atur harga khusus&rdquo;.
            </p>
          ) : (
            <div className="rounded-lg border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Toko</TableHead>
                    <TableHead className="text-right">1 bulan</TableHead>
                    <TableHead className="text-right">6 bulan</TableHead>
                    <TableHead className="text-right">1 tahun</TableHead>
                    <TableHead className="hidden md:table-cell">Catatan</TableHead>
                    <TableHead className="w-10">
                      <span className="sr-only">Ubah</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overrides.map((row) => (
                    <TableRow key={row.storeId} className="relative">
                      <TableCell>
                        <Link
                          href={`/settings/stores/${row.storeId}`}
                          className="font-medium after:absolute after:inset-0 hover:underline"
                        >
                          {row.storeName}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{row.price1 == null ? "-" : formatRupiah(row.price1)}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.price6 == null ? "-" : formatRupiah(row.price6)}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.price12 == null ? "-" : formatRupiah(row.price12)}</TableCell>
                      <TableCell className="hidden max-w-64 truncate md:table-cell">{row.note ?? "-"}</TableCell>
                      <TableCell>
                        <PencilIcon className="size-4 text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function SettingsSkeleton() {
  return (
    <>
      <Skeleton className="h-48 w-full" />
      <Skeleton className="h-96 w-full" />
      <Skeleton className="h-48 w-full" />
    </>
  );
}
