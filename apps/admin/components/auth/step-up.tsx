"use client";

import { LockKeyhole } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { hardNavigate } from "./session-timer";

export type GovernedResult = { allowed: boolean; reasonCode: string } | { cancelled: true };

const actionLabels: Record<string, string> = {
  "initiate-hedge": "start this hedge",
  "approve-hedge": "approve this hedge",
  "validate-price": "request break-glass price validation",
  "emergency-access": "request emergency access",
  "invite-staff": "invite a member of staff",
  "manage-staff": "change someone's access",
  "remove-authenticator": "remove an authenticator",
};

/** Asks for a fresh authenticator code. The server verifies it with Supabase and grants 5 minutes of step-up. */
function StepUpDialog({ action, onDone }: { action: string; onDone: (ok: boolean) => void }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { input.current?.focus(); }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const response = await fetch("/api/auth/step-up", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, action }) });
    setBusy(false);
    if (response.ok) return onDone(true);
    if (response.status === 401 || response.status === 403) {
      const body = await response.json().catch(() => ({})) as { error?: string };
      if (body.error === "UNAUTHENTICATED" || body.error === "SESSION_EXPIRED") { hardNavigate("/login?reason=timeout"); return; }
    }
    setCode("");
    setError("That code didn't work. Check your authenticator app and try the current code.");
    input.current?.focus();
  }

  return <div className="step-up-backdrop" role="presentation">
    <form className="step-up-dialog" role="dialog" aria-modal="true" aria-labelledby="step-up-title" onSubmit={submit} onKeyDown={(event) => { if (event.key === "Escape") onDone(false); }}>
      <div className="step-up-dialog__icon"><LockKeyhole size={20} /></div>
      <h2 id="step-up-title">Confirm it&apos;s you</h2>
      <p>Enter the current 6-digit code from your authenticator app to {actionLabels[action] ?? "continue"}. It stays valid for 5 minutes.</p>
      <label htmlFor="step-up-code">Authenticator code</label>
      <input id="step-up-code" ref={input} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" required aria-describedby={error ? "step-up-error" : undefined} />
      {error && <p id="step-up-error" className="step-up-dialog__error" role="alert">{error}</p>}
      <div className="step-up-dialog__actions">
        <button type="submit" disabled={busy || code.length !== 6}>{busy ? "Checking…" : "Confirm"}</button>
        <button type="button" className="button-secondary" onClick={() => onDone(false)}>Cancel</button>
      </div>
    </form>
  </div>;
}

/** Runs a server-checked governed action, asking for a step-up code only when the server requires one. */
export function useStepUp() {
  const [pending, setPending] = useState<{ action: string; resolve: (ok: boolean) => void } | null>(null);

  function requestStepUp(action: string) {
    return new Promise<boolean>((resolve) => setPending({ action, resolve }));
  }

  async function governed(action: string, extra: Record<string, unknown> = {}): Promise<GovernedResult> {
    const call = () => fetch("/api/admin/governed-actions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...extra }) });
    let response = await call();
    if (response.status === 428) {
      if (!(await requestStepUp(action))) return { cancelled: true };
      response = await call();
    }
    if (response.status === 401) { hardNavigate("/login?reason=timeout"); return { cancelled: true }; }
    const body = await response.json().catch(() => ({})) as { allowed?: boolean; reasonCode?: string; error?: string };
    return { allowed: body.allowed === true, reasonCode: body.reasonCode ?? body.error ?? "UNKNOWN" };
  }

  const dialog: ReactNode = pending ? <StepUpDialog action={pending.action} onDone={(ok) => { pending.resolve(ok); setPending(null); }} /> : null;
  return { governed, requestStepUp, dialog };
}
