// Pilih pelanggan untuk bon di layar kasir, plus tombol "Pelanggan baru".
// Pelanggan yang ditandai tidak boleh bon tetap tampil tetapi tidak bisa dipilih.

"use client";

import { UserPlusIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import type { CustomerOption } from "@/features/credits/queries";
import { formatPhone } from "@/lib/phone";
import { NewCustomerDialog } from "./new-customer-dialog";

export function CustomerPicker({
  customers,
  value,
  onChange,
  onCreated,
  invalid,
}: {
  customers: CustomerOption[];
  value: string | null;
  onChange: (customerId: string | null) => void;
  // Pelanggan baru ditambahkan ke daftar di layar kasir tanpa muat ulang.
  onCreated: (customer: CustomerOption) => void;
  invalid?: boolean;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const selected = customers.find((customer) => customer.id === value) ?? null;

  return (
    <div className="flex gap-2">
      <Combobox
        items={customers}
        value={selected}
        onValueChange={(customer: CustomerOption | null) => onChange(customer?.id ?? null)}
        itemToStringLabel={(customer: CustomerOption) => customer.name}
        isItemEqualToValue={(a: CustomerOption, b: CustomerOption) => a.id === b.id}
      >
        <ComboboxInput placeholder="Cari nama pelanggan" className="w-full flex-1" aria-invalid={invalid} showClear />
        <ComboboxContent>
          <ComboboxEmpty>Pelanggan tidak ditemukan.</ComboboxEmpty>
          <ComboboxList>
            {(customer: CustomerOption) => (
              <ComboboxItem key={customer.id} value={customer} disabled={!customer.allowCredit}>
                <span className="flex-1 truncate">{customer.name}</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {!customer.allowCredit ? "tidak boleh bon" : customer.phone ? formatPhone(customer.phone) : ""}
                </span>
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      <Button type="button" variant="outline" onClick={() => setDialogOpen(true)}>
        <UserPlusIcon />
        <span className="sr-only sm:not-sr-only">Baru</span>
      </Button>
      <NewCustomerDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        existingNames={customers.map((customer) => customer.name.toLowerCase())}
        onCreated={(customer) => {
          onCreated(customer);
          onChange(customer.id);
        }}
      />
    </div>
  );
}
