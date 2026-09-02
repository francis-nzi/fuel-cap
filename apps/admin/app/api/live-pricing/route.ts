import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type Option = { scopeType: "station" | "provider" | "country"; label: string; providerName: string | null; unitPrice: number; observedAt: string; stationCount: number };
type Feed = { source: string; live: boolean; options: Option[]; minimumPrice?: Option; maximumPrice?: Option; stationCount?: number; providerCount?: number; freshestObservedAt?: string; oldestObservedAt?: string; fetchedAt?: string; batches?: { prices: number; forecourts: number } };

export async function GET() {
  const customerOrigin = process.env.CUSTOMER_APP_ORIGIN ?? "https://fuel-cap-1.onrender.com";
  try {
    const response = await fetch(new URL("/api/fuel-finder", customerOrigin), { cache: "no-store", signal: AbortSignal.timeout(45_000) });
    if (!response.ok) throw new Error(`CUSTOMER_PRICE_FEED_${response.status}`);
    const feed = await response.json() as Feed;
    const stations = feed.options.filter(({ scopeType }) => scopeType === "station");
    const providers = feed.options.filter(({ scopeType }) => scopeType === "provider").sort((a, b) => b.stationCount - a.stationCount);
    const sorted = [...stations].sort((a, b) => a.unitPrice - b.unitPrice);
    const freshestObservedAt = feed.freshestObservedAt ?? sorted.map(({ observedAt }) => observedAt).sort().at(-1);
    return NextResponse.json({
      source: feed.source,
      live: feed.live,
      stationCount: feed.stationCount ?? stations.length,
      providerCount: feed.providerCount ?? providers.length,
      freshestObservedAt,
      freshestAgeMinutes: freshestObservedAt ? Math.max(0, Math.round((Date.now() - Date.parse(freshestObservedAt)) / 60_000)) : null,
      oldestObservedAt: feed.oldestObservedAt ?? sorted.map(({ observedAt }) => observedAt).sort()[0],
      fetchedAt: feed.fetchedAt,
      batches: feed.batches,
      minimumPrice: feed.minimumPrice ?? sorted[0] ?? null,
      maximumPrice: feed.maximumPrice ?? sorted.at(-1) ?? null,
      leadingProviders: providers.slice(0, 6),
    }, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } });
  } catch (error) {
    return NextResponse.json({ live: false, error: error instanceof Error ? error.message : "LIVE_PRICING_UNAVAILABLE" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
