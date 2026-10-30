import { NextResponse } from "next/server";

// Turns a postcode, ZIP, town or city into coordinates, or coordinates into a country (for the "switch country?" hint).
// UK lookups use postcodes.io (open data, no key). Everything else uses OpenStreetMap Nominatim, which allows light use
// with an identifying User-Agent; production should move to a paid geocoder.

export const dynamic = "force-dynamic";

const COUNTRY: Record<string, string> = { US: "us", CA: "ca", GB: "gb" };
const USER_AGENT = "FuelCap demo (info@fuelcap.tech)";
const cacheHeaders = { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" };
type Result = { latitude: number; longitude: number; label: string };

async function json(url: string) {
  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" }, signal: AbortSignal.timeout(6000) });
  if (!response.ok) return null;
  return response.json() as Promise<unknown>;
}

async function ukPostcode(query: string): Promise<Result | null> {
  const compact = query.replace(/\s+/g, "");
  const full = await json(`https://api.postcodes.io/postcodes/${encodeURIComponent(compact)}`) as { result?: { latitude: number; longitude: number; postcode: string; admin_district?: string } } | null;
  if (full?.result) return { latitude: full.result.latitude, longitude: full.result.longitude, label: `${full.result.postcode}${full.result.admin_district ? `, ${full.result.admin_district}` : ""}` };
  const outward = await json(`https://api.postcodes.io/outcodes/${encodeURIComponent(compact)}`) as { result?: { latitude: number; longitude: number; outcode: string; admin_district?: string[] } } | null;
  if (outward?.result) return { latitude: outward.result.latitude, longitude: outward.result.longitude, label: `${outward.result.outcode}${outward.result.admin_district?.[0] ? `, ${outward.result.admin_district[0]}` : ""}` };
  return null;
}

async function nominatim(query: string, market: string): Promise<Result | null> {
  const country = COUNTRY[market] ?? "";
  const rows = await json(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&addressdetails=0&countrycodes=${country}&q=${encodeURIComponent(query)}`) as { lat: string; lon: string; display_name: string }[] | null;
  const row = rows?.[0];
  if (!row) return null;
  return { latitude: Number(row.lat), longitude: Number(row.lon), label: row.display_name.split(",").slice(0, 2).join(",").trim() };
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const query = (params.get("q") ?? "").trim().slice(0, 80);
  const market = (params.get("market") ?? "GB").toUpperCase();
  const lat = Number(params.get("lat"));
  const lon = Number(params.get("lon"));
  try {
    if (!query && Number.isFinite(lat) && Number.isFinite(lon) && params.has("lat")) {
      const row = await json(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=5&lat=${lat}&lon=${lon}`) as { address?: { country_code?: string } } | null;
      const code = row?.address?.country_code?.toUpperCase() ?? null;
      return NextResponse.json({ country: code }, { headers: cacheHeaders });
    }
    if (query.length < 2) return NextResponse.json({ error: "QUERY_TOO_SHORT" }, { status: 400 });
    const result = (market === "GB" ? await ukPostcode(query) : null) ?? await nominatim(query, market);
    if (!result) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404, headers: cacheHeaders });
    return NextResponse.json(result, { headers: cacheHeaders });
  } catch {
    return NextResponse.json({ error: "GEOCODER_UNAVAILABLE" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
