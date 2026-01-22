"use client";

import { usePathname } from "next/navigation";

import LogoutButton from "@/app/admin/logout-button";
import { adminTokens } from "@/lib/ui/tokens";

const headerCopy = [
  {
    match: (path: string) => path.startsWith("/admin/reports"),
    title: "Admin / Reports",
    subtitle: "Review candidate reports and manage PDF exports.",
  },
  {
    match: (path: string) => path.startsWith("/admin/invites"),
    title: "Admin / Invites",
    subtitle: "Generate one-time OTP invites for new admin accounts.",
  },
  {
    match: (path: string) => path.startsWith("/admin/login"),
    title: "Admin / Login",
    subtitle: "Enter your admin credentials to manage reports.",
  },
  {
    match: (path: string) => path.startsWith("/admin/signup"),
    title: "Admin / Signup",
    subtitle: "Use your OTP invite to create an admin login.",
  },
];

export default function AdminHeader() {
  const pathname = usePathname() ?? "/admin";
  const current =
    headerCopy.find((item) => item.match(pathname)) ??
    ({
      title: "LUMA Admin",
      subtitle: "Manage reports and admin actions.",
    } as const);

  const showLogout = !pathname.startsWith("/admin/login") && !pathname.startsWith("/admin/signup");

  return (
    <header className={`flex flex-wrap items-start justify-between gap-6 ${adminTokens.pageHeader}`}>
      <div className="space-y-2">
        <p className={adminTokens.headerKicker}>LUMA Admin</p>
        <h1 className={adminTokens.headerTitle}>{current.title}</h1>
        <p className={adminTokens.headerSubtitle}>{current.subtitle}</p>
      </div>
      {showLogout ? <LogoutButton /> : null}
    </header>
  );
}
