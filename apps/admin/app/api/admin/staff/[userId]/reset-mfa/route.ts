import { NextResponse, type NextRequest } from "next/server";
import { requirePlatformAdminAction } from "@/lib/auth/admin-actions";
import { audit, requestMeta } from "@/lib/auth/audit";
import { createServiceClient } from "@/lib/auth/supabase";

export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "no-store" };

/**
 * Lost-phone recovery: removes every authenticator on someone else's account, so their next sign-in forces a new
 * enrolment. Only after verifying who they are (see docs/ADMIN_AUTH.md). Platform admin, fresh step-up, not yourself.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const context = await requirePlatformAdminAction(userId);
  if (context instanceof NextResponse) return context;
  const admin = createServiceClient(context.config).auth.admin.mfa;
  const { data, error } = await admin.listFactors({ userId });
  if (error || !data) return NextResponse.json({ error: "RESET_FAILED" }, { status: 502, headers: noStore });
  for (const factor of data.factors) {
    const { error: deleteError } = await admin.deleteFactor({ id: factor.id, userId });
    if (deleteError) return NextResponse.json({ error: "RESET_FAILED" }, { status: 502, headers: noStore });
  }
  await audit(context.config, "MFA_RESET_BY_ADMIN", "success", { userId: context.claims.sub, email: context.claims.email }, requestMeta(request.headers), { targetUserId: userId, removedFactors: data.factors.length });
  return NextResponse.json({ userId, removedFactors: data.factors.length }, { headers: noStore });
}
