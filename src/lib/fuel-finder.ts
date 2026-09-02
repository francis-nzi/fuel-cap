export type FuelFinderPriceOption = {
  scopeType: "station" | "provider" | "country";
  scopeId: string | null;
  label: string;
  providerName: string | null;
  unitPrice: number;
  currency: "GBP";
  unit: "L";
  stationCount: number;
  observedAt: string;
};

type JsonRecord = Record<string, unknown>;
type Token = { value: string; expiresAt: number };
let cachedToken: Token | null = null;

function record(value: unknown): JsonRecord | null { return value !== null && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : null; }
function text(value: unknown) { return typeof value === "string" && value.trim() ? value.trim() : null; }
function number(value: unknown) { const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN; return Number.isFinite(parsed) ? parsed : null; }
function list(value: unknown) { return Array.isArray(value) ? value : []; }

function rows(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  const root = record(payload);
  if (!root) return [];
  for (const key of ["data", "results", "forecourts", "items"]) if (Array.isArray(root[key])) return root[key] as unknown[];
  return [];
}

function addressOf(row: JsonRecord) {
  const address = record(row.address);
  const pieces = address ? [address.address_line_1, address.address_line_2, address.town, address.county, address.postcode] : [row.address_line_1, row.address_line_2, row.town, row.county, row.postcode];
  return pieces.map(text).filter(Boolean).join(", ");
}

export function buildFuelFinderOptions(payload: unknown, fuelType = "E10"): FuelFinderPriceOption[] {
  const stations = rows(payload).flatMap((value) => {
    const row = record(value);
    if (!row) return [];
    const prices = list(row.fuel_prices ?? row.fuelPrices ?? row.prices).map(record).filter((price): price is JsonRecord => Boolean(price));
    const selected = prices.find((price) => text(price.fuel_type ?? price.fuelType)?.toUpperCase() === fuelType.toUpperCase());
    const pence = number(selected?.price ?? row.price);
    const id = text(row.node_id ?? row.nodeId ?? row.id);
    if (!selected || pence === null || pence <= 0 || !id) return [];
    const name = text(row.trading_name ?? row.tradingName ?? row.name) ?? "Fuel Finder forecourt";
    const provider = text(row.brand_name ?? row.brand ?? row.operator_name ?? row.operatorName) ?? "Independent";
    const address = addressOf(row);
    return [{ id, name, provider, address, unitPrice: pence / 100, observedAt: text(selected.price_last_updated ?? selected.priceLastUpdated ?? selected.price_change_effective_timestamp) ?? new Date().toISOString() }];
  });
  const stationOptions: FuelFinderPriceOption[] = stations.map((station) => ({ scopeType: "station", scopeId: station.id, label: `${station.name}${station.address ? ` - ${station.address}` : ""}`, providerName: station.provider, unitPrice: station.unitPrice, currency: "GBP", unit: "L", stationCount: 1, observedAt: station.observedAt }));
  const providers = new Map<string, FuelFinderPriceOption>();
  for (const station of stations) {
    const id = station.provider.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const current = providers.get(id);
    const count = (current?.stationCount ?? 0) + 1;
    providers.set(id, { scopeType: "provider", scopeId: `fuel-finder-brand-${id}`, label: station.provider, providerName: station.provider, unitPrice: Math.max(current?.unitPrice ?? 0, station.unitPrice), currency: "GBP", unit: "L", stationCount: count, observedAt: current && current.observedAt > station.observedAt ? current.observedAt : station.observedAt });
  }
  if (!stations.length) return [];
  const country: FuelFinderPriceOption = { scopeType: "country", scopeId: null, label: "Any eligible United Kingdom station", providerName: null, unitPrice: Math.max(...stations.map(({ unitPrice }) => unitPrice)), currency: "GBP", unit: "L", stationCount: stations.length, observedAt: stations.map(({ observedAt }) => observedAt).sort().at(-1)! };
  return [...stationOptions, ...providers.values(), country];
}

async function accessToken(fetcher: typeof fetch) {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) return cachedToken.value;
  const clientId = process.env.FUEL_FINDER_CLIENT_ID;
  const clientSecret = process.env.FUEL_FINDER_CLIENT_SECRET;
  const tokenUrl = process.env.FUEL_FINDER_TOKEN_URL;
  if (!clientId || !clientSecret || !tokenUrl) throw new Error("FUEL_FINDER_NOT_CONFIGURED");
  const body = new URLSearchParams({ grant_type: "client_credentials", client_id: clientId, client_secret: clientSecret, scope: process.env.FUEL_FINDER_SCOPE ?? "fuelfinder.read" });
  const response = await fetcher(tokenUrl, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body, cache: "no-store", signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`FUEL_FINDER_TOKEN_${response.status}`);
  const payload = await response.json() as { access_token?: string; expires_in?: number; data?: { access_token?: string; expires_in?: number } };
  const tokenPayload = payload.data ?? payload;
  if (!tokenPayload.access_token) throw new Error("FUEL_FINDER_TOKEN_INVALID");
  cachedToken = { value: tokenPayload.access_token, expiresAt: Date.now() + Math.max(tokenPayload.expires_in ?? 300, 60) * 1000 };
  return cachedToken.value;
}

export async function fetchFuelFinderOptions(fetcher: typeof fetch = fetch) {
  const token = await accessToken(fetcher);
  const base = process.env.FUEL_FINDER_API_BASE_URL ?? "https://api.fuelfinder.service.gov.uk";
  const path = process.env.FUEL_FINDER_PRICES_PATH ?? "/v1/prices";
  const url = new URL(path, base);
  url.searchParams.set("fuel_type", process.env.FUEL_FINDER_FUEL_TYPE ?? "E10");
  const response = await fetcher(url, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`FUEL_FINDER_PRICES_${response.status}`);
  return buildFuelFinderOptions(await response.json(), process.env.FUEL_FINDER_FUEL_TYPE ?? "E10");
}
