import { describe, expect, it } from "vitest";
import type { BenchmarkDecision } from "@fuelcap/benchmark-engine";
import { fuelProductId } from "@fuelcap/domain";
import { createQuote, type ChargeSnapshot, type ProductCatalogue, type QuoteRequest } from "./index";

const fuelId = fuelProductId("FUEL-US-REGULAR");
const catalogue: ProductCatalogue = { catalogueVersion: "catalogue@1.0.0", products: [{ catalogueProductId: "PROTECT-PERSONAL-US-REGULAR", version: 1, segment: "PERSONAL", market: "US", fuelProductId: fuelId, currency: "USD", unit: "US_GALLON", durationSeconds: 604800, maximumVolumeMinor4dp: 250000, strikeDistanceBps: 500, maximumBoundaryDistanceBps: 1500, active: true, effectiveFrom: "2026-01-01T00:00:00Z", effectiveTo: null }] };
const benchmark: BenchmarkDecision = { decisionId: "BENCH-1", decisionVersion: "benchmark-engine@1.0.0", policyId: "POLICY-1", decidedAt: "2026-08-26T09:00:00Z", status: "PUBLISHED", reasonCode: "BENCHMARK_SELECTED", benchmarkPriceMinor4dp: 35000, selectedObservationId: "OBS-1" as BenchmarkDecision["selectedObservationId"], coverageBps: 9800, dispersionBps: 120, evidence: [] };
const charge: ChargeSnapshot = { chargeDecisionId: "SPREAD-1", chargeDecisionVersion: "spread-engine@1.0.0", modelledProtectionCostBps: 130, fuelCapMarginBps: 70, reserveBufferBps: 30, totalChargeBps: 230 };
const request: QuoteRequest = { requestId: "REQUEST-1", customerId: "CUSTOMER-1", segment: "PERSONAL", fuelProductId: fuelId, volumeMinor4dp: 200000, requestedAt: "2026-08-26T10:00:00Z" };
const quote = (requestOverride: Partial<QuoteRequest> = {}, benchmarkOverride: Partial<BenchmarkDecision> = {}, chargeOverride: Partial<ChargeSnapshot> = {}, sourceCatalogue = catalogue) => createQuote("QUOTE-1", { ...request, ...requestOverride }, sourceCatalogue, { ...benchmark, ...benchmarkOverride }, { ...charge, ...chargeOverride });

describe("product catalogue and quote engine", () => {
  it("creates the canonical seven-day quote with separated economics", () => { const result = quote(); expect(result.status).toBe("QUOTED"); expect(result.referencePriceMinor4dp).toBe(35000); expect(result.protectedStrikeMinor4dp).toBe(36750); expect(result.maximumBoundaryMinor4dp).toBe(40250); expect(result.protectionChargeMinor4dp).toBe(805); expect(result.reservationAmountMinor4dp).toBe(751100); });
  it("pins catalogue, benchmark and charge decision lineage", () => { const result = quote(); expect(result.catalogueProductVersion).toBe(1); expect(result.benchmarkDecisionId).toBe("BENCH-1"); expect(result.chargeDecisionId).toBe("SPREAD-1"); });
  it("separates short quote validity from seven-day protection expiry", () => { const result = quote(); expect(result.expiresAt).toBe("2026-08-26T10:01:00.000Z"); expect(result.protectionExpiresAt).toBe("2026-09-02T10:00:00.000Z"); });
  it("fails closed when the benchmark is blocked", () => { const result = quote({}, { status: "BLOCKED", benchmarkPriceMinor4dp: null }); expect(result.status).toBe("UNAVAILABLE"); expect(result.reasonCode).toBe("BENCHMARK_UNAVAILABLE"); });
  it("classifies product volume breaches as eligibility failures", () => { const result = quote({ volumeMinor4dp: 250001 }); expect(result.status).toBe("INELIGIBLE"); expect(result.reasonCode).toBe("VOLUME_LIMIT_EXCEEDED"); });
  it("rejects a charge total that is not the sum of editable components", () => { const result = quote({}, {}, { totalChargeBps: 231 }); expect(result.reasonCode).toBe("INVALID_CHARGE"); expect(result.referencePriceMinor4dp).toBeNull(); });
  it("does not quote inactive catalogue products", () => { const inactive = { ...catalogue, products: [{ ...catalogue.products[0]!, active: false }] }; expect(quote({}, {}, {}, inactive).reasonCode).toBe("PRODUCT_UNAVAILABLE"); });
});
