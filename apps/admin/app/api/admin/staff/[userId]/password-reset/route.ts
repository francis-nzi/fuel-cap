import { NextResponse, type NextRequest } from "next/server";
import { requirePlatformAdminAction } from "@/lib/auth/admin-actions";
import { audit, requestMeta } from "@/lib/auth/audit";
import { getStaffRecordAsService } from "@/lib/auth/store";
import { createServiceClient } from "@/lib/auth/supabase";

export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "no-store" };

/**
 * Forgotten password: emails a member of staff a reset link that opens the CONTROL ROOM. The Supabase project is
 * shared with the customer app (DEC-064), so the link must carry our redirect address; the dashboard's "Send password
 * recovery" can't set one and would send them to the customer app. Platform admin, fresh step-up, not yourself.
 * Resetting a password doesn't remove the authenticator: they still need a code to get in.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const context = await requirePlatformAdminAction(userId);
  if (context instanceof NextResponse) return context;
  const member = await getStaffRecordAsService(context.config, userId);
  if (!member) return NextResponse.json({ error: "NOT_STAFF" }, { status: 404, headers: noStore });
  const { error } = await createServiceClient(context.config).auth.resetPasswordForEmail(member.email, { redirectTo: `${context.config.siteUrl}/auth/confirm` });
  const who = { userId: context.claims.sub, email: context.claims.email };
  if (error) {
    await audit(context.config, "PASSWORD_RESET_SENT", "failure", who, requestMeta(request.headers), { targetUserId: userId, reason: error.code ?? error.message });
    return NextResponse.json({ error: "RESET_EMAIL_FAILED" }, { status: 502, headers: noStore });
  }
  await audit(context.config, "PASSWORD_RESET_SENT", "success", who, requestMeta(request.headers), { targetUserId: userId, target: member.email });
  return NextResponse.json({ userId, sent: true }, { headers: noStore });
}
