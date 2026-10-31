// Layout halaman platform Superadmin (route group "(platform)", tanpa
// mengubah URL): /stores, /billing, /settings. Menambahkan tab di atas halaman
// untuk berpindah antarhalaman platform (pola sama dengan ArchiPay).
//
// Pemilik juga membuka /stores/[id] (data tokonya sendiri); untuknya tab
// tidak tampil. Setiap page tetap mengecek hak akses sendiri; layout ini
// hanya tampilan.
//
// Referensi: node_modules/next/dist/docs/01-app/01-getting-started/02-project-structure.md (Route groups)

import { Suspense } from "react";
import { PlatformNav } from "@/components/layout/platform-nav";
import { countPendingSubscriptions } from "@/features/subscriptions/queries";
import { verifySession } from "@/lib/auth/dal";
import { can } from "@/lib/auth/permissions";

export default function PlatformLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <Suspense>
        <PlatformTabs />
      </Suspense>
      {children}
    </>
  );
}

async function PlatformTabs() {
  const user = await verifySession({ allowLocked: true });
  if (!can(user, "store:manage")) return null;
  return <PlatformNav pending={await countPendingSubscriptions()} />;
}
