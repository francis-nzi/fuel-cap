import { NextResponse } from "next/server";
import { isScenarioId, resetDemonstratorScenario } from "@fuelcap/demo-data/reset";
import type { DemoEnvironment } from "@fuelcap/demo-data";
import { authzEnvironment } from "@/lib/auth/config";
import { requireStaffApi } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

/** Scenario reset: presenter scope comes from the signed-in person's DP role, not from request headers. */
export async function POST(request: Request) {
  const context = await requireStaffApi();
  if (context instanceof NextResponse) return context;
  let body: { scenarioId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  if (!isScenarioId(body.scenarioId)) {
    return NextResponse.json({ error: "UNKNOWN_SCENARIO" }, { status: 400 });
  }

  try {
    const result = resetDemonstratorScenario({
      scenarioId: body.scenarioId,
      environment: authzEnvironment() as DemoEnvironment,
      role: context.principal.roles.includes("DP") ? "demonstrator-presenter" : context.principal.roles[0],
      requestedBy: context.principal.email,
      idempotencyKey: request.headers.get("idempotency-key") ?? "",
    });
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store", "X-FuelCap-Demo": "true" },
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "RESET_FAILED";
    const status = code === "RESET_PROHIBITED_IN_PRODUCTION" || code === "RESET_REQUIRES_PRESENTER_SCOPE" ? 403 : 400;
    return NextResponse.json({ error: code }, { status });
  }
}
