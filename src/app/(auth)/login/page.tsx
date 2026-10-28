// Halaman /login. Folder (auth) adalah route group: tanda kurung membuat nama
// folder tidak masuk ke URL, tapi halaman ini memakai (auth)/layout.tsx.
//
// page.tsx sengaja dibuat tipis: hanya menyusun komponen dari features/auth.
// Form login belum dibuat; buat features/auth/components/login-form.tsx
// (useActionState + action login) lalu pasang di CardContent di bawah.
//
// Referensi: node_modules/next/dist/docs/01-app/01-getting-started/02-project-structure.md
// (bagian "Route groups")

import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Masuk",
};

export default function LoginPage() {
  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Masuk ke akun Anda</CardTitle>
        <CardDescription>Gunakan email dan password Anda.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-center text-sm text-muted-foreground">Form login belum dibuat.</p>
      </CardContent>
    </Card>
  );
}
