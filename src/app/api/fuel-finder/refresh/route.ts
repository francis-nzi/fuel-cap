import { timingSafeEqual } from "node:crypto";
import { fetchFuelFinderSnapshot } from "@/lib/fuel-finder";
import { persistFuelFinderSnapshot } from "@/lib/fuel-finder-persistence";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(request: Request) {
  const expected = process.env.PRICING_INGESTION_SECRET;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!expected || !supplied || expected.length !== supplied.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(supplied));
}

export async function POST(request: Request) {
  if (!authorized(request)) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  try {
    const snapshot = await fetchFuelFinderSnapshot();
    const result = await persistFuelFinderSnapshot(snapshot);
    return Response.json({ source: "UK Fuel Finder", status: "completed", ...result, fetchedAt: snapshot.fetchedAt });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "FUEL_FINDER_REFRESH_FAILED" }, { status: 503 });
  }
}
