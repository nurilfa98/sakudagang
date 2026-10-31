// Form Pengaturan platform bagian "Masa gratis & tenggang" (pola sama dengan
// ArchiPay): masa gratis toko baru, masa tenggang, dan WhatsApp admin.
// Rekening bank diatur terpisah (bank-accounts-manager.tsx), QRIS di
// qris-image-form.tsx. onSubmit + useActionState agar isian tidak hilang saat
// validasi gagal.

"use client";

import { LoaderCircleIcon } from "lucide-react";
import { startTransition, useActionState, type FormEvent } from "react";
import { useActionResult } from "@/hooks/use-action-result";
import { PhoneInput } from "@/components/phone-input";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { updatePlatformSettings } from "@/features/settings/actions";
import { notify } from "@/lib/notify";
import type { PlatformSettings } from "@/lib/platform-settings";

export function PlatformSettingsForm({ settings }: { settings: PlatformSettings }) {
  const [state, formAction, pending] = useActionState(updatePlatformSettings, undefined);
  const error = state && !state.success ? state : undefined;
  const fieldError = (name: string) => error?.fieldErrors?.[name]?.[0];

  useActionResult(state, (result) => {
    if (result.success) notify.success("Pengaturan platform disimpan.");
    else if (!result.fieldErrors) notify.error(result.message);
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xl">
      <FieldGroup>
        <div className="grid gap-5 sm:grid-cols-2">
          <DaysField
            name="freeDays"
            label="Masa gratis toko baru"
            defaultValue={settings.freeDays}
            max={365}
            description="Berlaku untuk toko yang dibuat setelah ini."
            error={fieldError("freeDays")}
          />
          <DaysField
            name="graceDays"
            label="Masa tenggang"
            defaultValue={settings.graceDays}
            max={60}
            description="Setelah masa aktif habis, sebelum toko dikunci."
            error={fieldError("graceDays")}
          />
        </div>
        <PhoneInput
          name="adminPhone"
          label="WhatsApp admin SakuDagang"
          defaultValue={settings.adminPhone}
          description="Menerima kabar bukti bayar dan menjadi tujuan tombol 'Konfirmasi via WhatsApp' di halaman Langganan toko."
          className="max-w-60 tabular-nums"
          error={fieldError("adminPhone")}
        />
        <Field orientation="horizontal">
          <Button type="submit" disabled={pending}>
            {pending && <LoaderCircleIcon className="animate-spin" />}
            {pending ? "Menyimpan..." : "Simpan pengaturan"}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  );
}

function DaysField({
  name,
  label,
  defaultValue,
  max,
  description,
  error,
}: {
  name: string;
  label: string;
  defaultValue: number;
  max: number;
  description: string;
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
          max={max}
          defaultValue={defaultValue}
          className="w-24 tabular-nums"
          aria-invalid={!!error}
          required
        />
        <span className="text-sm text-muted-foreground">hari</span>
      </div>
      <FieldDescription>{description}</FieldDescription>
      <FieldError>{error}</FieldError>
    </Field>
  );
}
