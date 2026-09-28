import Image from "next/image";
import type { ReactNode } from "react";

/** Minimal frame for sign-in, MFA and account-security screens. */
export function AuthShell({ title, lead, children }: { title: string; lead?: ReactNode; children: ReactNode }) {
  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="auth-title">
        <div className="auth-brand"><Image src="/fuelcap-mark.svg" width={26} height={28} alt="" /><span><strong>FuelCap</strong> Control Room</span></div>
        <h1 id="auth-title">{title}</h1>
        {lead && <p className="auth-lead">{lead}</p>}
        {children}
      </section>
      <p className="auth-footnote">Staff only. Every sign-in, code check and sensitive action is recorded.</p>
    </main>
  );
}
