import { NextResponse, type NextRequest } from "next/server";
import { requirePlatformAdminAction } from "@/lib/auth/admin-actions";
import { audit, requestMeta } from "@/lib/auth/audit";
import { setStaffActive } from "@/lib/auth/store";

export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "no-store" };

/** Disable or re-enable a member of staff (platform admin, fresh step-up, not yourself). */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const context = await requirePlatformAdminAction(userId);
  if (context instanceof NextResponse) return context;
  let body: { active?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "INVALID_JSON" }, { status: 400, headers: noStore }); }
  if (typeof body.active !== "boolean") return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400, headers: noStore });
  try {
    await setStaffActive(context.config, userId, body.active);
  } catch {
    return NextResponse.json({ error: "STAFF_NOT_FOUND" }, { status: 404, headers: noStore });
  }
  await audit(context.config, body.active ? "STAFF_ENABLED" : "STAFF_DISABLED", "success", { userId: context.claims.sub, email: context.claims.email }, requestMeta(request.headers), { targetUserId: userId });
  return NextResponse.json({ userId, active: body.active }, { headers: noStore });
}
