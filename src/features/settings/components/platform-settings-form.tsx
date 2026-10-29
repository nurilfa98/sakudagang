// Form Pengaturan platform: kontak admin, masa gratis & tenggang. Rekening
// bank diatur terpisah (bank-accounts-manager.tsx), QRIS di qris-image-form.tsx. Pola sama dengan store-form.tsx (onSubmit + useActionState agar
// isian tidak hilang saat validasi gagal).

"use client";

import { LoaderCircleIcon } from "lucide-react";
import { startTransition, useActionState, useEffect, type FormEvent } from "react";
import { PhoneInput } from "@/components/phone-input";
import { TextField } from "@/components/text-field";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup } from "@/components/ui/field";
import { updatePlatformSettings } from "@/features/settings/actions";
import { notify } from "@/lib/notify";
import type { PlatformSettings } from "@/lib/platform-settings";

export function PlatformSettingsForm({ settings }: { settings: PlatformSettings }) {
  const [state, formAction, pending] = useActionState(updatePlatformSettings, undefined);
  const error = state && !state.success ? state : undefined;
  const fieldError = (name: string) => error?.fieldErrors?.[name]?.[0];

  useEffect(() => {
    if (state?.success) notify.success("Pengaturan disimpan.");
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
        <PhoneInput
          name="adminPhone"
          label="WhatsApp admin SakuDagang"
          defaultValue={settings.adminPhone}
          description="Tujuan tombol 'Konfirmasi via WhatsApp' di halaman Langganan toko."
          error={fieldError("adminPhone")}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            name="freeDays"
            label="Masa gratis toko baru (hari)"
            inputMode="numeric"
            defaultValue={String(settings.freeDays)}
            description="Berlaku untuk toko yang dibuat setelah ini."
            error={fieldError("freeDays")}
          />
          <TextField
            name="graceDays"
            label="Masa tenggang (hari)"
            inputMode="numeric"
            defaultValue={String(settings.graceDays)}
            description="Setelah jatuh tempo, toko masih bisa dipakai selama ini."
            error={fieldError("graceDays")}
          />
        </div>
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
