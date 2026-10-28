// Daftar role disimpan sebagai konstanta (bukan string bebas) supaya TypeScript
// menangkap typo seperti "OWNERR". File ini TIDAK memakai `server-only`
// karena Client Component juga boleh memakainya, misalnya untuk menyembunyikan
// tombol. Ingat: menyembunyikan tombol bukan pengaman, pengecekan sebenarnya
// tetap di server (lib/auth/dal.ts).
//
// Arti tiap role ada di docs/BUSINESS-FLOW.md §2:
// - SUPERADMIN: admin platform SakuDagang (developer), dibuat lewat script,
//   tersembunyi dari daftar pengguna, tidak terikat toko; membuat toko & akun Pemilik.
// - OWNER: pemilik toko, semua hak operasional + kelola Kasir.
// - CASHIER: kasir, mencatat penjualan & bon, tidak melihat harga modal/laba.

export const ROLES = ["SUPERADMIN", "OWNER", "CASHIER"] as const;

export type Role = (typeof ROLES)[number];

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

// Nama role yang tampil di UI. Kode tetap memakai nilai aslinya.
export const ROLE_LABELS: Record<Role, string> = {
  SUPERADMIN: "Superadmin",
  OWNER: "Pemilik",
  CASHIER: "Kasir",
};
