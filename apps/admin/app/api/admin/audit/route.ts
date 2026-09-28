import { NextResponse } from "next/server";
import { hasAnyRole, requireStaffApi } from "@/lib/auth/guard";
import { listAudit } from "@/lib/auth/store";

export const dynamic = "force-dynamic";

/** Recent sign-in, MFA, step-up and governed-action events: platform admins and auditors. */
export async function GET() {
  const context = await requireStaffApi();
  if (context instanceof NextResponse) return context;
  if (!hasAnyRole(context.principal, ["PA", "AU"])) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403, headers: { "Cache-Control": "no-store" } });
  return NextResponse.json({ events: await listAudit(context.config) }, { headers: { "Cache-Control": "no-store" } });
}
