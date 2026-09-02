import { NextRequest, NextResponse } from "next/server";
import { dispatchCustomerLifecycle, readCustomerLifecycle } from "@/lib/customer-lifecycle-store";
import type { LifecycleCommand } from "@fuelcap/demo-data/customer-lifecycle";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(readCustomerLifecycle(), { headers: { "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" } });
}

export async function POST(request: NextRequest) {
  const command = await request.json() as LifecycleCommand;
  return NextResponse.json(dispatchCustomerLifecycle(command), { headers: { "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" } });
}
