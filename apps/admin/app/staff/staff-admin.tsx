"use client";

import { useState, type FormEvent } from "react";
import type { RoleCode } from "@fuelcap/authz";
import { useStepUp } from "@/components/auth/step-up";
import type { AuditRecord, StaffRecord } from "@/lib/auth/store";

const roleLabels: Record<RoleCode, string> = {
  PA: "Platform administrator (invites staff, emergency access)",
  OP: "Operations",
  RT: "Risk & treasury (hedging, price publishing)",
  FR: "Finance & reconciliation",
  CF: "Compliance & fraud",
  CS: "Customer support",
  DI: "Data & integrations",
  AU: "Auditor (read-only, can't hold other roles)",
  DP: "Demo presenter (demo environments only, can't hold other roles)",
};

export function StaffAdmin({ canInvite, currentUserId, initialStaff, events }: { canInvite: boolean; currentUserId: string; initialStaff: StaffRecord[]; events: AuditRecord[] }) {
  const [staff, setStaff] = useState(initialStaff);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [roles, setRoles] = useState<RoleCode[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [staffMessage, setStaffMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const { requestStepUp, dialog } = useStepUp();

  async function invite(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    const send = () => fetch("/api/admin/staff", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, displayName, roles }) });
    let response = await send();
    if (response.status === 428) {
      if (!(await requestStepUp("invite-staff"))) { setBusy(false); return; }
      response = await send();
    }
    const body = await response.json().catch(() => ({})) as { invited?: { userId: string; email: string; displayName: string; roles: RoleCode[] }; error?: string; reasonCode?: string };
    setBusy(false);
    if (response.ok && body.invited) {
      const invited = body.invited;
      setStaff((current) => [...current, { userId: invited.userId, email: invited.email, displayName: invited.displayName, roles: invited.roles, organisationIds: [], active: true, invitedBy: null, createdAt: new Date().toISOString() }]);
      setMessage({ tone: "ok", text: `Invite sent to ${invited.email}. They'll set a password and an authenticator app when they accept.` });
      setEmail(""); setDisplayName(""); setRoles([]);
      return;
    }
    setMessage({ tone: "error", text: body.error === "ROLE_ASSIGNMENT_CONFLICT" ? "Those roles can't be combined (auditors and demo presenters must hold a single role)." : body.error === "ALREADY_REGISTERED" ? "That email already has an account." : "The invite couldn't be sent. Check the details and try again." });
  }

  /** Platform-admin actions on someone else's account; the server insists on a fresh step-up. */
  async function manage(member: StaffRecord, kind: "toggle" | "reset") {
    setStaffMessage(null);
    const send = () => kind === "toggle"
      ? fetch(`/api/admin/staff/${member.userId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: !member.active }) })
      : fetch(`/api/admin/staff/${member.userId}/reset-mfa`, { method: "POST" });
    let response = await send();
    if (response.status === 428) {
      if (!(await requestStepUp("manage-staff"))) return;
      response = await send();
    }
    if (!response.ok) return setStaffMessage({ tone: "error", text: `That change to ${member.email} didn't go through.` });
    if (kind === "toggle") {
      setStaff((current) => current.map((entry) => entry.userId === member.userId ? { ...entry, active: !entry.active } : entry));
      setStaffMessage({ tone: "ok", text: `${member.displayName}'s access is ${member.active ? "disabled" : "enabled"}.` });
    } else {
      setStaffMessage({ tone: "ok", text: `${member.displayName}'s authenticators were removed. They'll set up a new one at their next sign-in.` });
    }
  }

  return <>
    <section className="staff-card" aria-labelledby="staff-title">
      <h2 id="staff-title">Staff</h2>
      {staffMessage && <p className={staffMessage.tone === "ok" ? "auth-notice" : "auth-error"} role={staffMessage.tone === "ok" ? "status" : "alert"}>{staffMessage.text}</p>}
      <table className="staff-table">
        <thead><tr><th scope="col">Name</th><th scope="col">Email</th><th scope="col">Roles</th><th scope="col">Status</th>{canInvite && <th scope="col">Recovery</th>}</tr></thead>
        <tbody>{staff.map((member) => <tr key={member.userId}>
          <td>{member.displayName}</td><td>{member.email}</td><td>{member.roles.join(" · ")}</td><td>{member.active ? "Active" : "Disabled"}</td>
          {canInvite && <td>{member.userId === currentUserId ? <small>You</small> : <div className="staff-actions">
            <button type="button" onClick={() => void manage(member, "toggle")} aria-label={`${member.active ? "Disable" : "Enable"} access for ${member.email}`}>{member.active ? "Disable access" : "Enable access"}</button>
            <button type="button" onClick={() => void manage(member, "reset")} aria-label={`Reset authenticator for ${member.email}`}>Reset authenticator</button>
          </div>}</td>}
        </tr>)}</tbody>
      </table>
    </section>

    {canInvite && <section className="staff-card" aria-labelledby="invite-title">
      <h2 id="invite-title">Invite a member of staff</h2>
      <p className="auth-hint">They get an email link to set a password, then must set up an authenticator app before they can see anything. Sending an invite needs a fresh code from your authenticator.</p>
      <form className="auth-form" onSubmit={invite}>
        <label htmlFor="invite-name">Full name</label>
        <input id="invite-name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} required />
        <label htmlFor="invite-email">Work email</label>
        <input id="invite-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        <fieldset className="role-picker">
          <legend>Roles</legend>
          {(Object.keys(roleLabels) as RoleCode[]).map((role) => <label key={role}><input type="checkbox" checked={roles.includes(role)} onChange={(event) => setRoles((current) => event.target.checked ? [...current, role] : current.filter((entry) => entry !== role))} /> <strong>{role}</strong> {roleLabels[role]}</label>)}
        </fieldset>
        {message && <p className={message.tone === "ok" ? "auth-notice" : "auth-error"} role={message.tone === "ok" ? "status" : "alert"}>{message.text}</p>}
        <button type="submit" disabled={busy || !roles.length}>{busy ? "Sending…" : "Send invite"}</button>
      </form>
    </section>}

    <section className="staff-card" aria-labelledby="audit-title">
      <h2 id="audit-title">Recent security events</h2>
      <table className="staff-table">
        <thead><tr><th scope="col">When</th><th scope="col">Event</th><th scope="col">Outcome</th><th scope="col">Who</th><th scope="col">Details</th></tr></thead>
        <tbody>{events.map((event, index) => <tr key={event.id ?? index}><td>{new Date(event.occurredAt).toLocaleString("en-GB")}</td><td>{event.event}</td><td>{event.outcome}</td><td>{event.email ?? "—"}</td><td><code>{JSON.stringify(event.detail)}</code></td></tr>)}</tbody>
      </table>
    </section>
    {dialog}
  </>;
}
