// Logo SakuDagang: saku (kantong) dengan koin emas yang masuk ke dalamnya,
// di atas latar sky. Gambar yang sama dengan ikon aplikasi di layar HP
// (src/app/icon.svg → pnpm icons:generate); kalau logo diubah, ubah keduanya.
//
// Ukuran diatur lewat className (misal "size-8").
//
// ID gradien dibuat unik per logo (useId). Bila satu halaman punya dua logo
// dengan ID sama, browser memakai gradien milik logo pertama; kalau logo itu
// tersembunyi (display:none, misal info login versi PC saat dibuka di HP),
// gradiennya tidak digambar dan logo lain ikut kehilangan warna.

import { useId } from "react";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  const id = useId();
  const bg = `${id}-bg`;
  const shine = `${id}-shine`;
  const coin = `${id}-coin`;

  return (
    <svg viewBox="0 0 512 512" aria-hidden="true" className={cn("shrink-0", className)}>
      <defs>
        <linearGradient id={bg} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#0ea5e9" />
          <stop offset="1" stopColor="#075985" />
        </linearGradient>
        <radialGradient id={shine} cx=".25" cy=".15" r=".8">
          <stop offset="0" stopColor="#fff" stopOpacity=".22" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={coin} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fde68a" />
          <stop offset="1" stopColor="#f59e0b" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="112" fill={`url(#${bg})`} />
      <rect width="512" height="512" rx="112" fill={`url(#${shine})`} />
      <circle cx="256" cy="180" r="56" fill={`url(#${coin})`} />
      <circle cx="256" cy="180" r="37" fill="none" stroke="#b45309" strokeOpacity=".35" strokeWidth="7" />
      <path
        d="M140 206 H372 V312 L256 378 L140 312 Z"
        fill="#fff"
        stroke="#fff"
        strokeWidth="28"
        strokeLinejoin="round"
      />
      <path
        d="M166 240 H346"
        stroke="#0284c7"
        strokeOpacity=".45"
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray="1 18"
      />
    </svg>
  );
}
