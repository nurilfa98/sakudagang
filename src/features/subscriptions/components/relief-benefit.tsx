// Keterangan "Perlindungan bulan sepi" di kartu paket 6 bulan & 1 tahun dan
// panel pembayaran (BUSINESS-FLOW §14.8): ringkasan satu baris + syarat
// lengkap yang bisa dibuka (<details>, tanpa JavaScript). Angka diambil dari
// Pengaturan platform; yang mengikat adalah snapshot saat tagihan dibuat.

import { ShieldCheckIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { RELIEF_BASELINE_MONTHS, type ReliefRules } from "../relief";

export function ReliefBenefit({ rules, className }: { rules: ReliefRules; className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100",
        className,
      )}
    >
      <p className="flex items-center gap-1.5 font-medium">
        <ShieldCheckIcon className="size-4 shrink-0" />
        Perlindungan bulan sepi
      </p>
      <p>
        +{rules.days} hari masa aktif saat omzet sebulan turun {rules.dropPercent}% atau lebih (maks {rules.max}×
        selama paket).
      </p>
      <details className="group">
        <summary className="w-fit cursor-pointer font-medium underline-offset-2 hover:underline">
          <span className="group-open:hidden">Lihat syarat</span>
          <span className="hidden group-open:inline">Tutup syarat</span>
        </summary>
        <ul className="mt-1.5 flex list-disc flex-col gap-1 pl-4">
          <li>
            Omzet = total penjualan di kasir dalam satu bulan kalender, termasuk bon. Penjualan yang dibatalkan tidak
            dihitung.
          </li>
          <li>
            Dibandingkan dengan rata-rata omzet {RELIEF_BASELINE_MONTHS} bulan sebelumnya. Turun {rules.dropPercent}% atau
            lebih → masa aktif otomatis ditambah {rules.days} hari.
          </li>
          <li>
            Dinilai setiap awal bulan untuk bulan yang seluruhnya masuk masa paket, dan butuh penjualan tercatat di
            setiap {RELIEF_BASELINE_MONTHS} bulan sebelumnya.
          </li>
          <li>Berupa tambahan masa aktif, bukan pengembalian uang.</li>
          <li>Aturan ini dikunci saat tagihan dibuat; perubahan aturan sesudahnya tidak mengurangi hak Anda.</li>
        </ul>
      </details>
    </div>
  );
}
