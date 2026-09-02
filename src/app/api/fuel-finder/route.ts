import { NextResponse } from "next/server";
import { fetchFuelFinderOptions } from "@/lib/fuel-finder";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const options = await fetchFuelFinderOptions();
    if (!options.length) return NextResponse.json({ error: "NO_CURRENT_E10_PRICES" }, { status: 503, headers: { "Cache-Control": "no-store" } });
    return NextResponse.json({ source: "UK Fuel Finder", live: true, options }, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } });
  } catch (error) {
    const code = error instanceof Error ? error.message : "FUEL_FINDER_UNAVAILABLE";
    return NextResponse.json({ error: code }, { status: code === "FUEL_FINDER_NOT_CONFIGURED" ? 501 : 503, headers: { "Cache-Control": "no-store" } });
  }
}
