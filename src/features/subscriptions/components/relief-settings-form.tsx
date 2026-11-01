// Form Perlindungan bulan sepi (Pengaturan platform, Superadmin),
// BUSINESS-FLOW §14.8: tambahan masa aktif, batas penurunan omzet, dan jatah
// per paket 6 bulan / 1 tahun. Tabel simulasi menunjukkan diskon efektif
// maksimal (diskon paket + semua jatah terpakai), agar terlihat dampaknya ke
// pendapatan. Hanya berlaku untuk tagihan yang dibuat sesudah disimpan.

"use client";

import { LoaderCircleIcon } from "lucide-react";
import { startTransition, useActionState, useState, type FormEvent } from "react";
import { useActionResult } from "@/hooks/use-action-result";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { updateReliefSettings } from "@/features/subscriptions/actions";
import { PLAN_LABELS } from "@/features/subscriptions/constants";
import { notify } from "@/lib/notify";
import { effectiveDiscount, reliefRulesFor, type ReliefSettings } from "../relief";

export function ReliefSettingsForm({
  settings,
  discount6,
  discount12,
}: {
  settings: ReliefSettings;
  discount6: number;
  discount12: number;
}) {
  const [state, formAction, pending] = useActionState(updateReliefSettings, undefined);
  const [values, setValues] = useState(settings);
  const error = state && !state.success ? state : undefined;
  const fieldError = (name: string) => error?.fieldErrors?.[name]?.[0];
  const set = (key: keyof ReliefSettings) => (value: number) => setValues((current) => ({ ...current, [key]: value }));

  useActionResult(state, (result) => {
    if (result.success) notify.success("Perlindungan bulan sepi disimpan.");
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
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <NumberField
            name="reliefDays"
            label="Tambahan masa aktif"
            unit="hari"
            min={0}
            max={60}
            defaultValue={settings.reliefDays}
            onValueChange={set("reliefDays")}
            description="0 = tidak ditawarkan."
            error={fieldError("reliefDays")}
          />
          <NumberField
            name="reliefDropPercent"
            label="Batas penurunan omzet"
            unit="%"
            min={1}
            max={90}
            defaultValue={settings.reliefDropPercent}
            onValueChange={set("reliefDropPercent")}
            description="Dibanding rata-rata 3 bulan sebelumnya."
            error={fieldError("reliefDropPercent")}
          />
          <NumberField
            name="reliefMax6"
            label="Jatah paket 6 bulan"
            unit="kali"
            min={0}
            max={6}
            defaultValue={settings.reliefMax6}
            onValueChange={set("reliefMax6")}
            description="0 = paket 6 bulan tanpa perlindungan."
            error={fieldError("reliefMax6")}
          />
          <NumberField
            name="reliefMax12"
            label="Jatah paket 1 tahun"
            unit="kali"
            min={0}
            max={12}
            defaultValue={settings.reliefMax12}
            onValueChange={set("reliefMax12")}
            description="0 = paket 1 tahun tanpa perlindungan."
            error={fieldError("reliefMax12")}
          />
        </div>

        <ReliefPreview settings={values} discount6={discount6} discount12={discount12} />

        <Field orientation="horizontal">
          <Button type="submit" disabled={pending}>
            {pending && <LoaderCircleIcon className="animate-spin" />}
            {pending ? "Menyimpan..." : "Simpan perlindungan"}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  );
}

// Dampak terburuk ke pendapatan: semua jatah terpakai.
function ReliefPreview({
  settings,
  discount6,
  discount12,
}: {
  settings: ReliefSettings;
  discount6: number;
  discount12: number;
}) {
  const rows = [
    { months: 6 as const, discount: discount6 },
    { months: 12 as const, discount: discount12 },
  ];
  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-4 text-sm">
      <p className="font-medium">Dampak maksimal bila semua jatah terpakai</p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr>
              <th className="py-1 font-normal">Paket</th>
              <th className="py-1 text-right font-normal">Diskon paket</th>
              <th className="py-1 text-right font-normal">Tambahan maks</th>
              <th className="py-1 text-right font-normal">Diskon efektif maks</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {rows.map(({ months, discount }) => {
              const rules = reliefRulesFor(settings, months);
              return (
                <tr key={months} className="border-t">
                  <td className="py-2">{PLAN_LABELS[months]}</td>
                  <td className="py-2 text-right">{discount}%</td>
                  <td className="py-2 text-right">{rules ? `${rules.days * rules.max} hari` : "-"}</td>
                  <td className="py-2 text-right font-medium">
                    {effectiveDiscount(discount, months, rules).toLocaleString("id-ID")}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        Aturan disalin ke tagihan saat tagihan dibuat: perubahan di sini hanya berlaku untuk paket yang dibeli
        sesudahnya. Paket 1 bulan tidak mendapat perlindungan.
      </p>
    </div>
  );
}

function NumberField({
  name,
  label,
  unit,
  min,
  max,
  defaultValue,
  onValueChange,
  description,
  error,
}: {
  name: string;
  label: string;
  unit: string;
  min: number;
  max: number;
  defaultValue: number;
  onValueChange: (value: number) => void;
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
          min={min}
          max={max}
          defaultValue={defaultValue}
          onChange={(event) => {
            const value = event.target.valueAsNumber;
            onValueChange(Number.isFinite(value) ? value : 0);
          }}
          className="w-24 tabular-nums"
          aria-invalid={!!error}
          required
        />
        <span className="text-sm text-muted-foreground">{unit}</span>
      </div>
      <FieldDescription>{description}</FieldDescription>
      <FieldError>{error}</FieldError>
    </Field>
  );
}
