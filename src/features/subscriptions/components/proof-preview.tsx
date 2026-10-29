// Pratinjau bukti transfer (/api/subscriptions/[id]/proof) TANPA pindah
// halaman: kotak kecil (thumbnail) → klik → dialog berisi gambar ukuran penuh
// (atau PDF dalam bingkai tertanam). Dipakai kartu tagihan pemilik dan
// halaman Tagihan admin (mode "full" saat sudah berada di dalam dialog).
//
// Bukti transaksi lama boleh dibersihkan manual dari bucket R2 (hemat kuota).
// Saat dialog dibuka, keberadaan berkas dicek dulu (HEAD ke route); bila
// sudah tidak ada, tampil "Transaksi sudah selesai" alih-alih gambar rusak.

"use client";

import { CheckCircle2Icon, FileTextIcon, LoaderCircleIcon, ZoomInIcon } from "lucide-react";
import { useEffect, useState } from "react";
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
  subscriptionId: string;
  type: "image" | "pdf";
  // "thumbnail": kotak kecil yang membuka dialog; "full": langsung isi
  // pratinjau (dipakai di dalam dialog lain, agar tidak ada dialog bertumpuk).
  mode?: "thumbnail" | "full";
  className?: string;
};

export function ProofPreview({ subscriptionId, type, mode = "thumbnail", className }: ProofPreviewProps) {
  const [open, setOpen] = useState(false);
  // Gambar thumbnail gagal dimuat = berkas sudah dibersihkan dari bucket.
  const [missing, setMissing] = useState(false);
  const src = `/api/subscriptions/${subscriptionId}/proof`;

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
        {missing ? (
          <CheckCircle2Icon className="size-6 text-emerald-600 dark:text-emerald-400" />
        ) : type === "pdf" ? (
          <FileTextIcon className="size-7 text-muted-foreground" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- file privat dilayani route setelah cek hak akses
          <img src={src} alt="Bukti transfer" className="size-full object-cover" onError={() => setMissing(true)} />
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

type Availability = "checking" | "available" | "missing";

function ProofContent({ src, type, className }: { src: string; type: "image" | "pdf"; className?: string }) {
  const [availability, setAvailability] = useState<Availability>("checking");

  // HEAD ke route: 404 = berkas sudah dibersihkan. Di R2 route menjawab
  // redirect ke presigned URL; dengan redirect "manual" fetch mengembalikan
  // respons opaqueredirect (status 0) yang berarti berkas ada.
  useEffect(() => {
    let cancelled = false;
    fetch(src, { method: "HEAD", redirect: "manual", cache: "no-store" })
      .then((response) => {
        if (cancelled) return;
        const missing = response.type !== "opaqueredirect" && !response.ok;
        setAvailability(missing ? "missing" : "available");
      })
      .catch(() => !cancelled && setAvailability("missing"));
    return () => {
      cancelled = true;
    };
  }, [src]);

  if (availability === "checking") {
    return (
      <div className={cn("flex h-40 items-center justify-center text-sm text-muted-foreground", className)}>
        <LoaderCircleIcon className="mr-2 size-4 animate-spin" />
        Memuat bukti...
      </div>
    );
  }

  if (availability === "missing") {
    return (
      <div className={cn("flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-8 text-center", className)}>
        <CheckCircle2Icon className="size-8 text-emerald-600 dark:text-emerald-400" />
        <p className="font-medium">Transaksi sudah selesai</p>
        <p className="text-sm text-muted-foreground">Bukti transfer untuk transaksi lampau sudah dibersihkan dari penyimpanan.</p>
      </div>
    );
  }

  if (type === "pdf") {
    return <iframe src={src} title="Bukti transfer (PDF)" className={cn("h-[70vh] w-full rounded-md border bg-white", className)} />;
  }
  return (
    <div className={cn("flex max-h-[70vh] justify-center overflow-auto", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- file privat dilayani route setelah cek hak akses */}
      <img
        src={src}
        alt="Bukti transfer"
        className="max-h-[70vh] w-auto rounded-md border bg-white object-contain"
        onError={() => setAvailability("missing")}
      />
    </div>
  );
}
