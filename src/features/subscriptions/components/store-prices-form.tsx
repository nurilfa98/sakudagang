// Form harga khusus satu toko (hasil negosiasi), Superadmin. Nominal kosong =
// toko memakai harga standar untuk periode itu.

"use client";

import { LoaderCircleIcon } from "lucide-react";
import Link from "next/link";
import { startTransition, useActionState, useEffect, type FormEvent } from "react";
import { RupiahInput } from "@/components/rupiah-input";
import { TextField } from "@/components/text-field";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { saveStorePlanPrices } from "@/features/subscriptions/actions";
import { PLAN_LABELS } from "@/features/subscriptions/constants";
import type { PlanPrice } from "@/features/subscriptions/queries";
import { formatRupiah } from "@/lib/format";
import { notify } from "@/lib/notify";

export function StorePricesForm({ storeId, plans, cancelHref }: { storeId: string; plans: PlanPrice[]; cancelHref: string }) {
  const [state, formAction, pending] = useActionState(saveStorePlanPrices, undefined);
  const error = state && !state.success ? state : undefined;
  const fieldError = (name: string) => error?.fieldErrors?.[name]?.[0];
  const note = plans.find((plan) => plan.note)?.note ?? "";

  useEffect(() => {
    if (state?.success) notify.success("Harga khusus disimpan.");
    else if (state && !state.fieldErrors) notify.error(state.message);
  }, [state]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xl">
      <input type="hidden" name="storeId" value={storeId} />
      <FieldGroup>
        <div className="grid gap-4 sm:grid-cols-3">
          {plans.map((plan) => {
            const name = `price${plan.months}`;
            return (
              <Field key={plan.months} data-invalid={!!fieldError(name)}>
                <FieldLabel htmlFor={name}>{PLAN_LABELS[plan.months]}</FieldLabel>
                <RupiahInput
                  id={name}
                  name={name}
                  defaultValue={plan.custom ? plan.price : null}
                  placeholder={plan.standardPrice > 0 ? plan.standardPrice.toLocaleString("id-ID") : "0"}
                  aria-invalid={!!fieldError(name)}
                />
                {!fieldError(name) && (
                  <FieldDescription className="text-xs">
                    Standar: {plan.standardPrice > 0 ? formatRupiah(plan.standardPrice) : "belum diatur"}
                  </FieldDescription>
                )}
                <FieldError>{fieldError(name)}</FieldError>
              </Field>
            );
          })}
        </div>
        <TextField
          name="note"
          label="Catatan"
          defaultValue={note}
          placeholder="Negosiasi 12 Nov 2026, kunjungan ke toko"
          autoComplete="off"
          description="Kosongkan nominal untuk kembali ke harga standar."
          error={fieldError("note")}
        />
        <Field orientation="horizontal">
          <Button type="submit" disabled={pending}>
            {pending && <LoaderCircleIcon className="animate-spin" />}
            {pending ? "Menyimpan..." : "Simpan harga khusus"}
          </Button>
          <Button variant="outline" nativeButton={false} render={<Link href={cancelHref} />}>
            Kembali
          </Button>
        </Field>
      </FieldGroup>
    </form>
  );
}
