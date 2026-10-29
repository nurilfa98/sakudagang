// Form harga paket standar (Pengaturan, Superadmin): harga TOTAL per periode
// 1 / 6 / 12 bulan. 0 = belum diatur, paket tidak bisa dipilih Pemilik.

"use client";

import { LoaderCircleIcon } from "lucide-react";
import { startTransition, useActionState, useEffect, type FormEvent } from "react";
import { RupiahInput } from "@/components/rupiah-input";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { updatePlanPrices } from "@/features/subscriptions/actions";
import { PLAN_LABELS, type PlanMonths } from "@/features/subscriptions/constants";
import { notify } from "@/lib/notify";

export function PlanPricesForm({ plans }: { plans: { months: PlanMonths; price: number }[] }) {
  const [state, formAction, pending] = useActionState(updatePlanPrices, undefined);
  const error = state && !state.success ? state : undefined;
  const fieldError = (name: string) => error?.fieldErrors?.[name]?.[0];

  useEffect(() => {
    if (state?.success) notify.success("Harga paket disimpan.");
    else if (state && !state.fieldErrors) notify.error(state.message);
  }, [state]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xl">
      <FieldGroup>
        <div className="grid gap-4 sm:grid-cols-3">
          {plans.map((plan) => {
            const name = `price${plan.months}`;
            return (
              <Field key={plan.months} data-invalid={!!fieldError(name)}>
                <FieldLabel htmlFor={name}>{PLAN_LABELS[plan.months]}</FieldLabel>
                <RupiahInput id={name} name={name} defaultValue={plan.price} aria-invalid={!!fieldError(name)} />
                <FieldError>{fieldError(name)}</FieldError>
              </Field>
            );
          })}
        </div>
        <FieldDescription>
          Harga total untuk satu periode. Aplikasi menghitung sendiri &ldquo;setara per bulan&rdquo; dan persen hemat.
          Tagihan yang sudah dibuat tidak berubah.
        </FieldDescription>
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
