// Tombol + dialog konfirmasi untuk aksi berdampak besar (nonaktifkan akun,
// reset password, nonaktifkan toko). Dialog tetap terbuka (dengan spinner)
// selama Server Action berjalan, lalu tertutup setelah selesai.
//
// Dipakai lintas fitur (users, stores), karena itu letaknya di components/.
//
// Referensi:
// - https://ui.shadcn.com/docs/components/alert-dialog
// - node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md
//   (bagian "Event Handlers")

"use client";

import { LoaderCircleIcon } from "lucide-react";
import { useState, useTransition, type ComponentProps } from "react";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function ConfirmButton({
  label,
  variant,
  size,
  disabled,
  dialogTitle,
  dialogDescription,
  confirmLabel,
  onConfirm,
  icon,
  ariaLabel,
  tooltip,
}: {
  label: string;
  variant: ComponentProps<typeof Button>["variant"];
  size?: ComponentProps<typeof Button>["size"];
  disabled?: boolean;
  dialogTitle: string;
  dialogDescription: string;
  confirmLabel: string;
  onConfirm: () => Promise<void>;
  // Tombol ikon saja: isi `icon` dan `ariaLabel`, kosongkan `label`.
  icon?: React.ReactNode;
  ariaLabel?: string;
  // Teks tooltip (biasanya sama dengan ariaLabel) untuk tombol ikon di tabel.
  tooltip?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      await onConfirm();
      setOpen(false);
    });
  }

  const button = (
    <Button
      variant={variant}
      size={size ?? (icon && !label ? "icon" : undefined)}
      disabled={disabled}
      onClick={() => setOpen(true)}
      aria-label={ariaLabel}
    >
      {icon}
      {label}
    </Button>
  );

  return (
    <>
      {tooltip ? (
        <Tooltip>
          <TooltipTrigger render={button} />
          <TooltipContent>{tooltip}</TooltipContent>
        </Tooltip>
      ) : (
        button
      )}
      <AlertDialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{dialogTitle}</AlertDialogTitle>
            <AlertDialogDescription>{dialogDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Batal</AlertDialogCancel>
            <Button
              variant={variant === "destructive" ? "destructive" : "brand"}
              disabled={pending}
              onClick={handleConfirm}
            >
              {pending && <LoaderCircleIcon className="animate-spin" />}
              {confirmLabel}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// Baris "judul + keterangan + tombol" di kartu aksi akun/toko.
export function ActionRow({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-0.5">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
