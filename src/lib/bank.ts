// Format nomor rekening agar mudah dibaca (keputusan user 29 Okt 2026):
// strip otomatis saat mengetik, pola kelompok digit mengikuti kebiasaan
// tiap bank. Di database tetap disimpan angka saja (lib/validation,
// features/settings/schemas.ts), format hanya untuk tampilan & input.
//
// Pola per bank (dari cara bank menampilkan nomornya sendiri):
//   BCA     10 digit  123-456-7890        (3-3-4)
//   Mandiri 13 digit  123-00-1234567-8    (3-2-7-1)
//   BRI     15 digit  1234-01-012345-50-3 (4-2-6-2-1)
//   BNI     10 digit  1234-567-890        (4-3-3)
//   lainnya           kelompok 4 digit
// Bank dicocokkan dari nama yang diketik (mengandung "bca", "mandiri", …).

import { groupDigits } from "@/lib/phone";

const BANK_PATTERNS: { match: RegExp; groups: number[] }[] = [
  { match: /\bbca\b/i, groups: [3, 3, 4] },
  { match: /mandiri/i, groups: [3, 2, 7, 1] },
  { match: /\bbri\b/i, groups: [4, 2, 6, 2, 1] },
  { match: /\bbni\b/i, groups: [4, 3, 3] },
];

const MAX_ACCOUNT_DIGITS = 20;

export function formatAccountNumber(bankName: string | null | undefined, raw: string) {
  const digits = raw.replace(/\D/g, "").slice(0, MAX_ACCOUNT_DIGITS);
  const pattern = BANK_PATTERNS.find((bank) => bank.match.test(bankName ?? ""));
  if (!pattern) return groupDigits(digits, 4);

  const groups: string[] = [];
  let index = 0;
  for (const size of pattern.groups) {
    if (index >= digits.length) break;
    groups.push(digits.slice(index, index + size));
    index += size;
  }
  // Digit melebihi pola (nomor lebih panjang dari biasanya) menempel di akhir.
  if (index < digits.length) groups.push(digits.slice(index));
  return groups.join("-");
}
