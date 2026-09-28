import "server-only";
import { NextResponse } from "next/server";
import { hasAnyRole, requireStaffApi, type StaffContext } from "./guard";

const noStore = { "Cache-Control": "no-store" };

/**
 * Guard for platform-admin actions on another person's account: PA role, fresh step-up, and never on yourself
 * (so one compromised account can't quietly re-arm itself).
 */
export async function requirePlatformAdminAction(targetUserId: string): Promise<StaffContext | NextResponse> {
  const context = await requireStaffApi();
  if (context instanceof NextResponse) return context;
  if (!hasAnyRole(context.principal, ["PA"])) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403, headers: noStore });
  if (targetUserId === context.claims.sub) return NextResponse.json({ error: "NOT_ON_YOURSELF" }, { status: 400, headers: noStore });
  if (!context.stepUpFresh) return NextResponse.json({ error: "STEP_UP_REQUIRED" }, { status: 428, headers: noStore });
  return context;
}
