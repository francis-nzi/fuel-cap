import { createClient } from "@supabase/supabase-js";
import type { FuelFinderSnapshot } from "./fuel-finder";

type Quality = "verified" | "pending" | "rejected";
const chunks = <T,>(items: T[], size = 500) => Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size));

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("FUEL_FINDER_PERSISTENCE_NOT_CONFIGURED");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function qualityOf(unitPrice: number, observedAt: string, now: number): Quality {
  const observed = Date.parse(observedAt);
  if (!Number.isFinite(observed) || unitPrice < 0.5 || unitPrice > 3.5 || observed > now + 300_000) return "rejected";
  if (now - observed > 86_400_000) return "pending";
  return "verified";
}

export async function persistFuelFinderSnapshot(snapshot: FuelFinderSnapshot) {
  const supabase = adminClient();
  const startedAt = new Date().toISOString();
  const { data: run, error: runError } = await supabase.from("pricing_ingestion_runs").insert({ source_name: "UK Fuel Finder", status: "running", started_at: startedAt }).select("id").single();
  if (runError) throw new Error(`FUEL_FINDER_RUN_${runError.code}`);
  try {
    const stationOptions = snapshot.options.filter(({ scopeType }) => scopeType === "station");
    const providerNames = [...new Set(stationOptions.map(({ providerName }) => providerName ?? "Independent"))];
    const { data: providers, error: providerError } = await supabase.from("fuel_providers").upsert(providerNames.map((display_name) => ({ market: "GB", display_name, status: "active" })), { onConflict: "market,display_name" }).select("id,display_name");
    if (providerError) throw new Error(`FUEL_FINDER_PROVIDERS_${providerError.code}`);
    const providerIds = new Map((providers ?? []).map(({ id, display_name }) => [display_name, id]));

    const stationRows = stationOptions.map((option) => ({
      provider_id: providerIds.get(option.providerName ?? "Independent"), market: "GB", external_reference: option.scopeId!,
      name: option.label.split(" - ")[0], address: option.label.includes(" - ") ? option.label.slice(option.label.indexOf(" - ") + 3) : "Address not supplied",
      status: "active",
    })).filter(({ provider_id }) => provider_id);
    const persistedStations: Array<{ id: string; external_reference: string }> = [];
    for (const batch of chunks(stationRows)) {
      const { data, error } = await supabase.from("stations").upsert(batch, { onConflict: "market,external_reference" }).select("id,external_reference");
      if (error) throw new Error(`FUEL_FINDER_STATIONS_${error.code}`);
      persistedStations.push(...(data ?? []));
    }
    const stationIds = new Map(persistedStations.map(({ id, external_reference }) => [external_reference, id]));
    const now = Date.now();
    const observations = stationOptions.map((option) => ({
      station_id: stationIds.get(option.scopeId!), fuel_grade: "regular", currency: "GBP", unit: "L", unit_price: option.unitPrice,
      observed_at: option.observedAt, received_at: snapshot.fetchedAt, source_name: "UK Fuel Finder", source_record_id: `${option.scopeId}:E10`,
      quality_status: qualityOf(option.unitPrice, option.observedAt, now),
    })).filter(({ station_id }) => station_id);
    for (const batch of chunks(observations)) {
      const { error } = await supabase.from("station_price_observations").upsert(batch, { onConflict: "source_name,source_record_id,observed_at", ignoreDuplicates: true });
      if (error) throw new Error(`FUEL_FINDER_OBSERVATIONS_${error.code}`);
    }
    const counts = observations.reduce((result, { quality_status }) => ({ ...result, [quality_status]: result[quality_status] + 1 }), { verified: 0, pending: 0, rejected: 0 } as Record<Quality, number>);
    await supabase.from("pricing_ingestion_runs").update({ status: "completed", completed_at: new Date().toISOString(), fetched_records: stationOptions.length, accepted_records: counts.verified, pending_records: counts.pending, rejected_records: counts.rejected, price_batches: snapshot.batches.prices, forecourt_batches: snapshot.batches.forecourts, freshest_observed_at: snapshot.freshestObservedAt }).eq("id", run.id);
    return { runId: run.id, fetched: stationOptions.length, ...counts };
  } catch (error) {
    await supabase.from("pricing_ingestion_runs").update({ status: "failed", completed_at: new Date().toISOString(), error_code: error instanceof Error ? error.message.slice(0, 160) : "UNKNOWN" }).eq("id", run.id);
    throw error;
  }
}

export async function readPersistedFuelFinderSnapshot(): Promise<FuelFinderSnapshot | null> {
  const supabase = adminClient();
  const [{ data: health, error: healthError }, { data: options, error: optionsError }] = await Promise.all([
    supabase.rpc("get_pricing_feed_health"),
    supabase.rpc("get_current_lock_options", { p_market: "GB", p_fuel_grade: "regular" }),
  ]);
  if (healthError || optionsError) throw new Error(`FUEL_FINDER_READ_${healthError?.code ?? optionsError?.code}`);
  const run = health?.[0];
  if (!run || run.status !== "completed" || !run.completed_at || Date.now() - Date.parse(run.completed_at) > 900_000 || !options?.length) return null;
  const mapped: FuelFinderSnapshot["options"] = options.map((option: Record<string, unknown>) => ({
    scopeType: option.scope_type as "station" | "provider" | "country", scopeId: option.scope_id as string | null,
    label: String(option.label), providerName: option.provider_name ? String(option.provider_name) : null,
    unitPrice: Number(option.unit_price), currency: "GBP" as const, unit: "L" as const,
    stationCount: Number(option.station_count), observedAt: String(option.observed_at),
  }));
  const stations = mapped.filter(({ scopeType }) => scopeType === "station");
  const observed = stations.map(({ observedAt }) => observedAt).sort();
  return { options: mapped, stationCount: stations.length, providerCount: mapped.filter(({ scopeType }) => scopeType === "provider").length, freshestObservedAt: observed.at(-1)!, oldestObservedAt: observed[0]!, batches: { prices: Number(run.price_batches ?? 0), forecourts: Number(run.forecourt_batches ?? 0) }, fetchedAt: String(run.completed_at) };
}
