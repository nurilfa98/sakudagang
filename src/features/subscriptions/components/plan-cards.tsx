// Kartu pilihan paket (1 / 6 / 12 bulan) di halaman Langganan.
// Client Component: tombol "Pilih paket" memakai useActionState agar pesan
// error (harga belum diatur, masih ada tagihan) tampil sebagai notifikasi.
//
// Harga yang tampil sudah harga toko ini (harga khusus bila ada,
// features/subscriptions/queries.ts listPlansForStore).

"use client";

import { CheckIcon, LoaderCircleIcon } from "lucide-react";
import { startTransition, useActionState, useEffect } from "react";
import { ToneBadge } from "@/components/tone-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { requestSubscription } from "@/features/subscriptions/actions";
import { PLAN_LABELS } from "@/features/subscriptions/constants";
import type { PlanPrice } from "@/features/subscriptions/queries";
import { monthlyEquivalent, savingsPercent } from "@/features/subscriptions/service";
import { formatRupiah } from "@/lib/format";
import { notify } from "@/lib/notify";
import { cn } from "@/lib/utils";

export function PlanCards({ plans, canChoose }: { plans: PlanPrice[]; canChoose: boolean }) {
  const [state, formAction, pending] = useActionState(requestSubscription, undefined);
  const monthly = plans.find((plan) => plan.months === 1)?.price ?? 0;

  useEffect(() => {
    if (state?.success) notify.success("Tagihan dibuat. Silakan lakukan pembayaran.");
    else if (state) notify.error(state.message);
  }, [state]);

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
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    const formData = new FormData(event.currentTarget);
                    startTransition(() => formAction(formData));
                  }}
                  className="w-full"
                >
                  <input type="hidden" name="months" value={plan.months} />
                  <Button type="submit" className="w-full" variant={recommended ? "brand" : "outline"} disabled={unset || pending}>
                    {pending ? <LoaderCircleIcon className="animate-spin" /> : <CheckIcon />}
                    Pilih paket
                  </Button>
                </form>
              </CardFooter>
            )}
          </Card>
        );
      })}
    </div>
  );
}
