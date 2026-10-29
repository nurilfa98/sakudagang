// Aturan bisnis fitur toko (fungsi murni, tanpa DB).

import { can } from "@/lib/auth/permissions";
import type { CurrentUser } from "@/lib/auth/dal";

// Superadmin boleh mengubah toko mana pun; Pemilik hanya tokonya sendiri.
export function canEditStore(actor: Pick<CurrentUser, "role" | "storeId">, storeId: string) {
  if (can(actor, "store:manage")) return true;
  return can(actor, "store:edit-own") && actor.storeId === storeId;
}
