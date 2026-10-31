// Halaman /settings (Superadmin): pengaturan platform SakuDagang, susunan
// sama dengan ArchiPay:
// - Harga paket: harga per bulan + diskon 6 bulan & 1 tahun (dihitung otomatis).
// - Masa gratis & tenggang + WhatsApp admin.
// - Rekening pembayaran.
// - QRIS statis.
// Harga khusus per toko (hasil negosiasi) diatur di detail toko → Langganan.
// Berpindah dengan Toko & Tagihan lewat tab di app/(app)/(platform)/layout.tsx.

import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BankAccountsManager } from "@/features/settings/components/bank-accounts-manager";
import { PlatformSettingsForm } from "@/features/settings/components/platform-settings-form";
import { QrisImageForm } from "@/features/settings/components/qris-image-form";
import { listBankAccounts } from "@/features/settings/queries";
import { PlanPricesForm } from "@/features/subscriptions/components/plan-prices-form";
import { listPlans } from "@/features/subscriptions/queries";
import { requirePermission } from "@/lib/auth/dal";
import { getPlatformSettings } from "@/lib/platform-settings";

export const metadata: Metadata = {
  title: "Pengaturan platform",
};

export default function SettingsPage() {
  return (
    <>
      <PageHeader
        title="Pengaturan platform"
        description="Harga langganan, cara pembayaran, dan kontak admin SakuDagang. Berlaku untuk semua toko."
      />
      <Suspense fallback={<SettingsSkeleton />}>
        <SettingsContent />
      </Suspense>
    </>
  );
}

async function SettingsContent() {
  await requirePermission("settings:manage");
  const [plans, settings, bankAccounts] = await Promise.all([
    listPlans(),
    getPlatformSettings(),
    listBankAccounts(),
  ]);

  // Harga per bulan = harga paket 1 bulan; diskon tersimpan di platform_settings.
  const pricing = {
    monthlyPrice: plans.find((plan) => plan.months === 1)?.price ?? 0,
    discount6: settings.discount6,
    discount12: settings.discount12,
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Harga paket</CardTitle>
          <CardDescription>
            Harga sama untuk setiap toko, berapa pun jumlah penggunanya. Paket 6 bulan & 1 tahun dihitung otomatis dari
            harga per bulan dikurangi diskon. Pemilik melihat &quot;setara per bulan&quot; dan &quot;hemat %&quot;.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PlanPricesForm pricing={pricing} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Masa gratis & tenggang</CardTitle>
          <CardDescription>
            Lewat masa tenggang, toko terkunci: Pemilik hanya bisa membuka menu Langganan, Kasir tidak bisa login.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PlatformSettingsForm settings={settings} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Rekening pembayaran</CardTitle>
          <CardDescription>Tampil ke Pemilik saat memilih paket. Boleh lebih dari satu.</CardDescription>
        </CardHeader>
        <CardContent>
          <BankAccountsManager accounts={bankAccounts} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>QRIS</CardTitle>
          <CardDescription>Opsional. Pemilik memindai lalu mengetik nominal sendiri.</CardDescription>
        </CardHeader>
        <CardContent>
          <QrisImageForm imageKey={settings.qrisImageKey} />
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
