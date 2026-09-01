import { NextResponse } from "next/server";
import { initialDemoControlSnapshot, validateDemoControlSnapshot } from "@fuelcap/demo-control";

export const dynamic = "force-dynamic";

export async function GET() {
  const origin = process.env.DEMO_CONTROL_ORIGIN ?? (process.env.NODE_ENV === "development" ? "http://127.0.0.1:3001" : "https://fuelcap-app.onrender.com");
  try {
    const response = await fetch(`${origin}/api/demo/control`, { cache: "no-store", signal: AbortSignal.timeout(4000) });
    if (!response.ok) throw new Error(`UPSTREAM_${response.status}`);
    const snapshot = validateDemoControlSnapshot(await response.json());
    return NextResponse.json({ ...snapshot, bridgeReachable: true }, { headers: { "Cache-Control": "no-store", "X-FuelCap-Demo-Control": "proxied" } });
  } catch {
    return NextResponse.json({ ...initialDemoControlSnapshot, bridgeReachable: false }, { headers: { "Cache-Control": "no-store", "X-FuelCap-Demo-Control": "fallback" } });
  }
}
