import { NextResponse } from "next/server";
import { fetchFuelFinderSnapshot } from "@/lib/fuel-finder";
import { readPersistedFuelFinderSnapshot } from "@/lib/fuel-finder-persistence";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET() {
  try {
    let snapshot = null;
    let persisted = false;
    try { snapshot = await readPersistedFuelFinderSnapshot(); } catch { /* deployment remains live while persistence is configured */ }
    persisted = Boolean(snapshot);
    snapshot ??= await fetchFuelFinderSnapshot();
    const { options } = snapshot;
    if (!options.length) return NextResponse.json({ error: "NO_CURRENT_E10_PRICES" }, { status: 503, headers: { "Cache-Control": "no-store" } });
    const stations = options.filter(({ scopeType }) => scopeType === "station").sort((a, b) => a.unitPrice - b.unitPrice);
    const displayLimit = Math.max(50, Math.min(Number(process.env.FUEL_FINDER_DISPLAY_LIMIT ?? 500), 1_000));
    const displayOptions = [...stations.slice(0, displayLimit), ...options.filter(({ scopeType }) => scopeType !== "station")];
    return NextResponse.json({ source: "UK Fuel Finder", live: true, persisted, ...snapshot, options: displayOptions, minimumPrice: stations[0] ?? null, maximumPrice: stations.at(-1) ?? null }, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } });
  } catch (error) {
    const code = error instanceof Error ? error.message : "FUEL_FINDER_UNAVAILABLE";
    return NextResponse.json({ error: code }, { status: code === "FUEL_FINDER_NOT_CONFIGURED" ? 501 : 503, headers: { "Cache-Control": "no-store" } });
  }
}
