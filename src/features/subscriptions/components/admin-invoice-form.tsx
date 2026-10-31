// Form "Catat pembayaran langsung" di halaman detail toko (Superadmin):
// dipakai saat pemilik membayar tunai/transfer saat kunjungan. Pilih paket
// (harga toko ini) + catatan → langsung lunas, masa aktif diperpanjang.

"use client";

import { LoaderCircleIcon, ReceiptIcon } from "lucide-react";
import { startTransition, useActionState, useState, type FormEvent } from "react";
import { useActionResult } from "@/hooks/use-action-result";
import { TextField } from "@/components/text-field";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createSubscriptionForStore } from "@/features/subscriptions/actions";
import { PLAN_LABELS } from "@/features/subscriptions/constants";
import type { PlanPrice } from "@/features/subscriptions/queries";
import { formatRupiah } from "@/lib/format";
import { notify } from "@/lib/notify";

export function AdminInvoiceForm({ storeId, plans, hasPending }: { storeId: string; plans: PlanPrice[]; hasPending: boolean }) {
  const [state, formAction, pending] = useActionState(createSubscriptionForStore, undefined);
  const available = plans.filter((plan) => plan.price > 0);
  const [months, setMonths] = useState(String(available[0]?.months ?? ""));
  const error = state && !state.success ? state : undefined;
  const fieldError = (name: string) => error?.fieldErrors?.[name]?.[0];

  const items = available.map((plan) => ({
    value: String(plan.months),
    label: `${PLAN_LABELS[plan.months]} · ${formatRupiah(plan.price)}${plan.custom ? " (khusus)" : ""}`,
  }));

  useActionResult(state, (result) => {
    if (result.success) notify.success("Pembayaran dicatat, masa aktif toko diperpanjang.");
    else if (!result.fieldErrors) notify.error(result.message);
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  if (hasPending) {
    return <p className="text-sm text-muted-foreground">Masih ada tagihan toko ini yang belum selesai; selesaikan dulu di halaman Tagihan.</p>;
  }
  if (available.length === 0) {
    return <p className="text-sm text-muted-foreground">Harga paket belum diatur. Isi dulu di Pengaturan.</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xl">
      <input type="hidden" name="storeId" value={storeId} />
      <input type="hidden" name="months" value={months} />
      <FieldGroup>
        <Field data-invalid={!!fieldError("months")}>
          <FieldLabel htmlFor="admin-invoice-months">Paket</FieldLabel>
          <Select value={months} onValueChange={(value) => setMonths(String(value ?? ""))} items={items}>
            <SelectTrigger id="admin-invoice-months" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {items.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError>{fieldError("months")}</FieldError>
        </Field>
        <TextField
          name="note"
          label="Catatan"
          placeholder="Bayar tunai saat kunjungan 29 Okt"
          autoComplete="off"
          error={fieldError("note")}
        />
        <Field orientation="horizontal">
          <Button type="submit" variant="outline" disabled={pending || !months}>
            {pending ? <LoaderCircleIcon className="animate-spin" /> : <ReceiptIcon />}
            {pending ? "Menyimpan..." : "Catat pembayaran (langsung lunas)"}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  );
}
