// Konstanta fitur: status, enum, label. Pakai `as const` supaya TypeScript
// menangkap typo, dan turunkan tipenya dari array:
//
//   export const EXAMPLE_STATUSES = ["DRAFT", "ACTIVE"] as const;
//   export type ExampleStatus = (typeof EXAMPLE_STATUSES)[number];
//
// File ini boleh diimpor Client Component (tidak memakai `server-only`).

export {};
