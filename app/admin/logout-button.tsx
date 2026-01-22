"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { adminTokens } from "@/lib/ui/tokens";

export default function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    setLoading(true);
    try {
      await fetch("/api/admin/logout", { method: "POST" });
      router.push("/admin/login");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loading}
      className={adminTokens.buttonSecondary}
    >
      {loading ? "Signing out..." : "Logout"}
    </button>
  );
}
