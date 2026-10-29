// Konstanta fitur toko yang dipakai server & browser.

// Zona waktu Indonesia. Nilai = nama IANA (dipakai Intl.DateTimeFormat),
// label = sebutan yang dikenal user.
export const TIMEZONES = [
  { value: "Asia/Jakarta", label: "WIB (Jawa, Sumatra, Kalimantan Barat)" },
  { value: "Asia/Makassar", label: "WITA (Bali, NTB, NTT, Sulawesi, Kalimantan Timur)" },
  { value: "Asia/Jayapura", label: "WIT (Maluku, Papua)" },
] as const;

export type Timezone = (typeof TIMEZONES)[number]["value"];

export const TIMEZONE_VALUES = TIMEZONES.map((tz) => tz.value) as [Timezone, ...Timezone[]];

// Contoh jenis usaha untuk saran isian (datalist); user tetap boleh mengetik bebas.
export const BUSINESS_TYPE_SUGGESTIONS = [
  "Warung sembako",
  "Toko kelontong",
  "Toko bangunan",
  "Toko pertanian",
  "Toko ATK",
  "Minimarket",
] as const;
