import { NextResponse } from "next/server";
import { isScenarioId, resetDemonstratorScenario } from "@fuelcap/demo-data/reset";
import type { DemoEnvironment } from "@fuelcap/demo-data";

export const dynamic = "force-dynamic";

function environment(): DemoEnvironment {
  const value = process.env.NEXT_PUBLIC_APP_ENV;
  if (value === "production" || value === "staging") return value;
  return "demo";
}

export async function POST(request: Request) {
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
      environment: environment(),
      role: request.headers.get("x-fuelcap-demo-role") ?? "",
      requestedBy: request.headers.get("x-fuelcap-demo-principal") ?? "",
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
