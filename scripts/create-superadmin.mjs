// Membuat akun SUPERADMIN (admin platform SakuDagang), karena tidak ada
// halaman daftar. Superadmin tidak terikat toko (store_id null). Akun ini
// tersembunyi dari daftar pengguna di aplikasi dan hanya bisa dibuat/diubah
// lewat script ini (docs/BUSINESS-FLOW.md §2 & §11).
//
// Cara pakai (jalankan setelah pnpm db:migrate):
//   pnpm db:create-superadmin dev@email.com passwordRahasia "Nama Developer"
//
// Aman dijalankan ulang: bila email sudah ada, nama & password diperbarui,
// akun diaktifkan kembali, dan session lama di semua perangkat dibatalkan.
//
// Catatan: password yang diketik di terminal tersimpan di riwayat shell.
// Akun Pemilik dibuat Superadmin dari halaman Pengguna di aplikasi.

import nextEnv from "@next/env";
import bcrypt from "bcryptjs";
import postgres from "postgres";

nextEnv.loadEnvConfig(process.cwd());

const [email, password, fullName = "Superadmin"] = process.argv.slice(2);

if (!email || !password) {
  console.error('Cara pakai: pnpm db:create-superadmin <email> <password> ["Nama Lengkap"]');
  process.exit(1);
}
if (password.length < 8) {
  console.error("Password minimal 8 karakter.");
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL belum diisi di .env");
  process.exit(1);
}

const sql = postgres(process.env.DATABASE_URL);

try {
  // Cost 12, sama dengan src/lib/auth/password.ts
  const passwordHash = await bcrypt.hash(password, 12);
  const normalizedEmail = email.trim().toLowerCase();

  // Transaksi: user dan role-nya tersimpan bersamaan, atau tidak sama sekali.
  const [{ id, created }] = await sql.begin(async (tx) => {
    // Superadmin tidak perlu mengganti password sementara: dialah yang
    // memilih passwordnya sendiri di sini.
    const [row] = await tx`
      insert into users (id, full_name, email, password_hash, must_change_password)
      values (${crypto.randomUUID()}, ${fullName}, ${normalizedEmail}, ${passwordHash}, false)
      on conflict (email) do update set
        full_name = excluded.full_name,
        password_hash = excluded.password_hash,
        must_change_password = false,
        is_active = true,
        session_version = users.session_version + 1
      returning id, (xmax = 0) as created`;
    await tx`
      insert into user_roles (user_id, role_id)
      select ${row.id}, id from roles where name = 'SUPERADMIN'
      on conflict do nothing`;
    return [row];
  });

  console.log(`✓ Akun SUPERADMIN ${created ? "dibuat" : "diperbarui"}: ${normalizedEmail} (${id})`);
} finally {
  await sql.end();
}
