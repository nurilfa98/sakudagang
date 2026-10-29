// Pilihan paket (1 / 6 / 12 bulan) di halaman Langganan, BUSINESS-FLOW §14.2.
//
// Memilih paket TIDAK menyimpan apa pun: hanya keadaan di layar. Setelah
// dipilih, tampil panel pembayaran (nominal, rekening/QRIS, form "Saya sudah
// bayar"). Tagihan baru tercatat saat pemilik mengirim bukti. Pindah menu atau
// "Ganti paket" cukup kembali ke pilihan paket, tanpa data sampah.
//
// Harga yang tampil sudah harga toko ini (harga khusus bila ada,
// features/subscriptions/queries.ts listPlansForStore); harga yang disimpan
// dihitung ulang di server saat klaim, bukan dari browser.

"use client";

import { ArrowLeftIcon, CheckIcon, MessageCircleIcon } from "lucide-react";
import { useState } from "react";
import { ToneBadge } from "@/components/tone-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { PLAN_LABELS, type PlanMonths } from "@/features/subscriptions/constants";
import type { PlanPrice } from "@/features/subscriptions/queries";
import { monthlyEquivalent, savingsPercent, whatsAppLink } from "@/features/subscriptions/service";
import { PRODUCT_NAME } from "@/lib/brand";
import { formatRupiah } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { cn } from "@/lib/utils";
import { ClaimPaymentForm } from "./claim-payment-form";
import { PaymentInstructions, type PaymentInfo } from "./payment-instructions";

export function PlanCards({
  plans,
  canChoose,
  payment,
  storeName,
}: {
  plans: PlanPrice[];
  canChoose: boolean;
  payment: PaymentInfo;
  storeName: string;
}) {
  const [selected, setSelected] = useState<PlanMonths | null>(null);
  const monthly = plans.find((plan) => plan.months === 1)?.price ?? 0;
  const chosen = selected == null ? null : plans.find((plan) => plan.months === selected);

  if (chosen) {
    const message = `Halo admin ${PRODUCT_NAME}, saya ingin membayar langganan ${PLAN_LABELS[chosen.months]} sebesar ${formatRupiah(chosen.price)} untuk toko ${storeName}.`;
    return (
      <Card className="border-brand">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>Pembayaran paket {PLAN_LABELS[chosen.months]}</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
              <ArrowLeftIcon />
              Ganti paket
            </Button>
          </div>
          <CardDescription>
            Bayar lewat salah satu cara di bawah, lalu tekan &ldquo;Saya sudah bayar&rdquo; dan lampirkan buktinya.
            Belum ada yang tersimpan sampai bukti dikirim.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Jumlah yang dibayar</p>
            <p className="font-mono text-3xl font-semibold tabular-nums">{formatRupiah(chosen.price)}</p>
          </div>
          <PaymentInstructions payment={payment} />
          <ClaimPaymentForm months={chosen.months} />
          {payment.adminPhone && (
            <div>
              <Button
                variant="outline"
                nativeButton={false}
                render={<a href={whatsAppLink(payment.adminPhone, message)} target="_blank" rel="noreferrer" />}
              >
                <MessageCircleIcon />
                Hubungi admin via WhatsApp ({formatPhone(payment.adminPhone)})
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {plans.map((plan) => {
        const saving = savingsPercent(plan.price, plan.months, monthly);
        const unset = plan.price <= 0;
        const recommended = plan.months === 12 && !unset;
        return (
          <Card key={plan.months} className={cn(recommended && "border-brand")}>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle>{PLAN_LABELS[plan.months]}</CardTitle>
                {saving != null && <ToneBadge tone="success">Hemat {saving}%</ToneBadge>}
                {plan.custom && <ToneBadge tone="active">Harga khusus</ToneBadge>}
              </div>
              <CardDescription>
                {unset
                  ? "Harga belum diatur. Hubungi admin SakuDagang."
                  : plan.months === 1
                    ? "Bayar tiap bulan, fleksibel."
                    : `Setara ${formatRupiah(monthlyEquivalent(plan.price, plan.months))} per bulan.`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <span className="font-mono text-2xl font-semibold tabular-nums">{unset ? "-" : formatRupiah(plan.price)}</span>
              {plan.custom && plan.standardPrice > 0 && plan.standardPrice !== plan.price && (
                <p className="text-xs text-muted-foreground">
                  Harga standar <span className="line-through">{formatRupiah(plan.standardPrice)}</span>
                </p>
              )}
            </CardContent>
            {canChoose && (
              <CardFooter>
                <Button
                  className="w-full"
                  variant={recommended ? "brand" : "outline"}
                  disabled={unset}
                  onClick={() => setSelected(plan.months)}
                >
                  <CheckIcon />
                  Pilih paket
                </Button>
              </CardFooter>
            )}
          </Card>
        );
      })}
    </div>
  );
}
