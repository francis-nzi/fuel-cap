import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { hasAnyRole, requireStaffPage } from "@/lib/auth/guard";
import { listAudit, listStaff } from "@/lib/auth/store";
import { StaffAdmin } from "./staff-admin";

export const dynamic = "force-dynamic";

/** Staff and audit: platform administrators invite staff; administrators and auditors review the audit log. */
export default async function StaffPage() {
  const { config, principal, claims } = await requireStaffPage();
  if (!hasAnyRole(principal, ["PA", "AU"])) {
    return <AuthShell title="Staff & audit"><p className="auth-notice" role="status">Only platform administrators and auditors can open this page.</p><Link className="auth-link" href="/">Back to the control room</Link></AuthShell>;
  }
  const [staff, events] = await Promise.all([listStaff(config), listAudit(config, 100)]);
  return (
    <main className="staff-page">
      <header className="staff-page__header"><h1>Staff &amp; audit</h1><Link href="/">Back to the control room</Link></header>
      <StaffAdmin canInvite={principal.roles.includes("PA")} currentUserId={claims.sub} initialStaff={staff} events={events} />
    </main>
  );
}
