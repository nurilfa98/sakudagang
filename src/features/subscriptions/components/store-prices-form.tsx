// Form harga khusus satu toko (hasil negosiasi), Superadmin. Pola sama dengan
// harga paket standar (plan-prices-form.tsx): isi harga per bulan + diskon
// 6 bulan & 1 tahun, harga tiap paket dihitung otomatis (pricing.ts) dan
// ditampilkan berdampingan dengan harga standar.
//
// Periode yang hasilnya sama dengan harga standar tidak disimpan sebagai harga
// khusus (lihat saveStorePlanPrices), jadi "Pakai harga standar" + Simpan
// = toko kembali memakai harga standar.

"use client";

import { LoaderCircleIcon, RotateCcwIcon } from "lucide-react";
import Link from "next/link";
import { startTransition, useActionState, useState, type FormEvent } from "react";
import { useActionResult } from "@/hooks/use-action-result";
import { RupiahInput } from "@/components/rupiah-input";
import { TextField } from "@/components/text-field";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { saveStorePlanPrices } from "@/features/subscriptions/actions";
import { PLAN_LABELS, PLAN_MONTHS, type PlanMonths } from "@/features/subscriptions/constants";
import type { PlanPrice } from "@/features/subscriptions/queries";
import { formatRupiah } from "@/lib/format";
import { notify } from "@/lib/notify";
import { discountFromPrice, discountOf, planPrice, type Pricing } from "../pricing";
import { PercentField } from "./plan-prices-form";

type Props = {
  storeId: string;
  plans: PlanPrice[]; // harga yang berlaku untuk toko ini (khusus bila ada) + harga standar
  standard: Pricing; // harga paket standar dari Pengaturan platform
  cancelHref?: string; // opsional: di detail toko form tampil di dalam halaman, tanpa tombol kembali
};

// Isian awal: harga standar bila toko belum punya harga khusus; selain itu
// harga per bulan toko ini + diskon yang menghasilkan harga 6 bulan & 1 tahun
// yang sedang berlaku.
function initialPricing(plans: PlanPrice[], standard: Pricing): Pricing {
  const priceOf = (months: PlanMonths) => plans.find((plan) => plan.months === months)?.price ?? 0;
  const monthlyPrice = priceOf(1);
  if (!plans.some((plan) => plan.custom) || monthlyPrice <= 0) return standard;
  return {
    monthlyPrice,
    discount6: discountFromPrice(monthlyPrice, priceOf(6), 6),
    discount12: discountFromPrice(monthlyPrice, priceOf(12), 12),
  };
}

export function StorePricesForm({ storeId, plans, standard, cancelHref }: Props) {
  const [state, formAction, pending] = useActionState(saveStorePlanPrices, undefined);
  const [values, setValues] = useState(() => initialPricing(plans, standard));
  // Dinaikkan saat "Pakai harga standar" agar isian (uncontrolled) dipasang ulang dengan nilai standar.
  const [resetKey, setResetKey] = useState(0);
  const error = state && !state.success ? state : undefined;
  const fieldError = (name: string) => error?.fieldErrors?.[name]?.[0];
  const set = (key: keyof Pricing) => (value: number) => setValues((current) => ({ ...current, [key]: value }));
  const note = plans.find((plan) => plan.note)?.note ?? "";

  useActionResult(state, (result) => {
    if (result.success) notify.success("Harga khusus disimpan.");
    else if (!result.fieldErrors) notify.error(result.message);
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  function resetToStandard() {
    setValues(standard);
    setResetKey((key) => key + 1);
  }

  return (
    <form onSubmit={handleSubmit}>
      <input type="hidden" name="storeId" value={storeId} />
      <FieldGroup>
        <div key={resetKey} className="grid gap-5 sm:grid-cols-3">
          <Field data-invalid={!!fieldError("monthlyPrice")}>
            <FieldLabel htmlFor="monthlyPrice">Harga per bulan</FieldLabel>
            <RupiahInput
              id="monthlyPrice"
              name="monthlyPrice"
              defaultValue={values.monthlyPrice > 0 ? values.monthlyPrice : null}
              onValueChange={(value) => set("monthlyPrice")(value ?? 0)}
              aria-invalid={!!fieldError("monthlyPrice")}
              required
            />
            <FieldDescription>
              Standar: {standard.monthlyPrice > 0 ? formatRupiah(standard.monthlyPrice) : "belum diatur"}
            </FieldDescription>
            <FieldError>{fieldError("monthlyPrice")}</FieldError>
          </Field>
          <PercentField
            name="discount6"
            label="Diskon paket 6 bulan"
            defaultValue={values.discount6}
            onValueChange={set("discount6")}
            error={fieldError("discount6")}
            description={`Standar: ${standard.discount6}%`}
          />
          <PercentField
            name="discount12"
            label="Diskon paket 1 tahun"
            defaultValue={values.discount12}
            onValueChange={set("discount12")}
            error={fieldError("discount12")}
            description={`Standar: ${standard.discount12}%`}
          />
        </div>

        <PricingComparison custom={values} plans={plans} />

        <TextField
          name="note"
          label="Catatan"
          defaultValue={note}
          placeholder="Negosiasi 12 Nov 2026, kunjungan ke toko"
          autoComplete="off"
          error={fieldError("note")}
        />
        <Field orientation="horizontal" className="flex-wrap">
          <Button type="submit" disabled={pending}>
            {pending && <LoaderCircleIcon className="animate-spin" />}
            {pending ? "Menyimpan..." : "Simpan harga khusus"}
          </Button>
          {standard.monthlyPrice > 0 && (
            <Button type="button" variant="outline" onClick={resetToStandard} disabled={pending}>
              <RotateCcwIcon />
              Pakai harga standar
            </Button>
          )}
          {cancelHref && (
            <Button variant="outline" nativeButton={false} render={<Link href={cancelHref} />}>
              Kembali
            </Button>
          )}
        </Field>
      </FieldGroup>
    </form>
  );
}

// Tabel hasil kalkulasi: harga standar vs harga khusus tiap paket, plus setara
// per bulan dari harga khusus. Berubah langsung saat isian di atas diketik.
function PricingComparison({ custom, plans }: { custom: Pricing; plans: PlanPrice[] }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-4 text-sm">
      <p className="font-medium">Hasil kalkulasi otomatis</p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-md">
          <thead className="text-left text-xs text-muted-foreground">
            <tr>
              <th className="py-1 font-normal">Paket</th>
              <th className="py-1 text-right font-normal">Harga standar</th>
              <th className="py-1 text-right font-normal">Harga khusus</th>
              <th className="py-1 text-right font-normal">Setara per bulan</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {PLAN_MONTHS.map((months) => {
              const standardPrice = plans.find((plan) => plan.months === months)?.standardPrice ?? 0;
              const total = planPrice(custom, months);
              const discount = discountOf(custom, months);
              return (
                <tr key={months} className="border-t">
                  <td className="py-2">
                    {PLAN_LABELS[months]}
                    {discount > 0 && (
                      <span className="ml-1 text-xs text-emerald-700 dark:text-emerald-300">−{discount}%</span>
                    )}
                  </td>
                  <td className="py-2 text-right text-muted-foreground">
                    {standardPrice > 0 ? formatRupiah(standardPrice) : "Belum diatur"}
                  </td>
                  <td className="py-2 text-right">
                    <span className="font-medium">{formatRupiah(total)}</span>
                    {total === standardPrice && (
                      <span className="block text-xs text-muted-foreground">sama dengan standar</span>
                    )}
                  </td>
                  <td className="py-2 text-right text-muted-foreground">{formatRupiah(Math.round(total / months))}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        Paket yang hasilnya sama dengan harga standar tetap mengikuti harga standar (ikut berubah bila harga standar
        diubah). Tagihan yang sudah dibuat tidak ikut berubah.
      </p>
    </div>
  );
}
