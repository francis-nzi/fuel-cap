"use client";

import { useState } from "react";
import { useStepUp } from "@/components/auth/step-up";

type Factor = { id: string; name: string; added: string };

/** Your authenticators. Removing one (e.g. on a lost phone) needs a fresh code from another; the last can't go. */
export function AuthenticatorList({ initial }: { initial: Factor[] }) {
  const [factors, setFactors] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const { requestStepUp, dialog } = useStepUp();

  async function remove(factor: Factor) {
    setError(null);
    const send = () => fetch(`/api/auth/mfa/factors/${factor.id}`, { method: "DELETE" });
    let response = await send();
    if (response.status === 428) {
      if (!(await requestStepUp("remove-authenticator"))) return;
      response = await send();
    }
    if (response.ok) setFactors((current) => current.filter((entry) => entry.id !== factor.id));
    else setError("That authenticator couldn't be removed. You always need at least one.");
  }

  return <>
    <ul className="auth-list" aria-label="Authenticator apps">
      {factors.map((factor) => <li key={factor.id}>
        <span><strong>{factor.name}</strong><br /><span>Added {factor.added}</span></span>
        {factors.length > 1 && <button type="button" className="auth-link auth-link--inline" onClick={() => void remove(factor)} aria-label={`Remove ${factor.name}`}>Remove</button>}
      </li>)}
    </ul>
    {error && <p className="auth-error" role="alert">{error}</p>}
    {factors.length < 2 && <p className="auth-notice" role="status">You have one authenticator. Add a second one now (another phone, a tablet or a password manager). Supabase has no backup codes, so without a second authenticator a lost phone means waiting for a platform administrator to reset your access.</p>}
    {dialog}
  </>;
}
