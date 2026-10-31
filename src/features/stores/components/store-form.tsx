// Form tambah & edit toko. Tanpa prop `store` = mode tambah (Superadmin),
// dengan `store` = mode edit (Superadmin atau Pemilik tokonya sendiri).
//
// Kenapa memakai onSubmit, bukan <form action={formAction}>?
// Dengan `action`, React mengosongkan form setelah Server Action selesai,
// termasuk saat validasi GAGAL, sehingga user harus mengetik ulang semuanya.
// Dengan onSubmit + startTransition, isian tetap ada saat ada error.
//
// Zona waktu memakai Select Base UI (controlled) + input hidden agar nilainya
// ikut terkirim di FormData.
//
// Referensi:
// - https://react.dev/reference/react-dom/components/form (bagian "Handle form submission")
// - https://ui.shadcn.com/docs/components/base/select

"use client";

import { LoaderCircleIcon } from "lucide-react";
import Link from "next/link";
import { startTransition, useActionState, useState, type FormEvent } from "react";
import { useActionResult } from "@/hooks/use-action-result";
import { PhoneInput } from "@/components/phone-input";
import { TextField } from "@/components/text-field";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createStore, updateStore } from "@/features/stores/actions";
import { BUSINESS_TYPE_SUGGESTIONS, TIMEZONES } from "@/features/stores/constants";
import type { StoreDetail } from "@/features/stores/queries";
import { notify } from "@/lib/notify";

const TIMEZONE_ITEMS = TIMEZONES.map((tz) => ({ value: tz.value, label: tz.label }));

export function StoreForm({ store, cancelHref }: { store?: StoreDetail; cancelHref?: string }) {
  const [state, formAction, pending] = useActionState(store ? updateStore : createStore, undefined);
  const [timezone, setTimezone] = useState(store?.timezone ?? "Asia/Jakarta");

  const error = state && !state.success ? state : undefined;
  const fieldError = (name: string) => error?.fieldErrors?.[name]?.[0];

  useActionResult(state, (result) => {
    if (result.success) notify.success("Data toko disimpan.");
    else if (!result.fieldErrors) notify.error(result.message);
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xl">
      {store && <input type="hidden" name="storeId" value={store.id} />}
      <input type="hidden" name="timezone" value={timezone} />
      <FieldGroup>
        <TextField
          name="name"
          label="Nama toko"
          defaultValue={store?.name}
          placeholder="Warung Bu Sri"
          autoComplete="off"
          required
          error={fieldError("name")}
        />
        <TextField
          name="businessType"
          label="Jenis usaha"
          defaultValue={store?.businessType ?? ""}
          placeholder="Warung sembako"
          autoComplete="off"
          list="business-type-suggestions"
          error={fieldError("businessType")}
        />
        <datalist id="business-type-suggestions">
          {BUSINESS_TYPE_SUGGESTIONS.map((type) => (
            <option key={type} value={type} />
          ))}
        </datalist>

        <Field data-invalid={!!fieldError("address")}>
          <FieldLabel htmlFor="address">Alamat</FieldLabel>
          <Textarea
            id="address"
            name="address"
            defaultValue={store?.address ?? ""}
            rows={2}
            aria-invalid={!!fieldError("address")}
          />
          <FieldError>{fieldError("address")}</FieldError>
        </Field>

        <PhoneInput
          name="phone"
          label="Nomor telepon / WhatsApp toko"
          defaultValue={store?.phone}
          error={fieldError("phone")}
        />

        <Field data-invalid={!!fieldError("timezone")}>
          <FieldLabel htmlFor="timezone">Zona waktu</FieldLabel>
          <Select value={timezone} onValueChange={(value) => setTimezone(String(value ?? ""))} items={TIMEZONE_ITEMS}>
            <SelectTrigger id="timezone" className="w-full" aria-invalid={!!fieldError("timezone")}>
              <SelectValue placeholder="Pilih zona waktu" />
            </SelectTrigger>
            <SelectContent>
              {TIMEZONE_ITEMS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!fieldError("timezone") && (
            <FieldDescription>Menentukan tanggal &ldquo;hari ini&rdquo; untuk laporan harian dan kasir.</FieldDescription>
          )}
          <FieldError>{fieldError("timezone")}</FieldError>
        </Field>

        <Field orientation="horizontal">
          <Button type="submit" disabled={pending}>
            {pending && <LoaderCircleIcon className="animate-spin" />}
            {pending ? "Menyimpan..." : store ? "Simpan perubahan" : "Buat toko"}
          </Button>
          {cancelHref && (
            <Button variant="outline" nativeButton={false} render={<Link href={cancelHref} />}>
              Batal
            </Button>
          )}
        </Field>
      </FieldGroup>
    </form>
  );
}
