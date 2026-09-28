"use client";

import { useState, type FormEvent } from "react";
import { hardNavigate } from "@/components/auth/session-timer";

/**
 * Uncontrolled on purpose: the values are read from the form on submit, so anything typed before the page
 * finishes loading (slow phones) isn't wiped when React takes over.
 */
export function LoginForm() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setError(null);
    const response = await fetch("/api/auth/sign-in", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: data.get("email"), password: data.get("password") }) });
    const body = await response.json().catch(() => ({})) as { next?: string; error?: string };
    if (response.ok && body.next) { hardNavigate(body.next); return; }
    setBusy(false);
    (form.elements.namedItem("password") as HTMLInputElement).value = "";
    setError(body.error === "AUTH_NOT_CONFIGURED" ? "Sign-in isn't configured on this server yet." : "That email and password didn't match a staff account.");
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      <label htmlFor="email">Email</label>
      <input id="email" name="email" type="email" autoComplete="username" required />
      <label htmlFor="password">Password</label>
      <input id="password" name="password" type="password" autoComplete="current-password" required />
      {error && <p className="auth-error" role="alert">{error}</p>}
      <button type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
      <p className="auth-hint">New staff are invited by a platform administrator. There is no public sign-up.</p>
    </form>
  );
}
