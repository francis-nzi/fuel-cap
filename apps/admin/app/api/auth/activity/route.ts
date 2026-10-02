import { NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

/** Activity ping from the browser while someone is using the control room. The proxy restarts the idle clock. */
export async function POST() {
  const context = await requireStaffApi();
  if (context instanceof NextResponse) return context;
  return new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
