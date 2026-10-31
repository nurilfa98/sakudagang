// Form edit nama & email pengguna. Polanya sama dengan user-create-form.tsx
// (onSubmit + startTransition agar isian tidak hilang saat validasi gagal).

"use client";

import { LoaderCircleIcon } from "lucide-react";
import { startTransition, useActionState, type FormEvent } from "react";
import { useActionResult } from "@/hooks/use-action-result";
import { PhoneInput } from "@/components/phone-input";
import { TextField } from "@/components/text-field";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup } from "@/components/ui/field";
import { updateUser } from "@/features/users/actions";
import type { UserDetail } from "@/features/users/queries";
import { notify } from "@/lib/notify";

export function UserEditForm({ user }: { user: UserDetail }) {
  const [state, formAction, pending] = useActionState(updateUser, undefined);

  const error = state && !state.success ? state : undefined;
  const fieldError = (name: string) => error?.fieldErrors?.[name]?.[0];

  useActionResult(state, (result) => {
    if (result.success) notify.success("Perubahan disimpan.");
    else if (!result.fieldErrors) notify.error(result.message);
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-md">
      <input type="hidden" name="userId" value={user.id} />
      <FieldGroup>
        <TextField
          name="fullName"
          label="Nama lengkap"
          defaultValue={user.fullName}
          autoComplete="off"
          required
          error={fieldError("fullName")}
        />
        <TextField
          name="email"
          label="Email"
          type="email"
          defaultValue={user.email}
          autoComplete="off"
          required
          error={fieldError("email")}
        />
        <PhoneInput
          name="phone"
          label="Nomor WhatsApp"
          defaultValue={user.phone}
          description="Opsional. Untuk mengirim undangan login lewat WhatsApp."
          error={fieldError("phone")}
        />
        <Field orientation="horizontal">
          <Button type="submit" disabled={pending}>
            {pending && <LoaderCircleIcon className="animate-spin" />}
            {pending ? "Menyimpan..." : "Simpan perubahan"}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  );
}
