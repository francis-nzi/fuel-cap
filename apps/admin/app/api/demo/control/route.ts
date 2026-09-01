import { NextResponse } from "next/server";
import type { DemoControlCommandType } from "@fuelcap/demo-control";
import { dispatchDemoControlCommand, readDemoControlSnapshot } from "@/lib/demo-control-store";

export const dynamic = "force-dynamic";
const commands: readonly DemoControlCommandType[] = ["RESET_BASELINE", "PUBLISH_PRICE_RISE", "WITHDRAW_NEW_QUOTES"];

function headers() {
  return { "Cache-Control": "no-store", "X-FuelCap-Demo-Control": "true" };
}

export function GET() {
  return NextResponse.json(readDemoControlSnapshot(), { headers: headers() });
}

export async function POST(request: Request) {
  const environment = process.env.NEXT_PUBLIC_APP_ENV ?? "demo";
  if (environment !== "demo" && environment !== "staging") return NextResponse.json({ error: "DEMO_CONTROL_PROHIBITED_IN_PRODUCTION" }, { status: 403, headers: headers() });
  let body: { command?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "INVALID_JSON" }, { status: 400, headers: headers() }); }
  if (!commands.includes(body.command as DemoControlCommandType)) return NextResponse.json({ error: "UNKNOWN_DEMO_CONTROL_COMMAND" }, { status: 400, headers: headers() });
  try {
    const snapshot = dispatchDemoControlCommand({
      command: body.command as DemoControlCommandType,
      actorId: request.headers.get("x-fuelcap-demo-principal") ?? "",
      role: request.headers.get("x-fuelcap-demo-role") ?? "",
      idempotencyKey: request.headers.get("idempotency-key") ?? "",
      occurredAt: new Date().toISOString(),
    });
    return NextResponse.json(snapshot, { headers: headers() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "DEMO_CONTROL_FAILED" }, { status: 403, headers: headers() });
  }
}
