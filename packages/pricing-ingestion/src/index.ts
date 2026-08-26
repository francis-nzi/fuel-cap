import type { CurrencyCode, FuelProductId, FuelReferenceCatalogue, FuelUnit, ProviderId, StationId } from "@fuelcap/domain";
import { isEffectiveAt } from "@fuelcap/domain";

export const PRICING_INGESTION_CONTRACT_VERSION = "pricing-ingestion@1.0.0" as const;
export type ObservationId = string & { readonly __brand: "ObservationId" };
export type ObservationKind = "ACTUAL_PUMP" | "REFERENCE" | "SIMULATED_PUMP";
export type PricingUse = "DISPLAY" | "QUOTE" | "SETTLE" | "SIMULATE";
export type QualityCode = "SCHEMA_INVALID" | "REFERENCE_UNKNOWN" | "REFERENCE_INACTIVE" | "MARKET_MISMATCH" | "UNIT_CURRENCY_MISMATCH" | "OBSERVED_IN_FUTURE" | "STALE" | "DUPLICATE" | "LICENCE_PROHIBITS_USE";

export type RawProviderObservation = Readonly<{
  rawRecordId: string;
  providerStationReference: string | null;
  providerProductReference: string;
  observedAt: string;
  receivedAt: string;
  priceDecimal: string;
  currency: string;
  unit: string;
  kind: ObservationKind;
  requestedUses: readonly PricingUse[];
}>;

export type IngestionEnvelope = Readonly<{
  envelopeId: string;
  providerId: ProviderId;
  adapterVersion: string;
  schemaVersion: typeof PRICING_INGESTION_CONTRACT_VERSION;
  correlationId: string;
  receivedAt: string;
  rawPayloadHash: `sha256:${string}`;
  raw: RawProviderObservation;
}>;

export type ReferenceResolver = Readonly<{
  productIdByProviderReference: Readonly<Record<string, FuelProductId>>;
  stationIdByProviderReference: Readonly<Record<string, StationId>>;
}>;

export type NormalizedPriceObservation = Readonly<{
  observationId: ObservationId;
  contractVersion: typeof PRICING_INGESTION_CONTRACT_VERSION;
  providerId: ProviderId;
  stationId: StationId | null;
  productId: FuelProductId;
  kind: ObservationKind;
  observedAt: string;
  receivedAt: string;
  priceMinor4dp: number;
  currency: CurrencyCode;
  unit: FuelUnit;
  requestedUses: readonly PricingUse[];
  permittedUses: readonly PricingUse[];
  rawPayloadHash: `sha256:${string}`;
  adapterVersion: string;
  correlationId: string;
}>;

export type QualityIssue = Readonly<{ code: QualityCode; field: string; detail: string }>;
export type IngestionDecision = Readonly<{
  decisionVersion: "pricing-quality@1.0.0";
  envelopeId: string;
  disposition: "ACCEPTED" | "QUARANTINED" | "DUPLICATE";
  observation: NormalizedPriceObservation | null;
  issues: readonly QualityIssue[];
  decidedAt: string;
}>;

export type IngestionPolicy = Readonly<{ maximumAgeSeconds: number; futureToleranceSeconds: number }>;
export type IngestionState = Readonly<{ acceptedRawPayloadHashes: ReadonlySet<string> }>;

const licenceUses = (catalogue: FuelReferenceCatalogue, providerId: ProviderId): readonly PricingUse[] => {
  const licence = catalogue.providers.find((item) => item.providerId === providerId)?.licence;
  if (!licence) return [];
  return ["DISPLAY", ...(licence.permitsCanonicalSelection ? ["QUOTE", "SETTLE"] as const : []), ...(licence.permitsDerivedBenchmarks ? ["SIMULATE"] as const : [])];
};

const parseMinor4dp = (value: string) => {
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,4})?$/.test(value)) return null;
  const [whole, fraction = ""] = value.split(".");
  const amount = Number(whole) * 10_000 + Number(fraction.padEnd(4, "0"));
  return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
};

export function ingestObservation(envelope: IngestionEnvelope, catalogue: FuelReferenceCatalogue, resolver: ReferenceResolver, policy: IngestionPolicy, state: IngestionState): IngestionDecision {
  const issues: QualityIssue[] = [];
  const decidedAt = envelope.receivedAt;
  if (state.acceptedRawPayloadHashes.has(envelope.rawPayloadHash)) return { decisionVersion: "pricing-quality@1.0.0", envelopeId: envelope.envelopeId, disposition: "DUPLICATE", observation: null, issues: [{ code: "DUPLICATE", field: "rawPayloadHash", detail: "Payload was already accepted." }], decidedAt };
  if (envelope.schemaVersion !== PRICING_INGESTION_CONTRACT_VERSION || !Number.isFinite(Date.parse(envelope.raw.observedAt)) || !Number.isFinite(Date.parse(envelope.receivedAt))) issues.push({ code: "SCHEMA_INVALID", field: "schema", detail: "Schema version and timestamps must be valid." });
  const priceMinor4dp = parseMinor4dp(envelope.raw.priceDecimal);
  if (priceMinor4dp === null) issues.push({ code: "SCHEMA_INVALID", field: "priceDecimal", detail: "Price must be positive with at most four decimal places." });
  const provider = catalogue.providers.find((item) => item.providerId === envelope.providerId);
  const productId = resolver.productIdByProviderReference[envelope.raw.providerProductReference];
  const product = catalogue.products.find((item) => item.productId === productId);
  const stationId = envelope.raw.providerStationReference ? resolver.stationIdByProviderReference[envelope.raw.providerStationReference] : undefined;
  const station = stationId ? catalogue.stations.find((item) => item.stationId === stationId) : undefined;
  if (!provider || !product || (envelope.raw.providerStationReference !== null && !station)) issues.push({ code: "REFERENCE_UNKNOWN", field: "references", detail: "Provider, product or station reference is unknown." });
  if (provider && product && (!provider.markets.includes(product.market) || (station && station.market !== product.market))) issues.push({ code: "MARKET_MISMATCH", field: "market", detail: "Provider, product and station markets must agree." });
  if (product && (envelope.raw.currency !== product.currency || envelope.raw.unit !== product.unit)) issues.push({ code: "UNIT_CURRENCY_MISMATCH", field: "currency/unit", detail: "Raw denomination must match the canonical product." });
  if (provider && product && (!provider.active || !product.active || !isEffectiveAt(provider.effective, envelope.raw.observedAt) || !isEffectiveAt(product.effective, envelope.raw.observedAt) || (station && (!station.active || !isEffectiveAt(station.effective, envelope.raw.observedAt))))) issues.push({ code: "REFERENCE_INACTIVE", field: "effective", detail: "A referenced entity is inactive at observation time." });
  const observed = Date.parse(envelope.raw.observedAt); const received = Date.parse(envelope.receivedAt); const ageSeconds = (received - observed) / 1000;
  if (Number.isFinite(ageSeconds) && ageSeconds < -policy.futureToleranceSeconds) issues.push({ code: "OBSERVED_IN_FUTURE", field: "observedAt", detail: "Observation exceeds future-clock tolerance." });
  if (Number.isFinite(ageSeconds) && ageSeconds > policy.maximumAgeSeconds) issues.push({ code: "STALE", field: "observedAt", detail: "Observation exceeds the freshness policy." });
  const permittedUses = licenceUses(catalogue, envelope.providerId).filter((use) => envelope.raw.requestedUses.includes(use));
  if (permittedUses.length !== envelope.raw.requestedUses.length) issues.push({ code: "LICENCE_PROHIBITS_USE", field: "requestedUses", detail: "One or more requested uses are not licensed." });
  if (issues.length || !provider || !product || priceMinor4dp === null) return { decisionVersion: "pricing-quality@1.0.0", envelopeId: envelope.envelopeId, disposition: "QUARANTINED", observation: null, issues, decidedAt };
  const observationId = `${envelope.providerId}-${envelope.raw.rawRecordId}`.toUpperCase() as ObservationId;
  return { decisionVersion: "pricing-quality@1.0.0", envelopeId: envelope.envelopeId, disposition: "ACCEPTED", observation: { observationId, contractVersion: PRICING_INGESTION_CONTRACT_VERSION, providerId: envelope.providerId, stationId: stationId ?? null, productId, kind: envelope.raw.kind, observedAt: envelope.raw.observedAt, receivedAt: envelope.receivedAt, priceMinor4dp, currency: product.currency, unit: product.unit, requestedUses: envelope.raw.requestedUses, permittedUses, rawPayloadHash: envelope.rawPayloadHash, adapterVersion: envelope.adapterVersion, correlationId: envelope.correlationId }, issues: [], decidedAt };
}
