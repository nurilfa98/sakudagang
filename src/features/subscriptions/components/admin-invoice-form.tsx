// Form "Buat tagihan untuk toko ini" di halaman detail toko (Superadmin):
// dipakai saat pemilik membayar langsung (tunai/transfer saat kunjungan) atau
// minta dibuatkan tagihan. Pilih paket (harga toko ini), catatan, dan opsi
// "sudah dibayar" agar langsung lunas tanpa ke halaman Tagihan.

"use client";

import { LoaderCircleIcon, ReceiptIcon } from "lucide-react";
import { startTransition, useActionState, useEffect, useState, type FormEvent } from "react";
import { TextField } from "@/components/text-field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  const [paid, setPaid] = useState(true);
  const error = state && !state.success ? state : undefined;
  const fieldError = (name: string) => error?.fieldErrors?.[name]?.[0];

  const items = available.map((plan) => ({
    value: String(plan.months),
    label: `${PLAN_LABELS[plan.months]} · ${formatRupiah(plan.price)}${plan.custom ? " (khusus)" : ""}`,
  }));

  useEffect(() => {
    if (state?.success) notify.success(state.data.paid ? "Tagihan dibuat dan ditandai lunas." : "Tagihan dibuat, menunggu pembayaran.");
    else if (state && !state.fieldErrors) notify.error(state.message);
  }, [state]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  if (hasPending) {
    return <p className="text-sm text-muted-foreground">Masih ada tagihan menunggu pembayaran; selesaikan dulu di halaman Tagihan.</p>;
  }
  if (available.length === 0) {
    return <p className="text-sm text-muted-foreground">Harga paket belum diatur. Isi dulu di Pengaturan.</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xl">
      <input type="hidden" name="storeId" value={storeId} />
      <input type="hidden" name="months" value={months} />
      <input type="hidden" name="paid" value={paid ? "1" : ""} />
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
          <Checkbox id="admin-invoice-paid" checked={paid} onCheckedChange={(checked) => setPaid(checked === true)} />
          <FieldLabel htmlFor="admin-invoice-paid" className="font-normal">
            Sudah dibayar, langsung tandai lunas dan perpanjang masa aktif
          </FieldLabel>
        </Field>
        <Field orientation="horizontal">
          <Button type="submit" variant="outline" disabled={pending || !months}>
            {pending ? <LoaderCircleIcon className="animate-spin" /> : <ReceiptIcon />}
            {pending ? "Menyimpan..." : paid ? "Buat tagihan & tandai lunas" : "Buat tagihan"}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  );
}
