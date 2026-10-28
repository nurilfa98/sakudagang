// Halaman beranda (/). Sidebar & navbar sudah disediakan oleh (app)/layout.tsx,
// jadi page cukup berisi konten halaman ini.
//
// Polanya untuk halaman berisi data: judul statis di luar <Suspense>, bagian
// yang membaca user & database di dalamnya (komponen async + verifySession()).

import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { PRODUCT_NAME } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Beranda",
};

export default function HomePage() {
  return <PageHeader title={`Selamat datang di ${PRODUCT_NAME}`} />;
}
