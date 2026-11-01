// Ringkasan & riwayat Perlindungan bulan sepi satu toko (BUSINESS-FLOW §14.8):
// jatah paket yang sedang berjalan, lalu hasil penilaian tiap bulan (omzet,
// rata-rata 3 bulan sebelumnya, penurunan, hari yang ditambahkan). Dipakai di
// halaman Langganan (Pemilik) dan detail toko (Superadmin, `canRevoke` =
// tombol batalkan pada perlindungan yang sudah diberikan).

import { PLAN_LABELS } from "@/features/subscriptions/constants";
import type { ReliefItem, StoreReliefState } from "@/features/subscriptions/queries";
import { formatRupiah } from "@/lib/format";
import { RELIEF_BASELINE_MONTHS } from "../relief";
import { RevokeReliefButton } from "./revoke-relief-button";
import { ReliefStatusBadge } from "./subscription-badges";

export function ReliefHistory({ state, canRevoke = false }: { state: StoreReliefState; canRevoke?: boolean }) {
  const { current, history } = state;
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        {current ? (
          <>
            Paket {PLAN_LABELS[current.months]} ({current.periodLabel}): jatah terpakai{" "}
            <span className="font-medium text-foreground">
              {current.used} dari {current.max}
            </span>
            . Masa aktif ditambah {current.days} hari setiap kali omzet sebulan turun {current.dropPercent}% atau lebih
            dari rata-rata {RELIEF_BASELINE_MONTHS} bulan sebelumnya.
          </>
        ) : (
          "Tidak ada paket 6 bulan / 1 tahun dengan perlindungan yang sedang berjalan."
        )}
      </p>
      {history.length > 0 && (
        <ul className="flex flex-col divide-y rounded-lg border">
          {history.map((item) => (
            <li key={item.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
              <div className="flex min-w-0 flex-col gap-0.5">
                <p className="text-sm font-medium">{item.periodLabel}</p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  Omzet {formatRupiah(item.revenue)} · rata-rata {RELIEF_BASELINE_MONTHS} bulan sebelumnya{" "}
                  {formatRupiah(item.baselineRevenue)} · {changeLabel(item)}
                </p>
                {(item.status === "GRANTED" || item.status === "REVOKED") && (
                  <p className="text-xs">
                    +{item.days} hari{item.untilAfterLabel ? `, masa aktif menjadi s.d. ${item.untilAfterLabel}` : ""}
                    {item.status === "REVOKED" && item.revokeNote && (
                      <span className="text-rose-700 dark:text-rose-300">. Dibatalkan: {item.revokeNote}</span>
                    )}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <ReliefStatusBadge status={item.status} />
                {canRevoke && item.status === "GRANTED" && <RevokeReliefButton relief={item} />}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function changeLabel(item: ReliefItem) {
  if (item.dropPercent == null) return `data ${RELIEF_BASELINE_MONTHS} bulan sebelumnya belum cukup`;
  if (item.dropPercent < 0) return `naik ${-item.dropPercent}%`;
  return `turun ${item.dropPercent}%`;
}
