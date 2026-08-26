export const FX_ENGINE_VERSION = "fx-engine@1.0.0" as const;
export const FX_RATE_SCALE = 1_000_000;

export type Currency = "USD" | "CAD" | "GBP" | "EUR";
export type FxPair = `${Currency}/${Currency}`;
export type FxReferenceObservation = Readonly<{
  observationId: string;
  pair: FxPair;
  baseCurrency: Currency;
  quoteCurrency: Currency;
  rate6dp: number;
  provider: string;
  sourceObservedAt: string;
  ingestedAt: string;
  provenance: "ILLUSTRATIVE_FIXED" | "PROVIDER_REFERENCE";
  licenceClass: "REFERENCE_DEMONSTRATOR" | "INTERNAL_PRICING";
  rawPayloadSha256: string;
}>;
export type CanonicalFxRate = Readonly<{
  rateId: string;
  rateVersion: typeof FX_ENGINE_VERSION;
  pair: FxPair;
  baseCurrency: Currency;
  quoteCurrency: Currency;
  rate6dp: number;
  method: "DIRECT" | "TRIANGULATED";
  pivotCurrency: Currency | null;
  observationIds: readonly string[];
  decidedAt: string;
}>;
export type FxAdjustmentComponents = Readonly<{ modelledConversionCostBps: number; fuelCapFxMarginBps: number; reserveBufferBps: number }>;
export type FxAdjustmentPolicy = Readonly<{ policyId: string; maximumAdjustmentBps: number; approvedPivots: readonly Currency[] }>;
export type FxAdjustmentProposal = Readonly<{ proposalId: string; policyId: string; state: "DRAFT"; components: FxAdjustmentComponents; totalAdjustmentBps: number; makerId: string; reason: string; createdAt: string }>;
export type FxAdjustmentApproval = Readonly<{ approvalId: string; proposalId: string; checkerId: string; assurance: "STEP_UP"; approvedAt: string }>;
export type PublishedFxAdjustment = Readonly<{ adjustmentDecisionId: string; adjustmentVersion: typeof FX_ENGINE_VERSION; policyId: string; state: "PUBLISHED"; components: FxAdjustmentComponents; totalAdjustmentBps: number; proposalId: string; approvalId: string; makerId: string; checkerId: string; publishedAt: string }>;
export type AppliedFxConversion = Readonly<{ conversionId: string; conversionVersion: typeof FX_ENGINE_VERSION; sourceCurrency: Currency; destinationCurrency: Currency; sourceAmountMinor: number; destinationAmountMinor: number; referenceRate6dp: number; customerRate6dp: number; canonicalRateId: string; adjustmentDecisionId: string; rateMethod: CanonicalFxRate["method"]; observationIds: readonly string[]; appliedAt: string }>;

const validInstant = (value: string) => Number.isFinite(Date.parse(value));
const pairOf = (base: Currency, quote: Currency): FxPair => `${base}/${quote}`;
const sha256Pattern = /^[a-f0-9]{64}$/;
const validBps = (value: number) => Number.isInteger(value) && value >= 0;
const roundedRatio = (numerator: bigint, denominator: bigint) => (numerator + denominator / BigInt(2)) / denominator;

export function validateFxObservation(observation: FxReferenceObservation, asOf: string, maximumAgeSeconds = 300): void {
  if (observation.pair !== pairOf(observation.baseCurrency, observation.quoteCurrency) || observation.baseCurrency === observation.quoteCurrency) throw new Error("FX pair direction must be explicit and consistent.");
  if (!Number.isSafeInteger(observation.rate6dp) || observation.rate6dp <= 0) throw new Error("FX rate must be a positive six-decimal fixed-point integer.");
  if (!validInstant(observation.sourceObservedAt) || !validInstant(observation.ingestedAt) || !validInstant(asOf) || Date.parse(observation.ingestedAt) < Date.parse(observation.sourceObservedAt)) throw new Error("FX timestamps are invalid.");
  const ageSeconds = (Date.parse(asOf) - Date.parse(observation.sourceObservedAt)) / 1000;
  if (ageSeconds < 0 || ageSeconds > maximumAgeSeconds) throw new Error("FX observation is stale or not yet valid.");
  if (!observation.provider.trim() || !sha256Pattern.test(observation.rawPayloadSha256)) throw new Error("FX evidence is incomplete.");
}

export function createDirectCanonicalRate(rateId: string, observation: FxReferenceObservation, decidedAt: string, maximumAgeSeconds = 300): CanonicalFxRate {
  validateFxObservation(observation, decidedAt, maximumAgeSeconds);
  return { rateId, rateVersion: FX_ENGINE_VERSION, pair: observation.pair, baseCurrency: observation.baseCurrency, quoteCurrency: observation.quoteCurrency, rate6dp: observation.rate6dp, method: "DIRECT", pivotCurrency: null, observationIds: [observation.observationId], decidedAt };
}

export function createTriangulatedCanonicalRate(rateId: string, first: FxReferenceObservation, second: FxReferenceObservation, outputPair: FxPair, pivot: Currency, policy: FxAdjustmentPolicy, decidedAt: string, maximumAgeSeconds = 300): CanonicalFxRate {
  validateFxObservation(first, decidedAt, maximumAgeSeconds);
  validateFxObservation(second, decidedAt, maximumAgeSeconds);
  const [outputBase, outputQuote] = outputPair.split("/") as [Currency, Currency];
  if (!policy.approvedPivots.includes(pivot) || first.baseCurrency !== outputBase || first.quoteCurrency !== pivot || second.baseCurrency !== pivot || second.quoteCurrency !== outputQuote) throw new Error("FX triangulation path or pivot is not approved; rates are never silently inverted.");
  const rate6dp = Number(roundedRatio(BigInt(first.rate6dp) * BigInt(second.rate6dp), BigInt(FX_RATE_SCALE)));
  return { rateId, rateVersion: FX_ENGINE_VERSION, pair: outputPair, baseCurrency: outputBase, quoteCurrency: outputQuote, rate6dp, method: "TRIANGULATED", pivotCurrency: pivot, observationIds: [first.observationId, second.observationId], decidedAt };
}

export const totalFxAdjustmentBps = (components: FxAdjustmentComponents) => components.modelledConversionCostBps + components.fuelCapFxMarginBps + components.reserveBufferBps;
const validateAdjustment = (components: FxAdjustmentComponents, policy: FxAdjustmentPolicy) => {
  if (!validBps(components.modelledConversionCostBps) || !validBps(components.fuelCapFxMarginBps) || !validBps(components.reserveBufferBps)) throw new Error("FX adjustment components must be non-negative integer basis points.");
  const total = totalFxAdjustmentBps(components);
  if (total > policy.maximumAdjustmentBps) throw new Error("FX adjustment exceeds policy limit.");
  return total;
};

export function createFxAdjustmentProposal(input: Readonly<{ proposalId: string; makerId: string; reason: string; createdAt: string; components: FxAdjustmentComponents }>, policy: FxAdjustmentPolicy): FxAdjustmentProposal {
  if (!input.proposalId.trim() || !input.makerId.trim() || !input.reason.trim() || !validInstant(input.createdAt)) throw new Error("Proposal identity, maker, reason and time are required.");
  return { ...input, policyId: policy.policyId, state: "DRAFT", components: { ...input.components }, totalAdjustmentBps: validateAdjustment(input.components, policy) };
}

export function approveFxAdjustmentProposal(proposal: FxAdjustmentProposal, input: Readonly<{ approvalId: string; checkerId: string; assurance: "STEP_UP"; approvedAt: string }>): FxAdjustmentApproval {
  if (input.checkerId === proposal.makerId) throw new Error("Maker and checker must differ.");
  if (!input.approvalId.trim() || !input.checkerId.trim() || input.assurance !== "STEP_UP" || !validInstant(input.approvedAt) || Date.parse(input.approvedAt) < Date.parse(proposal.createdAt)) throw new Error("Valid step-up checker approval is required.");
  return { ...input, proposalId: proposal.proposalId };
}

export function publishFxAdjustment(adjustmentDecisionId: string, proposal: FxAdjustmentProposal, approval: FxAdjustmentApproval, publishedAt: string, policy: FxAdjustmentPolicy): PublishedFxAdjustment {
  if (approval.proposalId !== proposal.proposalId || proposal.policyId !== policy.policyId || !validInstant(publishedAt) || Date.parse(publishedAt) < Date.parse(approval.approvedAt)) throw new Error("Proposal, approval, policy and publication lineage must agree.");
  const totalAdjustmentBps = validateAdjustment(proposal.components, policy);
  if (totalAdjustmentBps !== proposal.totalAdjustmentBps) throw new Error("FX adjustment total is not component-derived.");
  return { adjustmentDecisionId, adjustmentVersion: FX_ENGINE_VERSION, policyId: policy.policyId, state: "PUBLISHED", components: { ...proposal.components }, totalAdjustmentBps, proposalId: proposal.proposalId, approvalId: approval.approvalId, makerId: proposal.makerId, checkerId: approval.checkerId, publishedAt };
}

export function applyFxConversion(conversionId: string, sourceAmountMinor: number, sourceCurrency: Currency, destinationCurrency: Currency, rate: CanonicalFxRate, adjustment: PublishedFxAdjustment, appliedAt: string): AppliedFxConversion {
  if (!Number.isSafeInteger(sourceAmountMinor) || sourceAmountMinor <= 0 || sourceCurrency !== rate.baseCurrency || destinationCurrency !== rate.quoteCurrency || rate.pair !== pairOf(sourceCurrency, destinationCurrency)) throw new Error("Conversion amount and explicit FX direction must match the canonical rate.");
  if (!validInstant(appliedAt) || Date.parse(appliedAt) < Date.parse(rate.decidedAt) || Date.parse(appliedAt) < Date.parse(adjustment.publishedAt)) throw new Error("Conversion time cannot precede its pinned decisions.");
  const customerRate6dp = Number(roundedRatio(BigInt(rate.rate6dp) * BigInt(10_000 + adjustment.totalAdjustmentBps), BigInt(10_000)));
  const destinationAmountMinor = Number(roundedRatio(BigInt(sourceAmountMinor) * BigInt(customerRate6dp), BigInt(FX_RATE_SCALE)));
  return { conversionId, conversionVersion: FX_ENGINE_VERSION, sourceCurrency, destinationCurrency, sourceAmountMinor, destinationAmountMinor, referenceRate6dp: rate.rate6dp, customerRate6dp, canonicalRateId: rate.rateId, adjustmentDecisionId: adjustment.adjustmentDecisionId, rateMethod: rate.method, observationIds: [...rate.observationIds], appliedAt };
}
