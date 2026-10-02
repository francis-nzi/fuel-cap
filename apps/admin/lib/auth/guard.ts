import "server-only";
import { assignmentConflict, type Principal, type RoleCode } from "@fuelcap/authz";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { hasFreshStepUp, type AuthClaims } from "./claims";
import { authConfig, authzEnvironment, STEP_UP_COOKIE, type AuthConfig } from "./config";
import { verify, type StepUpGrant } from "./signed-cookie";
import { getOwnStaffRecord, type StaffRecord } from "./store";
import { createRouteClient } from "./supabase";

export type StaffContext = {
  config: AuthConfig;
  supabase: Awaited<ReturnType<typeof createRouteClient>>;
  claims: AuthClaims;
  staff: StaffRecord;
  principal: Principal;
  stepUpFresh: boolean;
};
type Failure = { status: 401 | 403 | 503; error: "AUTH_NOT_CONFIGURED" | "UNAUTHENTICATED" | "MFA_REQUIRED" | "NOT_STAFF" | "ROLE_ASSIGNMENT_CONFLICT" | "STAFF_LOOKUP_FAILED" };

export const toPrincipal = (staff: StaffRecord): Principal => ({
  principalId: staff.userId, name: staff.displayName, email: staff.email, roles: staff.roles, organisationIds: staff.organisationIds,
});
export const hasAnyRole = (principal: Principal, roles: readonly RoleCode[]) => principal.roles.some((role) => roles.includes(role));

/** Signed in, passed MFA (aal2), active staff record, no role-assignment conflict. Used by every page and API route. */
export async function resolveStaff(): Promise<{ ok: true; context: StaffContext } | { ok: false; failure: Failure }> {
  const config = authConfig();
  if (!config) return { ok: false, failure: { status: 503, error: "AUTH_NOT_CONFIGURED" } };
  const supabase = await createRouteClient(config);
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims as AuthClaims | undefined;
  if (!claims?.sub) return { ok: false, failure: { status: 401, error: "UNAUTHENTICATED" } };
  if (claims.aal !== "aal2") return { ok: false, failure: { status: 403, error: "MFA_REQUIRED" } };
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) return { ok: false, failure: { status: 401, error: "UNAUTHENTICATED" } };
  let staff: StaffRecord | null;
  try {
    staff = await getOwnStaffRecord(config, claims.sub, accessToken);
  } catch {
    return { ok: false, failure: { status: 503, error: "STAFF_LOOKUP_FAILED" } };
  }
  if (!staff?.active) return { ok: false, failure: { status: 403, error: "NOT_STAFF" } };
  const principal = toPrincipal(staff);
  if (assignmentConflict(principal, authzEnvironment())) return { ok: false, failure: { status: 403, error: "ROLE_ASSIGNMENT_CONFLICT" } };
  const grant = verify<StepUpGrant>((await cookies()).get(STEP_UP_COOKIE)?.value, config.sessionSecret);
  return { ok: true, context: { config, supabase, claims, staff, principal, stepUpFresh: hasFreshStepUp(claims, grant) } };
}

/** For route handlers: the staff context, or a JSON error response to return as-is. */
export async function requireStaffApi(): Promise<StaffContext | NextResponse> {
  const result = await resolveStaff();
  if (result.ok) return result.context;
  return NextResponse.json({ error: result.failure.error }, { status: result.failure.status, headers: { "Cache-Control": "no-store" } });
}

/** For pages: the staff context, or a redirect to sign-in / MFA. */
export async function requireStaffPage(): Promise<StaffContext> {
  const result = await resolveStaff();
  if (result.ok) return result.context;
  if (result.failure.error === "MFA_REQUIRED") redirect("/mfa");
  if (result.failure.error === "UNAUTHENTICATED") redirect("/login");
  redirect(`/login?error=${result.failure.error}`);
}
