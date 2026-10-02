import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { requireStaffPage } from "@/lib/auth/guard";
import { totpFactors } from "@/lib/auth/mfa";
import { AuthenticatorList } from "./authenticator-list";
import { BackupAuthenticator } from "./backup-authenticator";

export const dynamic = "force-dynamic";

/** Account security: authenticators on this account, adding a second (backup) one, and removing a lost one. */
export default async function AccountPage() {
  const { supabase, principal } = await requireStaffPage();
  const { verified } = await totpFactors(supabase);
  const factors = verified.map((factor) => ({
    id: factor.id,
    name: factor.friendly_name ?? "Authenticator",
    added: new Date(factor.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
  }));
  return (
    <AuthShell title="Account security" lead={<>{principal.name} · {principal.email} · {principal.roles.join(" · ")}</>}>
      <h2 className="auth-subhead">Authenticator apps</h2>
      <AuthenticatorList initial={factors} />
      <BackupAuthenticator />
      <Link className="auth-link" href="/">Back to the control room</Link>
    </AuthShell>
  );
}
