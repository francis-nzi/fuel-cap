export type SpreadLifecycle = "PUBLISHED" | "DRAFT" | "PENDING_APPROVAL" | "SUPERSEDED" | "WITHDRAWN";
export type SpreadComponentKey = "protectionCostBps" | "fuelCapMarginBps" | "reserveBufferBps";

export type SpreadComponents = Readonly<Record<SpreadComponentKey, number>>;

export type SpreadDecision = Readonly<{
  decisionId: string;
  version: string;
  lifecycle: SpreadLifecycle;
  organisationId: "fuelcap-global";
  grossSpreadBps: number;
  components: SpreadComponents;
  effectiveFrom: string;
  effectiveTo: string | null;
  policyVersion: "spread-policy@1.0";
  algorithmVersion: "spread-components@1.0";
  scenarioId: "fx-movement-multi-market";
  provenance: "illustrative-fixed";
  reason: string;
  initiatedBy: string | null;
  approvedBy: string | null;
}>;

export type SpreadDraftValidation = Readonly<{
  valid: boolean;
  componentTotalBps: number;
  errors: readonly string[];
}>;

export const activeSpreadDecision: SpreadDecision = {
  decisionId: "SPREAD-GLOBAL-0230",
  version: "spread-calm-2.30-v1",
  lifecycle: "PUBLISHED",
  organisationId: "fuelcap-global",
  grossSpreadBps: 230,
  components: { protectionCostBps: 130, fuelCapMarginBps: 70, reserveBufferBps: 30 },
  effectiveFrom: "2026-08-22T14:00:00.000Z",
  effectiveTo: null,
  policyVersion: "spread-policy@1.0",
  algorithmVersion: "spread-components@1.0",
  scenarioId: "fx-movement-multi-market",
  provenance: "illustrative-fixed",
  reason: "Approved calm-state demonstrator allocation.",
  initiatedBy: "principal-rt-maker",
  approvedBy: "principal-rt-checker",
};

export function spreadComponentTotal(components: SpreadComponents) {
  return components.protectionCostBps + components.fuelCapMarginBps + components.reserveBufferBps;
}

export function validateSpreadDraft(decision: SpreadDecision): SpreadDraftValidation {
  const errors: string[] = [];
  const componentTotalBps = spreadComponentTotal(decision.components);
  for (const [component, value] of Object.entries(decision.components)) {
    if (!Number.isInteger(value) || value < 0) errors.push(`${component} must be a non-negative whole basis-point value.`);
  }
  if (componentTotalBps !== decision.grossSpreadBps) errors.push("Gross spread must equal the sum of its component allocations.");
  if (decision.lifecycle !== "DRAFT") errors.push("Only a draft decision may be edited.");
  if (!decision.reason.trim()) errors.push("A change reason is required.");
  return { valid: errors.length === 0, componentTotalBps, errors };
}

export function proposeSpreadComponents(
  active: SpreadDecision,
  components: SpreadComponents,
  reason: string,
  initiatedBy: string,
): SpreadDecision {
  return {
    ...active,
    decisionId: `${active.decisionId}-DRAFT-02`,
    version: "spread-components-v2-draft",
    lifecycle: "DRAFT",
    grossSpreadBps: spreadComponentTotal(components),
    components: { ...components },
    effectiveFrom: "2026-08-23T00:00:00.000Z",
    reason,
    initiatedBy,
    approvedBy: null,
  };
}

export type Currency = "USD" | "CAD" | "GBP" | "EUR";
export type FxPair = `${Currency}/${Currency}`;
export type FxValidity = "VALID" | "STALE" | "UNSUPPORTED";

export type FxReferenceObservation = Readonly<{
  observationId: string;
  pair: FxPair;
  baseCurrency: Currency;
  quoteCurrency: Currency;
  rate6dp: number;
  provider: "Frankfurter reference fixture";
  sourceObservedAt: string;
  ingestedAt: string;
  provenance: "illustrative-fixed";
  licenceClass: "REFERENCE_DEMONSTRATOR";
  rawPayloadSha256: string;
}>;

export type CanonicalFxRate = Readonly<{
  rateId: string;
  pair: FxPair;
  baseCurrency: Currency;
  quoteCurrency: Currency;
  rate6dp: number;
  method: "DIRECT" | "TRIANGULATED";
  pivotCurrency: Currency | null;
  observationIds: readonly string[];
  decidedAt: string;
  validity: FxValidity;
  algorithmVersion: "canonical-fx@1.0";
}>;

export const fxReferenceObservations: readonly FxReferenceObservation[] = [
  { observationId: "FX-OBS-USDCAD-1400", pair: "USD/CAD", baseCurrency: "USD", quoteCurrency: "CAD", rate6dp: 1371200, provider: "Frankfurter reference fixture", sourceObservedAt: "2026-08-22T14:00:00.000Z", ingestedAt: "2026-08-22T14:00:04.000Z", provenance: "illustrative-fixed", licenceClass: "REFERENCE_DEMONSTRATOR", rawPayloadSha256: "4d6a326b6a030e8f0c85254f876999a95d80c3f9aa4d1d50dbdb732fbb472f77" },
  { observationId: "FX-OBS-GBPUSD-1400", pair: "GBP/USD", baseCurrency: "GBP", quoteCurrency: "USD", rate6dp: 1286400, provider: "Frankfurter reference fixture", sourceObservedAt: "2026-08-22T14:00:00.000Z", ingestedAt: "2026-08-22T14:00:04.000Z", provenance: "illustrative-fixed", licenceClass: "REFERENCE_DEMONSTRATOR", rawPayloadSha256: "5c2695200854f36334d0c928b3ebc17abf50e8c78c951d30ace66dc71bc92710" },
  { observationId: "FX-OBS-EURUSD-1400", pair: "EUR/USD", baseCurrency: "EUR", quoteCurrency: "USD", rate6dp: 1092500, provider: "Frankfurter reference fixture", sourceObservedAt: "2026-08-22T14:00:00.000Z", ingestedAt: "2026-08-22T14:00:04.000Z", provenance: "illustrative-fixed", licenceClass: "REFERENCE_DEMONSTRATOR", rawPayloadSha256: "7797b60d2b539946338b9236386163304dce3beca8dd79bc4952c49031160d3d" },
];

function observation(pair: FxPair) {
  return fxReferenceObservations.find((candidate) => candidate.pair === pair);
}

export function directCanonicalFxRate(pair: FxPair): CanonicalFxRate | null {
  const source = observation(pair);
  if (!source) return null;
  return {
    rateId: `FX-RATE-${pair.replace("/", "")}-DIRECT`,
    pair,
    baseCurrency: source.baseCurrency,
    quoteCurrency: source.quoteCurrency,
    rate6dp: source.rate6dp,
    method: "DIRECT",
    pivotCurrency: null,
    observationIds: [source.observationId],
    decidedAt: "2026-08-22T14:00:05.000Z",
    validity: "VALID",
    algorithmVersion: "canonical-fx@1.0",
  };
}

export function triangulatedCanonicalFxRate(
  firstPair: FxPair,
  secondPair: FxPair,
  outputPair: FxPair,
  pivotCurrency: Currency,
): CanonicalFxRate | null {
  const first = observation(firstPair);
  const second = observation(secondPair);
  if (!first || !second || first.quoteCurrency !== pivotCurrency || second.baseCurrency !== pivotCurrency) return null;
  const [baseCurrency, quoteCurrency] = outputPair.split("/") as [Currency, Currency];
  if (first.baseCurrency !== baseCurrency || second.quoteCurrency !== quoteCurrency) return null;
  return {
    rateId: `FX-RATE-${outputPair.replace("/", "")}-TRIANGULATED`,
    pair: outputPair,
    baseCurrency,
    quoteCurrency,
    rate6dp: Math.round((first.rate6dp * second.rate6dp) / 1_000_000),
    method: "TRIANGULATED",
    pivotCurrency,
    observationIds: [first.observationId, second.observationId],
    decidedAt: "2026-08-22T14:00:05.000Z",
    validity: "VALID",
    algorithmVersion: "canonical-fx@1.0",
  };
}

export function fxObservationValidity(source: FxReferenceObservation, asOf: string, maximumAgeSeconds = 300): FxValidity {
  const ageSeconds = (Date.parse(asOf) - Date.parse(source.sourceObservedAt)) / 1000;
  return ageSeconds >= 0 && ageSeconds <= maximumAgeSeconds ? "VALID" : "STALE";
}

export type PinnedQuoteEconomics = Readonly<{
  quoteId: string;
  referencePriceDecisionId: string;
  spreadDecisionId: string;
  spreadDecisionVersion: string;
  canonicalFxRateId: string;
  fxAdjustmentDecisionVersion: string;
  rulesVersion: string;
  quotedAt: string;
}>;

export const pinnedMultiMarketQuote: PinnedQuoteEconomics = {
  quoteId: "QUOTE-GLOBAL-1101",
  referencePriceDecisionId: "PRICE-DEC-TX-0842",
  spreadDecisionId: activeSpreadDecision.decisionId,
  spreadDecisionVersion: activeSpreadDecision.version,
  canonicalFxRateId: "FX-RATE-GBPCAD-TRIANGULATED",
  fxAdjustmentDecisionVersion: "fx-adjustment-global@1.0",
  rulesVersion: "customer-rules-demo-1",
  quotedAt: "2026-08-22T14:00:06.000Z",
};
