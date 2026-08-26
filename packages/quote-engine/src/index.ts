import type { BenchmarkDecision } from "@fuelcap/benchmark-engine";
import type { CurrencyCode, FuelProductId, FuelUnit, MarketCode } from "@fuelcap/domain";

export const QUOTE_ENGINE_VERSION = "quote-engine@1.0.0" as const;
export type CustomerSegment = "PERSONAL" | "DRIVER_PRO" | "FLEET";
export type CommercialProduct = Readonly<{ catalogueProductId: string; version: number; segment: CustomerSegment; market: MarketCode; fuelProductId: FuelProductId; currency: CurrencyCode; unit: FuelUnit; durationSeconds: number; maximumVolumeMinor4dp: number; strikeDistanceBps: number; maximumBoundaryDistanceBps: number; active: boolean; effectiveFrom: string; effectiveTo: string | null }>;
export type ProductCatalogue = Readonly<{ catalogueVersion: string; products: readonly CommercialProduct[] }>;
export type ChargeSnapshot = Readonly<{ chargeDecisionId: string; chargeDecisionVersion: string; modelledProtectionCostBps: number; fuelCapMarginBps: number; reserveBufferBps: number; totalChargeBps: number }>;
export type QuoteRequest = Readonly<{ requestId: string; customerId: string; segment: CustomerSegment; fuelProductId: FuelProductId; volumeMinor4dp: number; requestedAt: string }>;
export type QuoteDecision = Readonly<{ quoteId: string; quoteVersion: typeof QUOTE_ENGINE_VERSION; requestId: string; status: "QUOTED" | "UNAVAILABLE" | "INELIGIBLE"; reasonCode: "QUOTE_CREATED" | "BENCHMARK_UNAVAILABLE" | "PRODUCT_UNAVAILABLE" | "VOLUME_LIMIT_EXCEEDED" | "INVALID_CHARGE"; issuedAt: string; expiresAt: string | null; protectionExpiresAt: string | null; catalogueProductId: string | null; catalogueProductVersion: number | null; benchmarkDecisionId: string | null; chargeDecisionId: string | null; referencePriceMinor4dp: number | null; protectedStrikeMinor4dp: number | null; maximumBoundaryMinor4dp: number | null; protectionChargeMinor4dp: number | null; protectedUnitCostMinor4dp: number | null; volumeMinor4dp: number; reservationAmountMinor4dp: number | null; currency: CurrencyCode | null; unit: FuelUnit | null }>;

const instantInRange = (at: string, from: string, to: string | null) => Date.parse(at) >= Date.parse(from) && (to === null || Date.parse(at) < Date.parse(to));
const applyBps = (amountMinor4dp: number, bps: number) => Math.ceil(amountMinor4dp * bps / 10_000);
const unavailable = (quoteId: string, request: QuoteRequest, reasonCode: QuoteDecision["reasonCode"], status: QuoteDecision["status"] = "UNAVAILABLE"): QuoteDecision => ({ quoteId, quoteVersion: QUOTE_ENGINE_VERSION, requestId: request.requestId, status, reasonCode, issuedAt: request.requestedAt, expiresAt: null, protectionExpiresAt: null, catalogueProductId: null, catalogueProductVersion: null, benchmarkDecisionId: null, chargeDecisionId: null, referencePriceMinor4dp: null, protectedStrikeMinor4dp: null, maximumBoundaryMinor4dp: null, protectionChargeMinor4dp: null, protectedUnitCostMinor4dp: null, volumeMinor4dp: request.volumeMinor4dp, reservationAmountMinor4dp: null, currency: null, unit: null });

export function createQuote(quoteId: string, request: QuoteRequest, catalogue: ProductCatalogue, benchmark: BenchmarkDecision, charge: ChargeSnapshot, quoteValiditySeconds = 60): QuoteDecision {
  if (!Number.isFinite(Date.parse(request.requestedAt)) || request.volumeMinor4dp <= 0 || quoteValiditySeconds <= 0) throw new Error("Invalid quote request.");
  if (benchmark.status !== "PUBLISHED" || benchmark.benchmarkPriceMinor4dp === null) return unavailable(quoteId, request, "BENCHMARK_UNAVAILABLE");
  const product = catalogue.products.find((item) => item.active && item.segment === request.segment && item.fuelProductId === request.fuelProductId && instantInRange(request.requestedAt, item.effectiveFrom, item.effectiveTo));
  if (!product) return unavailable(quoteId, request, "PRODUCT_UNAVAILABLE");
  if (request.volumeMinor4dp > product.maximumVolumeMinor4dp) return unavailable(quoteId, request, "VOLUME_LIMIT_EXCEEDED", "INELIGIBLE");
  const componentTotal = charge.modelledProtectionCostBps + charge.fuelCapMarginBps + charge.reserveBufferBps;
  if (componentTotal !== charge.totalChargeBps || componentTotal < 0) return unavailable(quoteId, request, "INVALID_CHARGE");
  const reference = benchmark.benchmarkPriceMinor4dp;
  const strike = reference + applyBps(reference, product.strikeDistanceBps);
  const boundary = reference + applyBps(reference, product.maximumBoundaryDistanceBps);
  const protectionCharge = applyBps(reference, charge.totalChargeBps);
  const protectedUnitCost = strike + protectionCharge;
  const issued = Date.parse(request.requestedAt);
  return { quoteId, quoteVersion: QUOTE_ENGINE_VERSION, requestId: request.requestId, status: "QUOTED", reasonCode: "QUOTE_CREATED", issuedAt: request.requestedAt, expiresAt: new Date(issued + quoteValiditySeconds * 1000).toISOString(), protectionExpiresAt: new Date(issued + product.durationSeconds * 1000).toISOString(), catalogueProductId: product.catalogueProductId, catalogueProductVersion: product.version, benchmarkDecisionId: benchmark.decisionId, chargeDecisionId: charge.chargeDecisionId, referencePriceMinor4dp: reference, protectedStrikeMinor4dp: strike, maximumBoundaryMinor4dp: boundary, protectionChargeMinor4dp: protectionCharge, protectedUnitCostMinor4dp: protectedUnitCost, volumeMinor4dp: request.volumeMinor4dp, reservationAmountMinor4dp: Math.ceil(protectedUnitCost * request.volumeMinor4dp / 10_000), currency: product.currency, unit: product.unit };
}
