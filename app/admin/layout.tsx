import type { ReactNode } from "react";

import LogoutButton from "@/app/admin/logout-button";
import { Container } from "@/components/ui/container";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <Container className="flex items-center justify-between py-4">
          <span className="text-lg font-semibold">LUMA Admin</span>
          <LogoutButton />
        </Container>
      </header>
      <main className="mx-auto w-full max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
