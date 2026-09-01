import { approveSpreadProposal, createSpreadProposal, publishScheduledSpreadDecision, scheduleSpreadDecision, simulateSpreadProposal, supersedeSpreadDecision, toQuoteChargeSnapshot, withdrawSpreadDecision, type PublishedSpreadDecision, type ScheduledSpreadDecision, type SpreadApproval, type SpreadPolicy, type SpreadSimulation, type SpreadSupersession, type SpreadWithdrawal } from "@fuelcap/spread-engine";

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

export const spreadLifecyclePolicy: SpreadPolicy = {
  policyId: "spread-policy@1.1",
  maximumTotalChargeBps: 500,
  maximumChangeBps: 50,
  minimumCostRecoveryBps: 120,
  maximumExposureQuantity4dp: 2_000_000,
  defaultComponents: { modelledProtectionCostBps: 130, fuelCapMarginBps: 70, reserveBufferBps: 30 },
  fuelCapPlusRemovesMargin: true,
};

const publishedLifecycleDecision: PublishedSpreadDecision = {
  chargeDecisionId: activeSpreadDecision.decisionId,
  chargeDecisionVersion: "spread-engine@1.1.0",
  policyId: spreadLifecyclePolicy.policyId,
  state: "PUBLISHED",
  components: spreadLifecyclePolicy.defaultComponents,
  totalChargeBps: 230,
  proposalId: "PROPOSAL-CALM-1",
  approvalId: "APPROVAL-CALM-1",
  makerId: "principal-rt-maker",
  checkerId: "principal-rt-checker",
  publishedAt: activeSpreadDecision.effectiveFrom,
};

export const spreadImpactCohorts = [
  { cohortId: "US-FLEET", customerCount: 18, protectedQuantity4dp: 1_100_000, referencePriceMinorPerUnit: 400, expectedClaimMinor: 520 },
  { cohortId: "CANADA-FLEET", customerCount: 9, protectedQuantity4dp: 600_000, referencePriceMinorPerUnit: 146, expectedClaimMinor: 190 },
] as const;

export function simulateSpreadDraftLifecycle(draft: SpreadDecision): SpreadSimulation {
  const proposal = createSpreadProposal({
    proposalId: draft.decisionId,
    makerId: draft.initiatedBy ?? "unknown-maker",
    reason: draft.reason,
    createdAt: "2026-08-22T14:05:00.000Z",
    components: { modelledProtectionCostBps: draft.components.protectionCostBps, fuelCapMarginBps: draft.components.fuelCapMarginBps, reserveBufferBps: draft.components.reserveBufferBps },
  }, spreadLifecyclePolicy);
  return simulateSpreadProposal({ simulationId: `SIM-${draft.decisionId}`, proposal, currentDecision: publishedLifecycleDecision, cohorts: spreadImpactCohorts, simulatedAt: "2026-08-22T14:06:00.000Z" }, spreadLifecyclePolicy);
}

export type CompletedSpreadLifecycle = Readonly<{
  simulation: SpreadSimulation;
  approval: SpreadApproval;
  schedule: ScheduledSpreadDecision;
  published: PublishedSpreadDecision;
  supersession: SpreadSupersession;
  withdrawal: SpreadWithdrawal;
  acceptedQuoteSnapshotPreserved: boolean;
}>;

function engineProposal(draft: SpreadDecision) {
  return createSpreadProposal({
    proposalId: draft.decisionId,
    makerId: draft.initiatedBy ?? "unknown-maker",
    reason: draft.reason,
    createdAt: "2026-08-22T14:05:00.000Z",
    components: { modelledProtectionCostBps: draft.components.protectionCostBps, fuelCapMarginBps: draft.components.fuelCapMarginBps, reserveBufferBps: draft.components.reserveBufferBps },
  }, spreadLifecyclePolicy);
}

export function completeSpreadDraftLifecycle(draft: SpreadDecision): CompletedSpreadLifecycle {
  const proposal = engineProposal(draft);
  const simulation = simulateSpreadDraftLifecycle(draft);
  if (simulation.state !== "SIMULATED") throw new Error(`Blocked spread simulation cannot progress: ${simulation.blockers.join(", ")}`);
  const checkerId = proposal.makerId === "principal-rt-checker" ? "principal-rt-checker-alternate" : "principal-rt-checker";
  const approval = approveSpreadProposal(proposal, { approvalId: `APPROVAL-${proposal.proposalId}`, checkerId, assurance: "STEP_UP", approvedAt: "2026-08-22T14:07:00.000Z" });
  const replacementDecisionId = `SPREAD-GLOBAL-${String(proposal.totalChargeBps).padStart(4, "0")}`;
  const schedule = scheduleSpreadDecision({ scheduleId: `SCHEDULE-${proposal.proposalId}`, chargeDecisionId: replacementDecisionId, proposal, approval, simulation, scheduledBy: "spread-scheduler", scheduledAt: "2026-08-22T14:08:00.000Z", effectiveFrom: "2026-08-23T00:00:00.000Z" });
  const published = publishScheduledSpreadDecision(schedule, "2026-08-23T00:00:00.000Z", spreadLifecyclePolicy);
  const acceptedSnapshot = toQuoteChargeSnapshot(publishedLifecycleDecision);
  const supersession = supersedeSpreadDecision(publishedLifecycleDecision, published, { supersessionId: `SUPERSESSION-${activeSpreadDecision.decisionId}-${replacementDecisionId}`, supersededAt: "2026-08-23T00:00:01.000Z" });
  const withdrawal = withdrawSpreadDecision(published, { withdrawalId: `WITHDRAWAL-${replacementDecisionId}`, withdrawnBy: "principal-rt-checker", reason: "Demonstrate emergency new-quote stop without historical mutation.", withdrawnAt: "2026-08-23T00:02:00.000Z" });
  return { simulation, approval, schedule, published, supersession, withdrawal, acceptedQuoteSnapshotPreserved: JSON.stringify(toQuoteChargeSnapshot(publishedLifecycleDecision)) === JSON.stringify(acceptedSnapshot) };
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
