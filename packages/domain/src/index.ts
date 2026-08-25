export const FUEL_DOMAIN_CONTRACT_VERSION = "fuel-domain@1.0.0" as const;
export type Brand<T, B extends string> = T & { readonly __brand: B };
export type FuelProductId = Brand<string, "FuelProductId">;
export type ProviderId = Brand<string, "ProviderId">;
export type StationId = Brand<string, "StationId">;
export type MarketCode = "US" | "GB" | "CA" | "EU";
export type CurrencyCode = "USD" | "GBP" | "CAD" | "EUR";
export type FuelUnit = "US_GALLON" | "LITRE";
export type FuelFamily = "GASOLINE" | "DIESEL";
export type FuelGrade = "REGULAR" | "MIDGRADE" | "PREMIUM" | "DIESEL";
export type ProvenanceClass = "LICENSED_PROVIDER" | "OPEN_GOVERNMENT" | "HISTORICALLY_DERIVED" | "SYNTHETIC";
export type ProviderMode = "LIVE" | "TEST" | "SIMULATED" | "MOCK";

export type EffectivePeriod = Readonly<{ validFrom: string; validTo: string | null }>;
export type FuelProduct = Readonly<{ productId: FuelProductId; schemaVersion: typeof FUEL_DOMAIN_CONTRACT_VERSION; family: FuelFamily; grade: FuelGrade; market: MarketCode; unit: FuelUnit; currency: CurrencyCode; displayName: string; active: boolean; effective: EffectivePeriod }>;
export type DataLicence = Readonly<{ licenceId: string; permitsCanonicalSelection: boolean; permitsDerivedBenchmarks: boolean; permitsRedistribution: boolean; attribution: string; effective: EffectivePeriod }>;
export type FuelDataProvider = Readonly<{ providerId: ProviderId; schemaVersion: typeof FUEL_DOMAIN_CONTRACT_VERSION; name: string; mode: ProviderMode; provenance: ProvenanceClass; markets: readonly MarketCode[]; licence: DataLicence; endpointReference: string | null; credentialReference: string | null; secretDisplayed: false; active: boolean; effective: EffectivePeriod }>;
export type GeoPoint = Readonly<{ latitudeE6: number; longitudeE6: number }>;
export type FuelStation = Readonly<{ stationId: StationId; schemaVersion: typeof FUEL_DOMAIN_CONTRACT_VERSION; providerId: ProviderId; providerStationReference: string; market: MarketCode; region: string; postalCode: string; name: string; location: GeoPoint; timeZone: string; supportedProductIds: readonly FuelProductId[]; active: boolean; effective: EffectivePeriod; dataClassification: "PUBLIC_LOCATION" }>;
export type FuelReferenceCatalogue = Readonly<{ contractVersion: typeof FUEL_DOMAIN_CONTRACT_VERSION; products: readonly FuelProduct[]; providers: readonly FuelDataProvider[]; stations: readonly FuelStation[] }>;

const idPattern = /^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+$/;
const branded = <B extends string>(value: string, label: string) => { const normalized = value.trim().toUpperCase(); if (!idPattern.test(normalized)) throw new Error(`Invalid ${label}.`); return normalized as Brand<string,B>; };
export const fuelProductId = (value: string) => branded<"FuelProductId">(value, "fuel product ID");
export const providerId = (value: string) => branded<"ProviderId">(value, "provider ID");
export const stationId = (value: string) => branded<"StationId">(value, "station ID");

const validInstant = (value: string) => Number.isFinite(Date.parse(value));
export function validateEffectivePeriod(period: EffectivePeriod) { if (!validInstant(period.validFrom) || (period.validTo !== null && (!validInstant(period.validTo) || Date.parse(period.validTo) <= Date.parse(period.validFrom)))) throw new Error("Invalid effective period."); return true; }
export function isEffectiveAt(period: EffectivePeriod, instant: string) { if (!validInstant(instant)) throw new Error("Invalid effective instant."); const time = Date.parse(instant); return time >= Date.parse(period.validFrom) && (period.validTo === null || time < Date.parse(period.validTo)); }

export function validateFuelProduct(product: FuelProduct) {
  validateEffectivePeriod(product.effective);
  if (product.schemaVersion !== FUEL_DOMAIN_CONTRACT_VERSION) throw new Error("Incompatible fuel product schema.");
  if ((product.market === "US" && (product.unit !== "US_GALLON" || product.currency !== "USD")) || (product.market === "GB" && (product.unit !== "LITRE" || product.currency !== "GBP")) || (product.market === "CA" && (product.unit !== "LITRE" || product.currency !== "CAD")) || (product.market === "EU" && (product.unit !== "LITRE" || product.currency !== "EUR"))) throw new Error("Market unit and currency mismatch.");
  if ((product.family === "DIESEL") !== (product.grade === "DIESEL")) throw new Error("Fuel family and grade mismatch.");
  return product;
}
export function validateProvider(provider: FuelDataProvider) { validateEffectivePeriod(provider.effective); validateEffectivePeriod(provider.licence.effective); if (provider.schemaVersion !== FUEL_DOMAIN_CONTRACT_VERSION || provider.secretDisplayed || provider.markets.length === 0) throw new Error("Invalid provider contract."); if (provider.mode === "LIVE" && (!provider.endpointReference || !provider.credentialReference)) throw new Error("Live provider references are required."); if (provider.credentialReference && !provider.credentialReference.startsWith("secret://")) throw new Error("Credential must remain a secret reference."); return provider; }
export function validateStation(station: FuelStation) { validateEffectivePeriod(station.effective); if (station.schemaVersion !== FUEL_DOMAIN_CONTRACT_VERSION || !station.supportedProductIds.length) throw new Error("Invalid station contract."); if (station.location.latitudeE6 < -90_000_000 || station.location.latitudeE6 > 90_000_000 || station.location.longitudeE6 < -180_000_000 || station.location.longitudeE6 > 180_000_000) throw new Error("Invalid station coordinates."); return station; }

export function validateFuelReferenceCatalogue(catalogue: FuelReferenceCatalogue) {
  if (catalogue.contractVersion !== FUEL_DOMAIN_CONTRACT_VERSION) throw new Error("Incompatible catalogue contract.");
  const duplicate = <T>(values: readonly T[]) => new Set(values).size !== values.length;
  if (duplicate(catalogue.products.map(({productId})=>productId)) || duplicate(catalogue.providers.map(({providerId})=>providerId)) || duplicate(catalogue.stations.map(({stationId})=>stationId))) throw new Error("Duplicate canonical identifier.");
  catalogue.products.forEach(validateFuelProduct); catalogue.providers.forEach(validateProvider); catalogue.stations.forEach(validateStation);
  const products = new Map(catalogue.products.map((item)=>[item.productId,item])); const providers = new Map(catalogue.providers.map((item)=>[item.providerId,item]));
  for (const station of catalogue.stations) { const provider = providers.get(station.providerId); if (!provider || !provider.markets.includes(station.market)) throw new Error("Station provider market reference is invalid."); for (const id of station.supportedProductIds) { const product = products.get(id); if (!product || product.market !== station.market) throw new Error("Station fuel product reference is invalid."); } }
  return { valid: true as const, productCount: catalogue.products.length, providerCount: catalogue.providers.length, stationCount: catalogue.stations.length };
}
