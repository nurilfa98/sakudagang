// Pratinjau bukti transfer (/api/subscriptions/[id]/proof): gambar tampil
// langsung, PDF sebagai tautan buka di tab baru. Dipakai kartu tagihan
// pemilik (inline) dan dialog "Bukti" di halaman Tagihan admin.

import { FileTextIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ProofPreview({ subscriptionId, type, className }: { subscriptionId: string; type: "image" | "pdf"; className?: string }) {
  const href = `/api/subscriptions/${subscriptionId}/proof`;
  if (type === "pdf") {
    return (
      <Button variant="outline" nativeButton={false} render={<a href={href} target="_blank" rel="noreferrer" />} className={className}>
        <FileTextIcon />
        Buka bukti transfer (PDF)
      </Button>
    );
  }
  return (
    <a href={href} target="_blank" rel="noreferrer" className={className} title="Buka ukuran penuh">
      {/* eslint-disable-next-line @next/next/no-img-element -- file privat dilayani route setelah cek hak akses */}
      <img src={href} alt="Bukti transfer" className="max-h-96 w-auto rounded-md border bg-white object-contain" />
    </a>
  );
}
