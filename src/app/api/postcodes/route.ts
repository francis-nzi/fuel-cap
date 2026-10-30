import { NextResponse } from "next/server";

// UK postcodes → coordinates, so stations from the database (which stores postcodes in the address but no
// coordinates yet) can be placed on the map and sorted by distance. Uses postcodes.io bulk lookup (open data, no
// key, 100 per request) and keeps results in memory for the life of the server.

export const dynamic = "force-dynamic";

const cache = new Map<string, [number, number] | null>();
const normalise = (postcode: string) => postcode.toUpperCase().replace(/\s+/g, "");

async function lookup(batch: string[]) {
  const response = await fetch("https://api.postcodes.io/postcodes?filter=postcode,latitude,longitude", {
    method: "POST", headers: { "Content-Type": "application/json", "User-Agent": "FuelCap demo (info@fuelcap.tech)" },
    body: JSON.stringify({ postcodes: batch }), signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) return;
  const payload = await response.json() as { result: { query: string; result: { latitude: number | null; longitude: number | null } | null }[] };
  for (const { query, result } of payload.result) {
    cache.set(normalise(query), result && result.latitude !== null && result.longitude !== null ? [result.latitude, result.longitude] : null);
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { postcodes?: unknown } | null;
  const wanted = Array.isArray(body?.postcodes) ? [...new Set(body.postcodes.filter((value): value is string => typeof value === "string").map(normalise))].slice(0, 1000) : [];
  const missing = wanted.filter((postcode) => !cache.has(postcode));
  const batches = Array.from({ length: Math.ceil(missing.length / 100) }, (_, index) => missing.slice(index * 100, index * 100 + 100));
  try {
    for (let index = 0; index < batches.length; index += 5) await Promise.all(batches.slice(index, index + 5).map(lookup));
  } catch { /* return what we have */ }
  const coords: Record<string, [number, number]> = {};
  for (const postcode of wanted) { const found = cache.get(postcode); if (found) coords[postcode] = found; }
  return NextResponse.json({ coords }, { headers: { "Cache-Control": "no-store" } });
}
