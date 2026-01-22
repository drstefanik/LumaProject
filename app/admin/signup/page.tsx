"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { adminTokens } from "@/lib/ui/tokens";

export default function AdminSignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/admin/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp, password, fullName }),
      });
      const data = await response.json();

      if (data.ok) {
        setSuccess("Account created. Redirecting to sign in...");
        setTimeout(() => router.push("/admin/login"), 1200);
        return;
      }

      setError(data.error ?? "Unable to create account.");
    } catch (err) {
      setError("Unable to create account.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex justify-center">
      <div className={`w-full max-w-md ${adminTokens.card}`}>
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold text-white">Create Admin Account</h2>
          <p className={`text-sm ${adminTokens.mutedText}`}>
            Use your OTP invite to create an admin login.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="mt-6 space-y-6">
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
            OTP
            <input
              type="text"
              value={otp}
              onChange={(event) => setOtp(event.target.value)}
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
          <label className={`block ${adminTokens.label}`}>
            Confirm Password
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className={`w-full ${adminTokens.input}`}
              required
            />
          </label>
          <label className={`block ${adminTokens.label}`}>
            Full Name
            <input
              type="text"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              className={`w-full ${adminTokens.input}`}
              required
            />
          </label>
          {error ? <p className={adminTokens.errorNotice}>{error}</p> : null}
          {success ? <p className={adminTokens.successNotice}>{success}</p> : null}
          <button
            type="submit"
            disabled={loading}
            className={`w-full justify-center ${adminTokens.buttonPrimary}`}
          >
            {loading ? "Creating..." : "Create Account"}
          </button>
        </form>
      </div>
    </div>
  );
}
