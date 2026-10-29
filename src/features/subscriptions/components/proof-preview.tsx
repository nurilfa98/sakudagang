// Pratinjau bukti transfer (/api/subscriptions/[id]/proof) TANPA pindah
// halaman: thumbnail → klik → dialog berisi gambar ukuran penuh (atau PDF
// dalam bingkai tertanam). Dipakai kartu tagihan pemilik dan halaman Tagihan
// admin (mode "full" saat sudah berada di dalam dialog).

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
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ProofPreviewProps = {
  subscriptionId: string;
  type: "image" | "pdf";
  // "thumbnail": gambar kecil yang membuka dialog; "full": langsung ukuran
  // penuh (dipakai di dalam dialog lain, agar tidak ada dialog bertumpuk).
  mode?: "thumbnail" | "full";
  className?: string;
};

export function ProofPreview({ subscriptionId, type, mode = "thumbnail", className }: ProofPreviewProps) {
  const [open, setOpen] = useState(false);
  const src = `/api/subscriptions/${subscriptionId}/proof`;

  if (mode === "full") return <ProofContent src={src} type={type} className={className} />;

  return (
    <>
      {type === "pdf" ? (
        <Button variant="outline" size="sm" onClick={() => setOpen(true)} className={className}>
          <FileTextIcon />
          Lihat bukti transfer (PDF)
        </Button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn("group relative overflow-hidden rounded-md border bg-white", className)}
          aria-label="Perbesar bukti transfer"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- file privat dilayani route setelah cek hak akses */}
          <img src={src} alt="Bukti transfer" className="max-h-48 w-auto object-contain" />
          <span className="absolute inset-0 flex items-center justify-center bg-black/0 text-white opacity-0 transition group-hover:bg-black/30 group-hover:opacity-100">
            <ZoomInIcon className="size-6" />
          </span>
        </button>
      )}

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent className="max-w-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Bukti transfer</AlertDialogTitle>
          </AlertDialogHeader>
          <ProofContent src={src} type={type} />
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
