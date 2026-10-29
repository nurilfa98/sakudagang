// Tombol "Reset password" dan "Nonaktifkan/Aktifkan" di halaman detail
// pengguna. Keduanya berdampak besar, jadi selalu meminta konfirmasi.
// Password sementara hasil reset ditampilkan sekali di bawah tombol.

"use client";

import { useState } from "react";
import { ActionRow, ConfirmButton } from "@/components/confirm-button";
import { resetUserPassword, setUserActive, type EmailStatus } from "@/features/users/actions";
import type { UserDetail } from "@/features/users/queries";
import { notify } from "@/lib/notify";
import { TemporaryPasswordAlert } from "./temporary-password-alert";

export function UserAccountActions({ user, isSelf }: { user: UserDetail; isSelf: boolean }) {
  const [reset, setReset] = useState<{ temporaryPassword: string; emailSent: EmailStatus }>();

  async function handleReset() {
    const result = await resetUserPassword(user.id);
    if (!result.success) notify.error(result.message);
    else setReset(result.data);
  }

  async function handleToggleActive() {
    const result = await setUserActive(user.id, !user.isActive);
    if (!result.success) notify.error(result.message);
    else notify.success(user.isActive ? "Akun dinonaktifkan." : "Akun diaktifkan kembali.");
  }

  return (
    <div className="flex flex-col gap-4">
      <ActionRow
        title="Reset password"
        description={
          isSelf
            ? "Untuk akun sendiri, gunakan menu Ganti password di pojok kanan atas."
            : !user.isActive
              ? "Aktifkan akun terlebih dahulu untuk me-reset password."
              : "Buat password sementara baru (dikirim ke email bila emailnya aktif). Pengguna akan keluar dari semua perangkat."
        }
      >
        <ConfirmButton
          label="Reset password"
          variant="outline"
          disabled={isSelf || !user.isActive}
          dialogTitle={`Reset password ${user.fullName}?`}
          dialogDescription="Password lama tidak berlaku lagi. Password sementara baru akan ditampilkan sekali untuk Anda sampaikan ke pengguna."
          confirmLabel="Reset password"
          onConfirm={handleReset}
        />
      </ActionRow>

      {reset && (
        <TemporaryPasswordAlert
          title="Password berhasil di-reset"
          userId={user.id}
          fullName={user.fullName}
          email={user.email}
          phone={user.phone}
          password={reset.temporaryPassword}
          emailSent={reset.emailSent}
          kind="reset"
        />
      )}

      <ActionRow
        title={user.isActive ? "Nonaktifkan akun" : "Aktifkan akun"}
        description={
          isSelf
            ? "Anda tidak bisa menonaktifkan akun sendiri."
            : user.isActive
              ? "Pengguna tidak bisa login, dan sesi yang sedang berjalan langsung berhenti. Data & riwayatnya tetap tersimpan."
              : "Pengguna bisa login kembali dengan password terakhirnya."
        }
      >
        <ConfirmButton
          label={user.isActive ? "Nonaktifkan" : "Aktifkan"}
          variant={user.isActive ? "destructive" : "outline"}
          disabled={isSelf}
          dialogTitle={user.isActive ? `Nonaktifkan ${user.fullName}?` : `Aktifkan ${user.fullName}?`}
          dialogDescription={
            user.isActive
              ? "Pengguna langsung tidak bisa memakai aplikasi. Anda bisa mengaktifkannya kembali kapan saja."
              : "Pengguna bisa login kembali."
          }
          confirmLabel={user.isActive ? "Nonaktifkan" : "Aktifkan"}
          onConfirm={handleToggleActive}
        />
      </ActionRow>
    </div>
  );
}
