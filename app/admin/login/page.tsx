"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { AdminStack } from "@/components/admin/AdminStack";
import { adminTokens } from "@/lib/ui/tokens";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();

      if (data.ok) {
        router.push("/admin/reports");
        return;
      }

      setError(data.error ?? "Unable to sign in");
    } catch (err) {
      setError("Unable to sign in");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section>
      <AdminStack>
        <div className="flex justify-center">
          <div className={`w-full max-w-md ${adminTokens.pageHeader}`}>
            <h2 className="text-2xl font-semibold text-white">Admin Sign In</h2>
            <p className={`text-sm ${adminTokens.mutedText}`}>
              Enter your admin credentials to manage reports.
            </p>
          </div>
        </div>

        <div className="flex justify-center">
          <div className={`w-full max-w-md ${adminTokens.card}`}>
            <form onSubmit={handleSubmit} className="space-y-6">
              <label className={`block ${adminTokens.label}`}>
                Email
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className={`w-full ${adminTokens.input}`}
                  required
                />
              </label>
              <label className={`block ${adminTokens.label}`}>
                Password
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className={`w-full ${adminTokens.input}`}
                  required
                />
              </label>
              {error ? <p className={adminTokens.errorNotice}>{error}</p> : null}
              <button
                type="submit"
                disabled={loading}
                className={`w-full justify-center ${adminTokens.buttonPrimary}`}
              >
                {loading ? "Signing in..." : "Sign In"}
              </button>
            </form>
          </div>
        </div>
      </AdminStack>
    </section>
  );
}
