import { NextResponse } from "next/server";
import { authorizeTenantResource } from "@fuelcap/authz";
import { fleetForOrganisation } from "@fuelcap/demo-data/fleet";
import { authzEnvironment } from "@/lib/auth/config";
import { requireStaffApi } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ organisationId: string }> }) {
  const staff = await requireStaffApi();
  if (staff instanceof NextResponse) return staff;
  const { organisationId } = await context.params;
  const activeOrganisationId = request.headers.get("x-fuelcap-active-organisation") ?? "";

  const decision = authorizeTenantResource({
    principal: staff.principal,
    environment: authzEnvironment(),
    activeOrganisationId,
    resourceOrganisationId: organisationId,
    workspace: "fleets-vehicles",
  });
  if (!decision.allowed) {
    return NextResponse.json({ error: "TENANT_CONTEXT_DENIED" }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }

  const fleet = fleetForOrganisation(organisationId);
  if (!fleet) return NextResponse.json({ error: "FLEET_NOT_FOUND" }, { status: 404 });
  return NextResponse.json({ fleet }, { headers: { "Cache-Control": "no-store", "X-FuelCap-Demo": "true" } });
}
