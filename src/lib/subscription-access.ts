// Aturan akses toko berdasarkan masa langganan (BUSINESS-FLOW §14.3, §14.6).
// Di lib/ karena dipakai lib/auth/dal.ts (penentu akses) dan fitur
// subscriptions/stores. Fungsi murni, tanpa database; boleh dipakai browser.

const DAY_MS = 24 * 60 * 60 * 1000;

export type StoreAccessStatus = "TRIAL" | "ACTIVE" | "GRACE" | "EXPIRED";

export type StoreAccess = {
  status: StoreAccessStatus;
  until: Date; // akhir masa gratis/langganan (stores.subscription_until)
  graceUntil: Date; // until + masa tenggang
  // Hari tersisa sampai `until` (negatif bila sudah lewat), dibulatkan ke atas.
  daysLeft: number;
  // true = lewat masa tenggang: Pemilik hanya bisa membuka halaman Langganan,
  // Kasir tidak bisa login.
  locked: boolean;
  // true bila perlu spanduk pengingat (H-7 atau sedang masa tenggang).
  needsReminder: boolean;
};

// Spanduk pengingat mulai tampil H-7 sebelum masa berakhir.
export const REMINDER_DAYS = 7;

// `hasPaid` = pernah ada tagihan lunas (membedakan TRIAL vs ACTIVE; hanya
// untuk label, tidak memengaruhi akses).
export function getStoreAccess({
  subscriptionUntil,
  hasPaid,
  graceDays,
  now = new Date(),
}: {
  subscriptionUntil: Date;
  hasPaid: boolean;
  graceDays: number;
  now?: Date;
}): StoreAccess {
  const graceUntil = new Date(subscriptionUntil.getTime() + graceDays * DAY_MS);
  const daysLeft = Math.ceil((subscriptionUntil.getTime() - now.getTime()) / DAY_MS);
  const locked = now > graceUntil;
  const status: StoreAccessStatus = locked
    ? "EXPIRED"
    : now > subscriptionUntil
      ? "GRACE"
      : hasPaid
        ? "ACTIVE"
        : "TRIAL";
  return {
    status,
    until: subscriptionUntil,
    graceUntil,
    daysLeft,
    locked,
    needsReminder: status === "GRACE" || (!locked && daysLeft <= REMINDER_DAYS),
  };
}

export function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * DAY_MS);
}

// Tambah bulan kalender; tanggal 31 → akhir bulan tujuan bila tidak ada.
export function addMonths(date: Date, months: number) {
  const result = new Date(date);
  const day = result.getDate();
  result.setDate(1);
  result.setMonth(result.getMonth() + months);
  const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(day, lastDay));
  return result;
}

// Periode langganan baru: mulai dari akhir langganan yang sedang berjalan
// bila masih di masa depan (bayar lebih awal tidak rugi), bila sudah lewat
// mulai dari sekarang (§14.2 butir 4).
export function nextPeriod(currentUntil: Date, months: number, now = new Date()) {
  const startsAt = currentUntil > now ? currentUntil : now;
  return { startsAt, endsAt: addMonths(startsAt, months) };
}
