// Data awal yang disalin ke setiap toko baru (docs/DATABASE-SCHEMA.md §9).
// Diletakkan di lib/ karena dipakai dua fitur: stores (saat toko dibuat) dan
// products (sebagai acuan). Diisi lewat action "buat toko", bukan migration,
// karena per toko.

export const DEFAULT_PRODUCT_CATEGORIES = [
  "Sembako",
  "Minuman",
  "Makanan ringan",
  "Rokok",
  "Kebutuhan rumah",
  "Lainnya",
] as const;

export const DEFAULT_EXPENSE_CATEGORIES = [
  "Listrik & air",
  "Transport",
  "Kemasan/plastik",
  "Gaji",
  "Sewa",
  "Lainnya",
] as const;
