import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    status: "ok",
    service: "fuelcap-app",
    environment: process.env.NEXT_PUBLIC_APP_ENV ?? "development",
    timestamp: new Date().toISOString(),
  });
}
