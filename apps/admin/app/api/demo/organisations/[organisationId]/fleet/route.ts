import { NextResponse } from "next/server";
import { authorizeTenantResource, demoPrincipals, type Environment } from "@fuelcap/authz";
import { fleetForOrganisation } from "@fuelcap/demo-data/fleet";

export const dynamic = "force-dynamic";

function environment(): Environment {
  const value = process.env.NEXT_PUBLIC_APP_ENV;
  if (value === "production" || value === "staging") return value;
  return "demo";
}

export async function GET(request: Request, context: { params: Promise<{ organisationId: string }> }) {
  const { organisationId } = await context.params;
  const principalId = request.headers.get("x-fuelcap-demo-principal-id") ?? "";
  const activeOrganisationId = request.headers.get("x-fuelcap-active-organisation") ?? "";
  const principal = demoPrincipals.find((candidate) => candidate.principalId === principalId);
  if (!principal) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const decision = authorizeTenantResource({
    principal,
    environment: environment(),
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
