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
  latitude?: number;
  longitude?: number;
  referenceStationLabel?: string;
};

export type FuelFinderSnapshot = {
  options: FuelFinderPriceOption[];
  stationCount: number;
  providerCount: number;
  freshestObservedAt: string;
  oldestObservedAt: string;
  batches: { prices: number; forecourts: number };
  fetchedAt: string;
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
  const address = record(row.location) ?? record(row.address);
  const pieces = address ? [address.address_line_1, address.address_line_2, address.city, address.town, address.county, address.postcode] : [row.address_line_1, row.address_line_2, row.city, row.town, row.county, row.postcode];
  return pieces.map(text).filter(Boolean).join(", ");
}

function mergeForecourtDetails(pricesPayload: unknown, forecourtsPayload: unknown) {
  const details = new Map(rows(forecourtsPayload).flatMap((value) => {
    const row = record(value);
    const id = row && text(row.node_id ?? row.nodeId ?? row.id);
    return row && id ? [[id, row] as const] : [];
  }));
  return { data: rows(pricesPayload).map((value) => {
    const price = record(value);
    const id = price && text(price.node_id ?? price.nodeId ?? price.id);
    return price && id ? { ...(details.get(id) ?? {}), ...price } : value;
  }) };
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
    const location = record(row.location) ?? record(row.address);
    return [{ id, name, provider, address, unitPrice: pence / 100, observedAt: text(selected.price_last_updated ?? selected.priceLastUpdated ?? selected.price_change_effective_timestamp) ?? new Date().toISOString(), latitude: number(location?.latitude ?? row.latitude) ?? undefined, longitude: number(location?.longitude ?? row.longitude) ?? undefined }];
  });
  const stationOptions: FuelFinderPriceOption[] = stations.map((station) => ({ scopeType: "station", scopeId: station.id, label: `${station.name}${station.address ? ` - ${station.address}` : ""}`, providerName: station.provider, unitPrice: station.unitPrice, currency: "GBP", unit: "L", stationCount: 1, observedAt: station.observedAt, latitude: station.latitude, longitude: station.longitude }));
  const providers = new Map<string, FuelFinderPriceOption>();
  for (const station of stations) {
    const id = station.provider.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const current = providers.get(id);
    const count = (current?.stationCount ?? 0) + 1;
    providers.set(id, { scopeType: "provider", scopeId: `fuel-finder-brand-${id}`, label: station.provider, providerName: station.provider, unitPrice: Math.max(current?.unitPrice ?? 0, station.unitPrice), currency: "GBP", unit: "L", stationCount: count, observedAt: current && current.observedAt > station.observedAt ? current.observedAt : station.observedAt });
  }
  if (!stations.length) return [];
  const maximumStation = [...stations].sort((a, b) => b.unitPrice - a.unitPrice)[0];
  const country: FuelFinderPriceOption = { scopeType: "country", scopeId: null, label: "Any eligible United Kingdom station", providerName: null, unitPrice: maximumStation.unitPrice, currency: "GBP", unit: "L", stationCount: stations.length, observedAt: maximumStation.observedAt, referenceStationLabel: `${maximumStation.name}${maximumStation.address ? ` - ${maximumStation.address}` : ""}` };
  return [...stationOptions, ...providers.values(), country];
}

async function accessToken(fetcher: typeof fetch) {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) return cachedToken.value;
  const clientId = process.env.FUEL_FINDER_CLIENT_ID;
  const clientSecret = process.env.FUEL_FINDER_CLIENT_SECRET;
  const tokenUrl = process.env.FUEL_FINDER_TOKEN_URL;
  if (!clientId || !clientSecret || !tokenUrl) throw new Error("FUEL_FINDER_NOT_CONFIGURED");
  const response = await fetcher(tokenUrl, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ client_id: clientId, client_secret: clientSecret }), cache: "no-store", signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`FUEL_FINDER_TOKEN_${response.status}`);
  const payload = await response.json() as { access_token?: string; expires_in?: number; data?: { access_token?: string; expires_in?: number } };
  const tokenPayload = payload.data ?? payload;
  if (!tokenPayload.access_token) throw new Error("FUEL_FINDER_TOKEN_INVALID");
  cachedToken = { value: tokenPayload.access_token, expiresAt: Date.now() + Math.max(tokenPayload.expires_in ?? 300, 60) * 1000 };
  return cachedToken.value;
}

async function fetchBatches(fetcher: typeof fetch, base: string, path: string, token: string) {
  const maximumBatches = Math.max(1, Math.min(Number(process.env.FUEL_FINDER_MAX_BATCHES ?? 40), 100));
  const all: unknown[] = [];
  for (let batch = 1; batch <= maximumBatches; batch += 1) {
    const url = new URL(path, base);
    url.searchParams.set("batch-number", String(batch));
    const response = await fetcher(url, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`FUEL_FINDER_DATA_${response.status}`);
    const current = rows(await response.json());
    all.push(...current);
    if (current.length < 500) return { rows: all, batches: batch };
  }
  throw new Error("FUEL_FINDER_BATCH_LIMIT");
}

export async function fetchFuelFinderSnapshot(fetcher: typeof fetch = fetch): Promise<FuelFinderSnapshot> {
  const token = await accessToken(fetcher);
  const base = process.env.FUEL_FINDER_API_BASE_URL ?? "https://www.fuel-finder.service.gov.uk";
  const [prices, forecourts] = await Promise.all([
    fetchBatches(fetcher, base, process.env.FUEL_FINDER_PRICES_PATH ?? "/api/v1/pfs/fuel-prices", token),
    fetchBatches(fetcher, base, process.env.FUEL_FINDER_FORECOURTS_PATH ?? "/api/v1/pfs", token),
  ]);
  const options = buildFuelFinderOptions(mergeForecourtDetails({ data: prices.rows }, { data: forecourts.rows }), process.env.FUEL_FINDER_FUEL_TYPE ?? "E10");
  const stations = options.filter(({ scopeType }) => scopeType === "station");
  const observed = stations.map(({ observedAt }) => observedAt).sort();
  return {
    options,
    stationCount: stations.length,
    providerCount: options.filter(({ scopeType }) => scopeType === "provider").length,
    freshestObservedAt: observed.at(-1) ?? new Date(0).toISOString(),
    oldestObservedAt: observed[0] ?? new Date(0).toISOString(),
    batches: { prices: prices.batches, forecourts: forecourts.batches },
    fetchedAt: new Date().toISOString(),
  };
}

export async function fetchFuelFinderOptions(fetcher: typeof fetch = fetch) {
  return (await fetchFuelFinderSnapshot(fetcher)).options;
}
