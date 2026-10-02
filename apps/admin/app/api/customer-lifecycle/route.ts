import { authorize } from "@fuelcap/authz";
import { NextRequest, NextResponse } from "next/server";
import { authzEnvironment } from "@/lib/auth/config";
import { requireStaffApi } from "@/lib/auth/guard";
import { dispatchCustomerLifecycle, readCustomerLifecycle } from "@/lib/customer-lifecycle-store";
import type { LifecycleCommand } from "@fuelcap/demo-data/customer-lifecycle";

export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "no-store" };

/** Customer records: signed-in staff (aal2) with the Customers permission. No longer open to other origins. */
export async function GET() {
  const context = await requireStaffApi();
  if (context instanceof NextResponse) return context;
  const decision = authorize({ principal: context.principal, environment: authzEnvironment(), activeOrganisationId: "org-fuelcap-global", workspace: "customers", verb: "view" });
  if (!decision.allowed) return NextResponse.json({ error: "FORBIDDEN", reasonCode: decision.reasonCode }, { status: 403, headers: noStore });
  return NextResponse.json(readCustomerLifecycle(), { headers: noStore });
}

export async function POST(request: NextRequest) {
  const context = await requireStaffApi();
  if (context instanceof NextResponse) return context;
  const decision = authorize({ principal: context.principal, environment: authzEnvironment(), activeOrganisationId: "org-fuelcap-global", workspace: "customers", verb: "initiate" });
  if (!decision.allowed) return NextResponse.json({ error: "FORBIDDEN", reasonCode: decision.reasonCode }, { status: 403, headers: noStore });
  let command: LifecycleCommand;
  try { command = await request.json() as LifecycleCommand; } catch { return NextResponse.json({ error: "INVALID_JSON" }, { status: 400, headers: noStore }); }
  try {
    return NextResponse.json(dispatchCustomerLifecycle(command), { headers: noStore });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "LIFECYCLE_COMMAND_FAILED" }, { status: 400, headers: noStore });
  }
}
