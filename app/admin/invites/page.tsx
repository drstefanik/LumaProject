"use client";

import { useState } from "react";

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
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Invite Admin</h1>
        <p className="mt-2 text-sm text-slate-500">
          Generate a one-time OTP for a new admin account.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-xl border border-slate-200 bg-white p-6"
      >
        <label className="block text-sm font-medium text-slate-700">
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-slate-400 focus:outline-none"
            required
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Role
          <select
            value={role}
            onChange={(event) => setRole(event.target.value)}
            className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-slate-400 focus:outline-none"
          >
            <option value="admin">admin</option>
            <option value="reviewer">reviewer</option>
          </select>
        </label>
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {loading ? "Creating..." : "Create Invite"}
        </button>
      </form>

      {result ? (
        result.ok ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-sm text-emerald-700">
            <p className="font-semibold">OTP created</p>
            <p className="mt-2 text-lg font-mono tracking-widest text-emerald-900">
              {result.otp}
            </p>
            <p className="mt-3 text-sm text-emerald-700">
              OTP expires in 24 hours.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {result.error ?? "Unable to create invite."}
          </div>
        )
      ) : null}
    </section>
  );
}
