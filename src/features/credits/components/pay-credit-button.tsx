// Tombol "Bayar" + dialog pelunasan untuk satu penjualan bon: nominal
// (bawaan = sisa, boleh sebagian), metode Tunai/QRIS, tanggal uang diterima.

"use client";

import { BanknoteIcon, LoaderCircleIcon, QrCodeIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { RupiahInput } from "@/components/rupiah-input";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { recordCreditPayment } from "@/features/credits/actions";
import { CREDIT_PAYMENT_METHOD_LABELS, CREDIT_PAYMENT_METHODS, type CreditPaymentMethod } from "@/features/credits/constants";
import { formatRupiah } from "@/lib/format";
import { notify } from "@/lib/notify";

const METHOD_ICONS: Record<CreditPaymentMethod, React.ReactNode> = {
  CASH: <BanknoteIcon />,
  QRIS: <QrCodeIcon />,
};

export function PayCreditButton({
  sale,
  today,
  size = "sm",
}: {
  sale: { id: string; number: string; date: string; remaining: number };
  today: string;
  size?: "sm" | "default";
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState<number | null>(sale.remaining);
  const [method, setMethod] = useState<CreditPaymentMethod>("CASH");
  const [date, setDate] = useState(today);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [pending, startTransition] = useTransition();

  function openDialog() {
    setAmount(sale.remaining);
    setMethod("CASH");
    setDate(today);
    setErrors({});
    setOpen(true);
  }

  function handleSave() {
    startTransition(async () => {
      const result = await recordCreditPayment({ saleId: sale.id, amount: amount ?? 0, paymentMethod: method, date });
      if (!result.success) {
        setErrors(result.fieldErrors ?? {});
        if (!result.fieldErrors) notify.error(result.message);
        return;
      }
      notify.success(
        result.data.remaining > 0
          ? `Pelunasan dicatat. Sisa bon ${sale.number} ${formatRupiah(result.data.remaining)}.`
          : `Bon ${sale.number} lunas.`,
      );
      setOpen(false);
    });
  }

  return (
    <>
      <Button size={size} onClick={openDialog}>
        Bayar
      </Button>
      <AlertDialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bayar bon {sale.number}</AlertDialogTitle>
            <AlertDialogDescription>
              Sisa bon {formatRupiah(sale.remaining)}. Boleh dibayar sebagian; dicatat sebagai uang masuk pada
              tanggal diterima.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <FieldGroup>
            <Field data-invalid={!!errors.amount}>
              <FieldLabel htmlFor={`amount-${sale.id}`}>Nominal dibayar</FieldLabel>
              <RupiahInput
                id={`amount-${sale.id}`}
                defaultValue={sale.remaining}
                onValueChange={setAmount}
                className="h-10 text-base"
                aria-invalid={!!errors.amount}
              />
              {errors.amount ? (
                <FieldError>{errors.amount[0]}</FieldError>
              ) : (
                amount != null &&
                amount < sale.remaining && (
                  <FieldDescription>Sisa setelah ini {formatRupiah(sale.remaining - amount)}.</FieldDescription>
                )
              )}
            </Field>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Metode bayar">
              {CREDIT_PAYMENT_METHODS.map((value) => (
                <Button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={method === value}
                  variant={method === value ? "brand" : "outline"}
                  onClick={() => setMethod(value)}
                >
                  {METHOD_ICONS[value]}
                  {CREDIT_PAYMENT_METHOD_LABELS[value]}
                </Button>
              ))}
            </div>
            <Field data-invalid={!!errors.date}>
              <FieldLabel htmlFor={`date-${sale.id}`}>Tanggal diterima</FieldLabel>
              <Input
                id={`date-${sale.id}`}
                type="date"
                value={date}
                min={sale.date}
                max={today}
                onChange={(event) => setDate(event.target.value)}
                className="max-w-48"
                aria-invalid={!!errors.date}
              />
              <FieldError>{errors.date?.[0]}</FieldError>
            </Field>
          </FieldGroup>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Batal</AlertDialogCancel>
            <Button disabled={pending || !amount} onClick={handleSave}>
              {pending && <LoaderCircleIcon className="animate-spin" />}
              Simpan pelunasan
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
