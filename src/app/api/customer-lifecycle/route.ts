import { NextRequest, NextResponse } from "next/server";
import { applyLifecycleCommand, initialCustomerLifecycleSnapshot, type CustomerLifecycleSnapshot, type LifecycleCommand } from "@fuelcap/demo-data/customer-lifecycle";

export const dynamic = "force-dynamic";
const local = globalThis as typeof globalThis & { __fuelcapCustomerLifecycle?: CustomerLifecycleSnapshot };

function origin() {
  return process.env.DEMO_CONTROL_ORIGIN ?? (process.env.NODE_ENV === "development" ? "http://127.0.0.1:3001" : "https://fuelcap-app.onrender.com");
}

export async function GET() {
  if (process.env.NEXT_PUBLIC_FUELCAP_E2E === "true" && !process.env.DEMO_CONTROL_ORIGIN) {
    local.__fuelcapCustomerLifecycle ??= initialCustomerLifecycleSnapshot;
    return NextResponse.json(local.__fuelcapCustomerLifecycle, { headers: { "Cache-Control": "no-store" } });
  }
  try {
    const response = await fetch(`${origin()}/api/customer-lifecycle`, { cache: "no-store", signal: AbortSignal.timeout(4000) });
    if (!response.ok) throw new Error("UPSTREAM_UNAVAILABLE");
    return NextResponse.json(await response.json(), { headers: { "Cache-Control": "no-store" } });
  } catch {
    local.__fuelcapCustomerLifecycle ??= initialCustomerLifecycleSnapshot;
    return NextResponse.json(local.__fuelcapCustomerLifecycle, { headers: { "Cache-Control": "no-store" } });
  }
}

export async function POST(request: NextRequest) {
  const command = await request.json() as LifecycleCommand;
  if (process.env.NEXT_PUBLIC_FUELCAP_E2E === "true" && !process.env.DEMO_CONTROL_ORIGIN) {
    local.__fuelcapCustomerLifecycle = applyLifecycleCommand(local.__fuelcapCustomerLifecycle ?? initialCustomerLifecycleSnapshot, command);
    return NextResponse.json(local.__fuelcapCustomerLifecycle, { headers: { "Cache-Control": "no-store" } });
  }
  try {
    const response = await fetch(`${origin()}/api/customer-lifecycle`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(command), cache: "no-store", signal: AbortSignal.timeout(4000) });
    if (!response.ok) throw new Error("UPSTREAM_UNAVAILABLE");
    return NextResponse.json(await response.json(), { headers: { "Cache-Control": "no-store" } });
  } catch {
    local.__fuelcapCustomerLifecycle = applyLifecycleCommand(local.__fuelcapCustomerLifecycle ?? initialCustomerLifecycleSnapshot, command);
    return NextResponse.json(local.__fuelcapCustomerLifecycle, { headers: { "Cache-Control": "no-store" } });
  }
}
