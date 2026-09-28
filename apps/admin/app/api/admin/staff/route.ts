import { assignmentConflict, roleCodes, type RoleCode } from "@fuelcap/authz";
import { NextResponse, type NextRequest } from "next/server";
import { audit, requestMeta } from "@/lib/auth/audit";
import { authzEnvironment } from "@/lib/auth/config";
import { hasAnyRole, requireStaffApi, toPrincipal } from "@/lib/auth/guard";
import { allOrganisationIds, insertStaff, listStaff } from "@/lib/auth/store";
import { createServiceClient } from "@/lib/auth/supabase";

export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "no-store" };
const isRole = (value: unknown): value is RoleCode => typeof value === "string" && (roleCodes as readonly string[]).includes(value);

/** Staff list: platform admins and auditors. */
export async function GET() {
  const context = await requireStaffApi();
  if (context instanceof NextResponse) return context;
  if (!hasAnyRole(context.principal, ["PA", "AU"])) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403, headers: noStore });
  return NextResponse.json({ staff: await listStaff(context.config) }, { headers: noStore });
}

/** Invite a member of staff (platform admins only, with a fresh step-up). Public sign-up stays off. */
export async function POST(request: NextRequest) {
  const context = await requireStaffApi();
  if (context instanceof NextResponse) return context;
  const { config, principal, claims } = context;
  const meta = requestMeta(request.headers);
  if (!hasAnyRole(principal, ["PA"])) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403, headers: noStore });
  if (!context.stepUpFresh) return NextResponse.json({ error: "STEP_UP_REQUIRED" }, { status: 428, headers: noStore });

  let body: { email?: unknown; displayName?: unknown; roles?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "INVALID_JSON" }, { status: 400, headers: noStore }); }
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const displayName = typeof body.displayName === "string" ? body.displayName.trim().slice(0, 80) : "";
  const roles = Array.isArray(body.roles) ? [...new Set(body.roles.filter(isRole))] : [];
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !displayName || !roles.length) return NextResponse.json({ error: "INVALID_INVITE" }, { status: 400, headers: noStore });
  const prospective = toPrincipal({ userId: "pending", email, displayName, roles, organisationIds: allOrganisationIds(), active: true, invitedBy: claims.sub, createdAt: "" });
  const conflict = assignmentConflict(prospective, authzEnvironment());
  if (conflict) return NextResponse.json({ error: "ROLE_ASSIGNMENT_CONFLICT", reasonCode: conflict }, { status: 400, headers: noStore });

  const { data, error } = await createServiceClient(config).auth.admin.inviteUserByEmail(email, {
    redirectTo: `${config.siteUrl}/auth/confirm`,
    data: { display_name: displayName },
  });
  if (error || !data.user) {
    await audit(config, "STAFF_INVITE_FAILED", "failure", { userId: claims.sub, email: claims.email }, meta, { invitee: email, reason: error?.code ?? error?.message });
    return NextResponse.json({ error: error?.code === "email_exists" ? "ALREADY_REGISTERED" : "INVITE_FAILED" }, { status: error?.code === "email_exists" ? 409 : 502, headers: noStore });
  }
  await insertStaff(config, { userId: data.user.id, email, displayName, roles, organisationIds: allOrganisationIds(), active: true, invitedBy: claims.sub, createdAt: new Date().toISOString() });
  await audit(config, "STAFF_INVITED", "success", { userId: claims.sub, email: claims.email }, meta, { invitee: email, inviteeId: data.user.id, roles });
  return NextResponse.json({ invited: { userId: data.user.id, email, displayName, roles } }, { status: 201, headers: noStore });
}
