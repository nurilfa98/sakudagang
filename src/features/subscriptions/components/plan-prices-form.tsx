// Form harga paket standar (Pengaturan platform, Superadmin), pola sama
// dengan ArchiPay: Superadmin mengisi harga per bulan + diskon 6 bulan &
// 1 tahun; harga 6 bulan & 1 tahun TIDAK diketik, melainkan dihitung otomatis
// (pricing.ts) dan ditampilkan di tabel simulasi. Harga per bulan 0 = paket
// belum dijual, Pemilik tidak bisa memilihnya.

"use client";

import { LoaderCircleIcon } from "lucide-react";
import { startTransition, useActionState, useState, type FormEvent } from "react";
import { useActionResult } from "@/hooks/use-action-result";
import { RupiahInput } from "@/components/rupiah-input";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { updatePlanPrices } from "@/features/subscriptions/actions";
import { PLAN_LABELS, PLAN_MONTHS } from "@/features/subscriptions/constants";
import { formatRupiah } from "@/lib/format";
import { notify } from "@/lib/notify";
import { discountOf, planPrice, type Pricing } from "../pricing";

export function PlanPricesForm({ pricing }: { pricing: Pricing }) {
  const [state, formAction, pending] = useActionState(updatePlanPrices, undefined);
  const [values, setValues] = useState(pricing);
  const error = state && !state.success ? state : undefined;
  const fieldError = (name: string) => error?.fieldErrors?.[name]?.[0];
  const set = (key: keyof Pricing) => (value: number) => setValues((current) => ({ ...current, [key]: value }));

  useActionResult(state, (result) => {
    if (result.success) notify.success("Harga paket disimpan.");
    else if (!result.fieldErrors) notify.error(result.message);
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  return (
    <form onSubmit={handleSubmit}>
      <FieldGroup>
        <div className="grid gap-5 sm:grid-cols-3">
          <Field data-invalid={!!fieldError("monthlyPrice")}>
            <FieldLabel htmlFor="monthlyPrice">Harga per bulan</FieldLabel>
            <RupiahInput
              id="monthlyPrice"
              name="monthlyPrice"
              defaultValue={pricing.monthlyPrice}
              onValueChange={(value) => set("monthlyPrice")(value ?? 0)}
              aria-invalid={!!fieldError("monthlyPrice")}
              required
            />
            <FieldDescription>0 = paket belum dijual.</FieldDescription>
            <FieldError>{fieldError("monthlyPrice")}</FieldError>
          </Field>
          <PercentField
            name="discount6"
            label="Diskon paket 6 bulan"
            defaultValue={pricing.discount6}
            onValueChange={set("discount6")}
            error={fieldError("discount6")}
          />
          <PercentField
            name="discount12"
            label="Diskon paket 1 tahun"
            defaultValue={pricing.discount12}
            onValueChange={set("discount12")}
            error={fieldError("discount12")}
          />
        </div>

        <PricingPreview pricing={values} />

        <Field orientation="horizontal">
          <Button type="submit" disabled={pending}>
            {pending && <LoaderCircleIcon className="animate-spin" />}
            {pending ? "Menyimpan..." : "Simpan harga"}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  );
}

// Tabel hasil kalkulasi: harga total paket 1/6/12 bulan, setara per bulan,
// dan diskonnya. Berubah langsung saat isian di atas diketik.
function PricingPreview({ pricing }: { pricing: Pricing }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-4 text-sm">
      <p className="font-medium">Hasil kalkulasi otomatis</p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr>
              <th className="py-1 font-normal">Paket</th>
              <th className="py-1 text-right font-normal">Harga total</th>
              <th className="py-1 text-right font-normal">Setara per bulan</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {PLAN_MONTHS.map((months) => {
              const total = planPrice(pricing, months);
              const discount = discountOf(pricing, months);
              return (
                <tr key={months} className="border-t">
                  <td className="py-2">
                    {PLAN_LABELS[months]}
                    {discount > 0 && (
                      <span className="ml-1 text-xs text-emerald-700 dark:text-emerald-300">−{discount}%</span>
                    )}
                  </td>
                  <td className="py-2 text-right font-medium">{formatRupiah(total)}</td>
                  <td className="py-2 text-right text-muted-foreground">{formatRupiah(Math.round(total / months))}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        Tagihan yang sudah dibuat tidak ikut berubah. Harga khusus toko diatur di detail toko.
      </p>
    </div>
  );
}

function PercentField({
  name,
  label,
  defaultValue,
  onValueChange,
  error,
}: {
  name: string;
  label: string;
  defaultValue: number;
  onValueChange: (value: number) => void;
  error?: string;
}) {
  return (
    <Field data-invalid={!!error}>
      <FieldLabel htmlFor={name}>{label}</FieldLabel>
      <div className="flex items-center gap-2">
        <Input
          id={name}
          name={name}
          type="number"
          inputMode="numeric"
          min={0}
          max={90}
          defaultValue={defaultValue}
          onChange={(event) => {
            const value = event.target.valueAsNumber;
            onValueChange(Number.isFinite(value) ? value : 0);
          }}
          className="w-24 tabular-nums"
          aria-invalid={!!error}
          required
        />
        <span className="text-sm text-muted-foreground">%</span>
      </div>
      <FieldDescription>Dibanding membayar bulanan.</FieldDescription>
      <FieldError>{error}</FieldError>
    </Field>
  );
}
