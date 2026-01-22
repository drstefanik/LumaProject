"use client";

import { useState } from "react";

import { adminTokens } from "@/lib/ui/tokens";

type InviteResponse = {
  ok: boolean;
  otp?: string;
  expiresAt?: string;
  error?: string;
};

export default function AdminInvitesPage() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("admin");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<InviteResponse | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch("/api/admin/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      const data = (await response.json()) as InviteResponse;
      setResult(data);
    } catch (err) {
      setResult({ ok: false, error: "Unable to create invite." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="space-y-8 lg:space-y-10">
      <form onSubmit={handleSubmit} className={`space-y-6 ${adminTokens.card}`}>
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold text-white">Invite Admin</h2>
          <p className={`text-sm ${adminTokens.mutedText}`}>
            Generate a one-time OTP for a new admin account.
          </p>
        </div>
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
          Role
          <select
            value={role}
            onChange={(event) => setRole(event.target.value)}
            className={`w-full ${adminTokens.select}`}
          >
            <option value="admin">admin</option>
            <option value="reviewer">reviewer</option>
          </select>
        </label>
        <button
          type="submit"
          disabled={loading}
          className={adminTokens.buttonPrimary}
        >
          {loading ? "Creating..." : "Create Invite"}
        </button>
      </form>

      {result ? (
        result.ok ? (
          <div className={adminTokens.successNotice}>
            <p className="font-semibold text-emerald-100">OTP created</p>
            <p className="mt-2 text-lg font-mono tracking-widest text-emerald-50">
              {result.otp}
            </p>
            <p className="mt-3 text-sm text-emerald-100">
              OTP expires in 24 hours.
            </p>
          </div>
        ) : (
          <div className={adminTokens.errorNotice}>
            {result.error ?? "Unable to create invite."}
          </div>
        )
      ) : null}
    </section>
  );
}
