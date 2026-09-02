import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  const fuelFinderConfigured = Boolean(process.env.FUEL_FINDER_CLIENT_ID && process.env.FUEL_FINDER_CLIENT_SECRET && process.env.FUEL_FINDER_TOKEN_URL);
  return NextResponse.json({
    status: "ok",
    service: "fuelcap-app",
    environment: process.env.NEXT_PUBLIC_APP_ENV ?? "development",
    provenance: fuelFinderConfigured ? "live-with-verified-fallback" : "synthetic-seeded",
    integrations: { fuelFinder: fuelFinderConfigured ? "configured" : "fallback" },
    commit: process.env.RENDER_GIT_COMMIT?.slice(0, 7) ?? "local",
    timestamp: new Date().toISOString(),
  });
}
