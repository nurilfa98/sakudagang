// Tombol "Buka" untuk Superadmin: masuk ke sebuah toko (cookie toko aktif)
// lalu ke kotak menu, yang kini berisi menu toko tersebut. Pola sama dengan
// ArchiPay. `redirectTo` opsional, misalnya langsung ke tambah pemilik.
//
// Server Component: <form action> ke Server Action, tanpa JavaScript tambahan.

import { ArrowRightIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { enterStore } from "@/features/stores/actions";

export function EnterStoreButton({
  storeId,
  active,
  size,
  variant,
  redirectTo,
  children,
}: {
  storeId: string;
  // true = toko ini sedang dibuka.
  active?: boolean;
  size?: ComponentProps<typeof Button>["size"];
  variant?: ComponentProps<typeof Button>["variant"];
  redirectTo?: string;
  children?: ReactNode;
}) {
  return (
    <form action={enterStore}>
      <input type="hidden" name="storeId" value={storeId} />
      {redirectTo && <input type="hidden" name="redirectTo" value={redirectTo} />}
      <Button type="submit" variant={variant ?? (active ? "secondary" : "outline")} size={size}>
        {children ?? (active ? "Dibuka" : "Buka")}
        <ArrowRightIcon />
      </Button>
    </form>
  );
}
