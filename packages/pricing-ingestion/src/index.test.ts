import { describe, expect, it } from "vitest";
import { FUEL_DOMAIN_CONTRACT_VERSION, fuelProductId, providerId, stationId, type FuelReferenceCatalogue } from "@fuelcap/domain";
import { ingestObservation, PRICING_INGESTION_CONTRACT_VERSION, type IngestionEnvelope } from "./index";

const productId = fuelProductId("FUEL-US-REGULAR");
const sourceId = providerId("PROVIDER-TEST-ONE");
const siteId = stationId("STATION-US-ONE");
const effective = { validFrom: "2026-01-01T00:00:00Z", validTo: null } as const;
const catalogue: FuelReferenceCatalogue = {
  contractVersion: FUEL_DOMAIN_CONTRACT_VERSION,
  products: [{ productId, schemaVersion: FUEL_DOMAIN_CONTRACT_VERSION, family: "GASOLINE", grade: "REGULAR", market: "US", unit: "US_GALLON", currency: "USD", displayName: "Regular", active: true, effective }],
  providers: [{ providerId: sourceId, schemaVersion: FUEL_DOMAIN_CONTRACT_VERSION, name: "Test provider", mode: "TEST", provenance: "LICENSED_PROVIDER", markets: ["US"], licence: { licenceId: "LICENCE-ONE", permitsCanonicalSelection: true, permitsDerivedBenchmarks: false, permitsRedistribution: false, attribution: "Test", effective }, endpointReference: null, credentialReference: null, secretDisplayed: false, active: true, effective }],
  stations: [{ stationId: siteId, schemaVersion: FUEL_DOMAIN_CONTRACT_VERSION, providerId: sourceId, providerStationReference: "SITE-1", market: "US", region: "TX", postalCode: "78701", name: "Station one", location: { latitudeE6: 30_267_200, longitudeE6: -97_743_100 }, timeZone: "America/Chicago", supportedProductIds: [productId], active: true, effective, dataClassification: "PUBLIC_LOCATION" }],
};
const resolver = { productIdByProviderReference: { REG: productId }, stationIdByProviderReference: { "SITE-1": siteId } };
const policy = { maximumAgeSeconds: 300, futureToleranceSeconds: 30 };
const state = { acceptedRawPayloadHashes: new Set<string>() };
const envelope = (overrides: Partial<IngestionEnvelope["raw"]> = {}, hash: `sha256:${string}` = "sha256:abc"): IngestionEnvelope => ({ envelopeId: "ENV-1", providerId: sourceId, adapterVersion: "test-adapter@1.0.0", schemaVersion: PRICING_INGESTION_CONTRACT_VERSION, correlationId: "CORR-1", receivedAt: "2026-08-25T12:04:00Z", rawPayloadHash: hash, raw: { rawRecordId: "RAW-1", providerStationReference: "SITE-1", providerProductReference: "REG", observedAt: "2026-08-25T12:00:00Z", receivedAt: "2026-08-25T12:04:00Z", priceDecimal: "3.5800", currency: "USD", unit: "US_GALLON", kind: "ACTUAL_PUMP", requestedUses: ["DISPLAY", "QUOTE", "SETTLE"], ...overrides } });

describe("pricing ingestion quality pipeline", () => {
  it("normalizes a valid provider observation at exact four-decimal precision", () => { const result = ingestObservation(envelope(), catalogue, resolver, policy, state); expect(result.disposition).toBe("ACCEPTED"); expect(result.observation?.priceMinor4dp).toBe(35800); expect(result.observation?.stationId).toBe(siteId); });
  it("is idempotent by immutable raw payload hash", () => { const result = ingestObservation(envelope({}, "sha256:seen"), catalogue, resolver, policy, { acceptedRawPayloadHashes: new Set(["sha256:seen"]) }); expect(result.disposition).toBe("DUPLICATE"); expect(result.issues[0]?.code).toBe("DUPLICATE"); });
  it("quarantines stale data", () => { const result = ingestObservation(envelope({ observedAt: "2026-08-25T11:00:00Z" }), catalogue, resolver, policy, state); expect(result.disposition).toBe("QUARANTINED"); expect(result.issues.map(({code})=>code)).toContain("STALE"); });
  it("quarantines future-clock violations", () => { const result = ingestObservation(envelope({ observedAt: "2026-08-25T12:05:00Z" }), catalogue, resolver, policy, state); expect(result.issues.map(({code})=>code)).toContain("OBSERVED_IN_FUTURE"); });
  it("rejects unknown provider references", () => { const result = ingestObservation(envelope({ providerProductReference: "UNKNOWN" }), catalogue, resolver, policy, state); expect(result.issues.map(({code})=>code)).toContain("REFERENCE_UNKNOWN"); });
  it("rejects mismatched denominations without converting silently", () => { const result = ingestObservation(envelope({ currency: "CAD", unit: "LITRE" }), catalogue, resolver, policy, state); expect(result.issues.map(({code})=>code)).toContain("UNIT_CURRENCY_MISMATCH"); });
  it("fails closed on invalid or over-precise prices", () => { expect(ingestObservation(envelope({ priceDecimal: "3.58001" }), catalogue, resolver, policy, state).issues.map(({code})=>code)).toContain("SCHEMA_INVALID"); });
  it("caps requested uses at licence permissions", () => { const limited = { ...catalogue, providers: [{ ...catalogue.providers[0]!, licence: { ...catalogue.providers[0]!.licence, permitsCanonicalSelection: false } }] }; const result = ingestObservation(envelope(), limited, resolver, policy, state); expect(result.issues.map(({code})=>code)).toContain("LICENCE_PROHIBITS_USE"); expect(result.observation).toBeNull(); });
});
