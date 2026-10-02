"use client";

import { useState, type FormEvent } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { hardNavigate } from "@/components/auth/session-timer";

/**
 * After following an invite or password-reset email: choose a password, then set up or pass MFA.
 * Uncontrolled inputs (read on submit), so typing before the page finishes loading isn't wiped by hydration.
 */
export default function SetPasswordPage() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    if (password !== String(form.get("confirm") ?? "")) return setError("The two passwords don't match.");
    setBusy(true);
    setError(null);
    const response = await fetch("/api/auth/set-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
    const body = await response.json().catch(() => ({})) as { next?: string; error?: string; detail?: string };
    if (response.ok && body.next) { hardNavigate(body.next); return; }
    setBusy(false);
    setError(body.error === "PASSWORD_TOO_SHORT" ? "Use at least 12 characters." : body.error === "UNAUTHENTICATED" ? "This link has expired. Ask a platform administrator for a new invite." : body.detail ?? "That password was rejected. Try a longer one.");
  }

  return (
    <AuthShell title="Choose your password" lead="At least 12 characters. A password manager is the easiest way to keep it strong and unique.">
      <form className="auth-form" onSubmit={submit}>
        <label htmlFor="new-password">New password</label>
        <input id="new-password" type="password" autoComplete="new-password" name="password" minLength={12} required />
        <label htmlFor="confirm-password">Confirm password</label>
        <input id="confirm-password" type="password" autoComplete="new-password" name="confirm" minLength={12} required />
        {error && <p className="auth-error" role="alert">{error}</p>}
        <button type="submit" disabled={busy}>{busy ? "Saving…" : "Save and continue"}</button>
      </form>
    </AuthShell>
  );
}
