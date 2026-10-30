// Form ubah pelanggan (Pemilik, customer:edit): nama, WhatsApp, catatan, dan
// tanda boleh/tidak boleh bon. Pelanggan yang tidak boleh bon tidak bisa
// dipilih saat kasir mencatat bon; bon lamanya tetap bisa dilunasi.

"use client";

import { LoaderCircleIcon } from "lucide-react";
import { useState, useTransition, type FormEvent } from "react";
import { PhoneInput } from "@/components/phone-input";
import { TextField } from "@/components/text-field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { updateCustomer } from "@/features/credits/actions";
import type { CustomerOption } from "@/features/credits/queries";
import { notify } from "@/lib/notify";

export function CustomerForm({ customer }: { customer: CustomerOption }) {
  const [allowCredit, setAllowCredit] = useState(customer.allowCredit);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await updateCustomer({
        customerId: customer.id,
        name: String(formData.get("name") ?? ""),
        phone: String(formData.get("phone") ?? ""),
        note: String(formData.get("note") ?? ""),
        allowCredit,
      });
      if (!result.success) {
        setErrors(result.fieldErrors ?? {});
        if (!result.fieldErrors) notify.error(result.message);
        return;
      }
      setErrors({});
      notify.success("Data pelanggan disimpan.");
    });
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xl">
      <FieldGroup>
        <TextField
          name="name"
          label="Nama"
          defaultValue={customer.name}
          autoComplete="off"
          maxLength={100}
          required
          error={errors.name?.[0]}
        />
        <PhoneInput name="phone" label="Nomor WhatsApp" defaultValue={customer.phone} error={errors.phone?.[0]} />
        <TextField
          name="note"
          label="Catatan"
          defaultValue={customer.note ?? ""}
          placeholder="Rumah sebelah masjid"
          autoComplete="off"
          maxLength={500}
          error={errors.note?.[0]}
        />
        <Field orientation="horizontal">
          <Checkbox id="allowCredit" checked={allowCredit} onCheckedChange={(checked) => setAllowCredit(checked === true)} />
          <FieldContent>
            <FieldLabel htmlFor="allowCredit">Boleh bon</FieldLabel>
            <FieldDescription>Matikan agar kasir tidak bisa mencatat bon baru untuk pelanggan ini.</FieldDescription>
          </FieldContent>
        </Field>
        <Field orientation="horizontal">
          <Button type="submit" disabled={pending}>
            {pending && <LoaderCircleIcon className="animate-spin" />}
            Simpan perubahan
          </Button>
        </Field>
      </FieldGroup>
    </form>
  );
}
