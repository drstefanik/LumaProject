import type { ReactNode } from "react";

import AdminHeader from "@/app/admin/admin-header";
import { adminTokens } from "@/lib/ui/tokens";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className={adminTokens.page}>
      <div className={adminTokens.backgroundLayer}>
        <div className={adminTokens.backgroundGradient} />
        <div className={adminTokens.glowTopLeft} />
        <div className={adminTokens.glowBottomCenter} />
        <div className={adminTokens.glowTopRight} />
      </div>

      <div className={adminTokens.container}>
        <AdminHeader />
        <main className={adminTokens.contentCard}>{children}</main>
      </div>
    </div>
  );
}
