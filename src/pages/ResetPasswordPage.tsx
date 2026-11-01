import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

export function ResetPasswordPage() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [recoveryParams, setRecoveryParams] = useState<{ hasRecovery: boolean; accessToken?: string }>({ hasRecovery: false });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#\/?/, ""));
    for (const [key, value] of hashParams.entries()) {
      if (!params.has(key)) {
        params.set(key, value);
      }
    }

    const type = params.get("type");
    const accessToken = params.get("access_token") ?? undefined;
    setRecoveryParams({ hasRecovery: type === "recovery" && !!accessToken, accessToken });
  }, []);

  async function handleSubmit() {
    setError(null);
    setMessage(null);

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setLoading(true);
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) {
        throw updateError;
      }
      setMessage("Password reset successful. Signing out temporary recovery session...");
      await supabase.auth.signOut();
      if (typeof window !== "undefined") {
        const keysToRemove: string[] = [];
        [window.sessionStorage, window.localStorage].forEach((storage) => {
          for (let i = 0; i < storage.length; i += 1) {
            const key = storage.key(i);
            if (!key) continue;
            if (key.startsWith("sb-") || key.includes("supabase") || key.includes("auth")) {
              keysToRemove.push(key);
            }
          }
        });
        keysToRemove.forEach((key) => {
          window.sessionStorage.removeItem(key);
          window.localStorage.removeItem(key);
        });
        window.history.replaceState({}, "", "/login");
        window.location.replace("/login");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to reset password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="portal-reset-screen">
      <div className="portal-reset-card">
        <h1 className="text-2xl font-bold mb-4">Reset Password</h1>
        <p className="text-sm mb-6 text-slate-600">Enter a new password to complete your recovery.</p>
        {error && <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
        {message && <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{message}</div>}
        <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void handleSubmit(); }}>
          <label htmlFor="reset-new-password" className="block text-sm font-medium text-slate-700">New Password</label>
          <input
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none"
            placeholder="Enter new password"
          />
          <label htmlFor="reset-confirm-password" className="block text-sm font-medium text-slate-700">Confirm Password</label>
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
