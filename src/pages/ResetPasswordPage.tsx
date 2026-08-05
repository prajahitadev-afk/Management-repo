import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

export function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [recoveryParams, setRecoveryParams] = useState<{ hasRecovery: boolean; accessToken?: string }>({ hasRecovery: false });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const type = params.get("type");
    const accessToken = params.get("access_token") ?? undefined;
    setRecoveryParams({ hasRecovery: type === "recovery" && !!accessToken, accessToken });
  }, []);

  async function handleSubmit() {
    setError(null);
    setMessage(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setLoading(true);
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        throw updateError;
      }
      setMessage("Password reset successful. Redirecting to login...");
      window.setTimeout(() => {
        window.location.href = "/";
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to reset password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "#F7E7CB" }}>
      <div className="w-full max-w-md rounded-3xl p-8" style={{ background: "rgba(255,255,255,0.95)", boxShadow: "0 24px 80px rgba(0,0,0,0.08)" }}>
        <h1 className="text-2xl font-bold mb-4">Reset Password</h1>
        <p className="text-sm mb-6 text-slate-600">Enter a new password to complete your recovery.</p>
        {error && <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
        {message && <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{message}</div>}
        <div className="space-y-4">
          <label className="block text-sm font-medium text-slate-700">New Password</label>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none"
            placeholder="Enter new password"
          />
          <label className="block text-sm font-medium text-slate-700">Confirm Password</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none"
            placeholder="Confirm new password"
          />
        </div>
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="mt-6 w-full rounded-2xl bg-[#4E8050] px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
        >
          {loading ? "Updating password..." : "Update Password"}
        </button>
      </div>
    </div>
  );
}
