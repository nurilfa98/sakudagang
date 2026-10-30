// /reports → laporan harian (menu "Laporan" menyorot ketiga jenis laporan).

import { redirect } from "next/navigation";

export default function ReportsPage() {
  redirect("/reports/daily");
}
