// Pratinjau bukti transfer (/api/payments/[id]/proof) TANPA pindah
// halaman: kotak kecil (thumbnail) → klik → dialog berisi gambar ukuran penuh
// (atau PDF dalam bingkai tertanam). Dipakai kartu tagihan pemilik dan
// halaman Tagihan admin (mode "full" saat sudah berada di dalam dialog).
//
// Bukti transaksi lama boleh dihapus manual dari bucket R2 (hemat kuota):
// data tagihan/pembayaran tetap utuh, hanya gambarnya yang tidak tampil.
// Tidak ada logika khusus untuk itu (keputusan user 29 Okt 2026).

"use client";

import { FileTextIcon, ZoomInIcon } from "lucide-react";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

type ProofPreviewProps = {
  paymentId: string;
  type: "image" | "pdf";
  // "thumbnail": kotak kecil yang membuka dialog; "full": langsung isi
  // pratinjau (dipakai di dalam dialog lain, agar tidak ada dialog bertumpuk).
  mode?: "thumbnail" | "full";
  className?: string;
};

export function ProofPreview({ paymentId, type, mode = "thumbnail", className }: ProofPreviewProps) {
  const [open, setOpen] = useState(false);
  const src = `/api/payments/${paymentId}/proof`;

  if (mode === "full") return <ProofContent src={src} type={type} className={className} />;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Lihat bukti transfer"
        title="Lihat bukti transfer"
        className={cn(
          "group relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-white",
          className,
        )}
      >
        {type === "pdf" ? (
          <FileTextIcon className="size-7 text-muted-foreground" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- file privat dilayani route setelah cek hak akses
          <img src={src} alt="Bukti transfer" className="size-full object-cover" />
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-black/0 text-white opacity-0 transition group-hover:bg-black/30 group-hover:opacity-100">
          <ZoomInIcon className="size-5" />
        </span>
      </button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent className="max-w-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Bukti transfer</AlertDialogTitle>
          </AlertDialogHeader>
          {open && <ProofContent src={src} type={type} />}
          <AlertDialogFooter>
            <AlertDialogCancel>Tutup</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function ProofContent({ src, type, className }: { src: string; type: "image" | "pdf"; className?: string }) {
  if (type === "pdf") {
    return <iframe src={src} title="Bukti transfer (PDF)" className={cn("h-[70vh] w-full rounded-md border bg-white", className)} />;
  }
  return (
    <div className={cn("flex max-h-[70vh] justify-center overflow-auto", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- file privat dilayani route setelah cek hak akses */}
      <img src={src} alt="Bukti transfer" className="max-h-[70vh] w-auto rounded-md border bg-white object-contain" />
    </div>
  );
}
