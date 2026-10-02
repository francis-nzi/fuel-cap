"use client";

import { useEffect, useState, type FormEvent } from "react";
import { hardNavigate } from "./session-timer";

type Enrolment = { factorId: string; qrCode: string; secret: string };

function CodeField({ value, onChange, id = "mfa-code" }: { value: string; onChange: (code: string) => void; id?: string }) {
  return <>
    <label htmlFor={id}>6-digit code</label>
    <input id={id} value={value} onChange={(event) => onChange(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" required />
  </>;
}

/** Scan-and-confirm enrolment of an authenticator app (first sign-in, or adding a backup authenticator). */
export function EnrolAuthenticator({ onDone, backup = false }: { onDone: () => void; backup?: boolean }) {
  const [enrolment, setEnrolment] = useState<Enrolment | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/mfa/enroll", { method: "POST" }).then(async (response) => {
      const body = await response.json().catch(() => ({})) as Enrolment & { error?: string };
      if (cancelled) return;
      if (response.ok) setEnrolment(body);
      else setError("Couldn't start authenticator setup. Refresh the page to try again.");
    });
    return () => { cancelled = true; };
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!enrolment) return;
    setBusy(true);
    setError(null);
    const response = await fetch("/api/auth/mfa/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ factorId: enrolment.factorId, code }) });
    setBusy(false);
    if (response.ok) return onDone();
    setCode("");
    setError("That code didn't match. Wait for the next code in your app and try again.");
  }

  return <form className="auth-form" onSubmit={submit} aria-label={backup ? "Add a backup authenticator" : "Set up your authenticator app"}>
    <ol className="auth-steps">
      <li>Open an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password, Authy…).</li>
      <li>Scan this QR code, or type the setup key.</li>
      <li>Enter the 6-digit code the app shows.</li>
    </ol>
    {enrolment ? <div className="auth-qr">
      {/* eslint-disable-next-line @next/next/no-img-element -- Supabase returns the QR code as an SVG data URI */}
      <img src={enrolment.qrCode} alt="QR code for your authenticator app" width={180} height={180} />
      <p>Setup key: <code data-testid="totp-secret">{enrolment.secret}</code></p>
    </div> : !error && <p className="auth-hint" role="status">Preparing your QR code…</p>}
    <CodeField value={code} onChange={setCode} />
    {error && <p className="auth-error" role="alert">{error}</p>}
    <button type="submit" disabled={busy || !enrolment || code.length !== 6}>{busy ? "Checking…" : backup ? "Add backup authenticator" : "Turn on and continue"}</button>
    {!backup && <p className="auth-hint">Tip: add the same key to a second device now (for example a phone and a password manager). Supabase has no backup codes, so a second authenticator is your fastest way back in if you lose a phone.</p>}
  </form>;
}

/** Sign-in step 2: the current code from any of the user's authenticators. */
export function VerifyAuthenticator() {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const response = await fetch("/api/auth/mfa/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
    const body = await response.json().catch(() => ({})) as { next?: string; error?: string };
    if (response.ok) { hardNavigate(body.next ?? "/"); return; }
    if (body.error === "UNAUTHENTICATED" || body.error === "SESSION_EXPIRED") { hardNavigate("/login?reason=timeout"); return; }
    setBusy(false);
    setCode("");
    setError("That code didn't match. Try the current code in your authenticator app.");
  }

  return <form className="auth-form" onSubmit={submit}>
    <CodeField value={code} onChange={setCode} />
    {error && <p className="auth-error" role="alert">{error}</p>}
    <button type="submit" disabled={busy || code.length !== 6}>{busy ? "Checking…" : "Verify"}</button>
    <p className="auth-hint">Lost your phone? Use your backup authenticator, or follow the recovery steps your platform administrator gave you.</p>
  </form>;
}
