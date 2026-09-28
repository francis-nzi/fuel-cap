import { NextResponse, type NextRequest } from "next/server";
import { audit, requestMeta } from "@/lib/auth/audit";
import { requireStaffApi } from "@/lib/auth/guard";
import { totpFactors } from "@/lib/auth/mfa";

export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "no-store" };

/** Remove one of your own authenticators (e.g. the one on a lost phone). Needs a fresh step-up; never the last one. */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ factorId: string }> }) {
  const { factorId } = await params;
  const context = await requireStaffApi();
  if (context instanceof NextResponse) return context;
  if (!context.stepUpFresh) return NextResponse.json({ error: "STEP_UP_REQUIRED" }, { status: 428, headers: noStore });
  const { verified } = await totpFactors(context.supabase);
  if (!verified.some((factor) => factor.id === factorId)) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404, headers: noStore });
  if (verified.length < 2) return NextResponse.json({ error: "LAST_AUTHENTICATOR" }, { status: 400, headers: noStore });
  const { error } = await context.supabase.auth.mfa.unenroll({ factorId });
  if (error) return NextResponse.json({ error: "REMOVE_FAILED" }, { status: 502, headers: noStore });
  await audit(context.config, "MFA_FACTOR_REMOVED", "success", { userId: context.claims.sub, email: context.claims.email }, requestMeta(request.headers), { factorId });
  return NextResponse.json({ removed: factorId }, { headers: noStore });
}
