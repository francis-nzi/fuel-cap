export const SPREAD_ENGINE_VERSION = "spread-engine@1.1.0" as const;
export type SpreadComponents = Readonly<{ modelledProtectionCostBps: number; fuelCapMarginBps: number; reserveBufferBps: number }>;
export type FixedUnitCharge = Readonly<{ currency: "USD" | "CAD" | "GBP" | "EUR"; fuelUnit: "GALLON" | "LITRE"; amountMinorPerUnit: number }>;
export type SpreadCharge = Readonly<
  | { mode: "PERCENTAGE_OF_REFERENCE"; components: SpreadComponents; totalChargeBps: number }
  | { mode: "FIXED_MINOR_PER_UNIT"; fixed: FixedUnitCharge }
>;
export type SpreadPolicy = Readonly<{
  policyId: string;
  maximumTotalChargeBps: number;
  defaultComponents: SpreadComponents;
  fuelCapPlusRemovesMargin: true;
  maximumChangeBps?: number;
  minimumCostRecoveryBps?: number;
  maximumExposureQuantity4dp?: number;
}>;
export type SpreadProposal = Readonly<{ proposalId: string; proposalVersion: typeof SPREAD_ENGINE_VERSION; policyId: string; state: "DRAFT"; components: SpreadComponents; totalChargeBps: number; makerId: string; reason: string; subsidySource: string | null; createdAt: string }>;
export type SpreadApproval = Readonly<{ approvalId: string; proposalId: string; checkerId: string; assurance: "STEP_UP"; approvedAt: string }>;
export type PublishedSpreadDecision = Readonly<{ chargeDecisionId: string; chargeDecisionVersion: typeof SPREAD_ENGINE_VERSION; policyId: string; state: "PUBLISHED"; components: SpreadComponents; totalChargeBps: number; proposalId: string; approvalId: string; makerId: string; checkerId: string; publishedAt: string }>;
export type QuoteChargeSnapshot = Readonly<{ chargeDecisionId: string; chargeDecisionVersion: typeof SPREAD_ENGINE_VERSION; modelledProtectionCostBps: number; fuelCapMarginBps: number; reserveBufferBps: number; totalChargeBps: number }>;
export type SpreadAdjustmentKind = "REGULATORY_PROHIBITION" | "MARKET_LIMIT" | "EXPOSURE_VOLATILITY" | "GROUP_POLICY" | "SUBSCRIPTION" | "PROMOTION" | "FLOOR_CAP_ROUNDING";
export type SpreadAdjustment = Readonly<{ adjustmentId: string; kind: SpreadAdjustmentKind; component: keyof SpreadComponents; deltaBps: number; reasonCode: string }>;
export type SpreadSimulationCohort = Readonly<{ cohortId: string; customerCount: number; protectedQuantity4dp: number; referencePriceMinorPerUnit: number; expectedClaimMinor: number }>;
export type SpreadSimulation = Readonly<{ simulationId: string; proposalId: string; state: "SIMULATED" | "BLOCKED"; currentTotalChargeBps: number; proposedTotalChargeBps: number; affectedCustomers: number; protectedQuantity4dp: number; expectedRevenueDeltaMinor: number; expectedClaimsMinor: number; expectedMarginMinor: number; expectedReserveContributionMinor: number; blockers: readonly string[]; simulatedAt: string }>;
export type ScheduledSpreadDecision = Readonly<{ scheduleId: string; chargeDecisionId: string; state: "SCHEDULED"; proposal: SpreadProposal; approval: SpreadApproval; effectiveFrom: string; scheduledBy: string; scheduledAt: string }>;
export type SpreadWithdrawal = Readonly<{ withdrawalId: string; chargeDecisionId: string; state: "WITHDRAWN"; withdrawnBy: string; reason: string; withdrawnAt: string; stopsNewQuotesOnly: true }>;
export type SpreadSupersession = Readonly<{ supersessionId: string; previousDecisionId: string; replacementDecisionId: string; state: "SUPERSEDED"; supersededAt: string; preservesAcceptedQuotes: true }>;

export const totalSpreadBps = ({ modelledProtectionCostBps, fuelCapMarginBps, reserveBufferBps }: SpreadComponents) => modelledProtectionCostBps + fuelCapMarginBps + reserveBufferBps;
const validBps = (value: number) => Number.isInteger(value) && value >= 0;
const validTime = (value: string) => Number.isFinite(Date.parse(value));
const validateComponents = (components: SpreadComponents, policy: SpreadPolicy) => {
  if (!validBps(components.modelledProtectionCostBps) || !validBps(components.fuelCapMarginBps) || !validBps(components.reserveBufferBps)) throw new Error("Spread components must be non-negative integer basis points.");
  const total = totalSpreadBps(components);
  if (total > policy.maximumTotalChargeBps) throw new Error("Spread total exceeds policy limit.");
  return total;
};

export function createSpreadProposal(input: Readonly<{ proposalId: string; makerId: string; reason: string; createdAt: string; components: SpreadComponents; subsidySource?: string | null }>, policy: SpreadPolicy): SpreadProposal {
  if (!input.proposalId.trim() || !input.makerId.trim() || !input.reason.trim() || !validTime(input.createdAt)) throw new Error("Proposal, maker, reason and time are required.");
  const totalChargeBps = validateComponents(input.components, policy);
  const reducesProtectionCost = input.components.modelledProtectionCostBps < policy.defaultComponents.modelledProtectionCostBps;
  if (reducesProtectionCost && !input.subsidySource?.trim()) throw new Error("Protection-cost reductions require an identified subsidy source.");
  return { proposalId: input.proposalId, proposalVersion: SPREAD_ENGINE_VERSION, policyId: policy.policyId, state: "DRAFT", components: { ...input.components }, totalChargeBps, makerId: input.makerId, reason: input.reason, subsidySource: input.subsidySource?.trim() || null, createdAt: input.createdAt };
}

const precedence: readonly SpreadAdjustmentKind[] = ["REGULATORY_PROHIBITION", "MARKET_LIMIT", "EXPOSURE_VOLATILITY", "GROUP_POLICY", "SUBSCRIPTION", "PROMOTION", "FLOOR_CAP_ROUNDING"];

export function applySpreadAdjustments(base: SpreadComponents, adjustments: readonly SpreadAdjustment[], policy: SpreadPolicy): Readonly<{ components: SpreadComponents; appliedAdjustmentIds: readonly string[] }> {
  const seen = new Set<string>();
  const ordered = [...adjustments].sort((a, b) => precedence.indexOf(a.kind) - precedence.indexOf(b.kind));
  const components = { ...base };
  for (const adjustment of ordered) {
    if (!adjustment.adjustmentId.trim() || seen.has(adjustment.adjustmentId) || !adjustment.reasonCode.trim() || !Number.isInteger(adjustment.deltaBps)) throw new Error("Adjustments require unique IDs, integer deltas and reason codes.");
    seen.add(adjustment.adjustmentId);
    components[adjustment.component] += adjustment.deltaBps;
  }
  validateComponents(components, policy);
  return { components, appliedAdjustmentIds: ordered.map(({ adjustmentId }) => adjustmentId) };
}

export function createFixedUnitCharge(fixed: FixedUnitCharge): SpreadCharge {
  if (!Number.isInteger(fixed.amountMinorPerUnit) || fixed.amountMinorPerUnit < 0) throw new Error("Fixed charge must be non-negative integer minor units.");
  return { mode: "FIXED_MINOR_PER_UNIT", fixed: { ...fixed } };
}

export function createPercentageCharge(components: SpreadComponents, policy: SpreadPolicy): SpreadCharge {
  return { mode: "PERCENTAGE_OF_REFERENCE", components: { ...components }, totalChargeBps: validateComponents(components, policy) };
}

export function simulateSpreadProposal(input: Readonly<{ simulationId: string; proposal: SpreadProposal; currentDecision: PublishedSpreadDecision; cohorts: readonly SpreadSimulationCohort[]; simulatedAt: string }>, policy: SpreadPolicy): SpreadSimulation {
  if (!input.simulationId.trim() || !validTime(input.simulatedAt) || Date.parse(input.simulatedAt) < Date.parse(input.proposal.createdAt)) throw new Error("Simulation identity and chronology are required.");
  if (input.currentDecision.policyId !== policy.policyId || input.proposal.policyId !== policy.policyId) throw new Error("Simulation policy lineage must agree.");
  const blockers: string[] = [];
  const changeBps = Math.abs(input.proposal.totalChargeBps - input.currentDecision.totalChargeBps);
  if (policy.maximumChangeBps !== undefined && changeBps > policy.maximumChangeBps) blockers.push("MAXIMUM_CHANGE_EXCEEDED");
  if (policy.minimumCostRecoveryBps !== undefined && input.proposal.components.modelledProtectionCostBps < policy.minimumCostRecoveryBps && !input.proposal.subsidySource) blockers.push("MINIMUM_COST_RECOVERY_FAILED");
  const totals = input.cohorts.reduce((sum, cohort) => {
    if (!cohort.cohortId.trim() || !Number.isInteger(cohort.customerCount) || cohort.customerCount < 0 || !Number.isInteger(cohort.protectedQuantity4dp) || cohort.protectedQuantity4dp < 0 || !Number.isInteger(cohort.referencePriceMinorPerUnit) || cohort.referencePriceMinorPerUnit < 0 || !Number.isInteger(cohort.expectedClaimMinor) || cohort.expectedClaimMinor < 0) throw new Error("Simulation cohorts require non-negative integer values.");
    const quantity = cohort.protectedQuantity4dp / 10_000;
    const revenueDelta = Math.round(quantity * cohort.referencePriceMinorPerUnit * (input.proposal.totalChargeBps - input.currentDecision.totalChargeBps) / 10_000);
    const margin = Math.round(quantity * cohort.referencePriceMinorPerUnit * input.proposal.components.fuelCapMarginBps / 10_000);
    const reserve = Math.round(quantity * cohort.referencePriceMinorPerUnit * input.proposal.components.reserveBufferBps / 10_000);
    return { customers: sum.customers + cohort.customerCount, quantity4dp: sum.quantity4dp + cohort.protectedQuantity4dp, revenueDelta: sum.revenueDelta + revenueDelta, claims: sum.claims + cohort.expectedClaimMinor, margin: sum.margin + margin, reserve: sum.reserve + reserve };
  }, { customers: 0, quantity4dp: 0, revenueDelta: 0, claims: 0, margin: 0, reserve: 0 });
  if (policy.maximumExposureQuantity4dp !== undefined && totals.quantity4dp > policy.maximumExposureQuantity4dp) blockers.push("EXPOSURE_CAP_EXCEEDED");
  return { simulationId: input.simulationId, proposalId: input.proposal.proposalId, state: blockers.length ? "BLOCKED" : "SIMULATED", currentTotalChargeBps: input.currentDecision.totalChargeBps, proposedTotalChargeBps: input.proposal.totalChargeBps, affectedCustomers: totals.customers, protectedQuantity4dp: totals.quantity4dp, expectedRevenueDeltaMinor: totals.revenueDelta, expectedClaimsMinor: totals.claims, expectedMarginMinor: totals.margin, expectedReserveContributionMinor: totals.reserve, blockers, simulatedAt: input.simulatedAt };
}

export function createFuelCapPlusProposal(input: Omit<Parameters<typeof createSpreadProposal>[0], "components">, policy: SpreadPolicy) {
  return createSpreadProposal({ ...input, components: { ...policy.defaultComponents, fuelCapMarginBps: 0 } }, policy);
}

export function approveSpreadProposal(proposal: SpreadProposal, input: Readonly<{ approvalId: string; checkerId: string; assurance: "STEP_UP"; approvedAt: string }>): SpreadApproval {
  if (input.checkerId === proposal.makerId) throw new Error("Maker and checker must differ.");
  if (!input.checkerId.trim() || input.assurance !== "STEP_UP" || !Number.isFinite(Date.parse(input.approvedAt)) || Date.parse(input.approvedAt) < Date.parse(proposal.createdAt)) throw new Error("Valid step-up checker approval is required.");
  return { approvalId: input.approvalId, proposalId: proposal.proposalId, checkerId: input.checkerId, assurance: input.assurance, approvedAt: input.approvedAt };
}

export function scheduleSpreadDecision(input: Readonly<{ scheduleId: string; chargeDecisionId: string; proposal: SpreadProposal; approval: SpreadApproval; effectiveFrom: string; scheduledBy: string; scheduledAt: string; simulation: SpreadSimulation }>): ScheduledSpreadDecision {
  if (input.simulation.proposalId !== input.proposal.proposalId || input.simulation.state !== "SIMULATED") throw new Error("Only a passing simulation may be scheduled.");
  if (input.approval.proposalId !== input.proposal.proposalId || !input.scheduleId.trim() || !input.chargeDecisionId.trim() || !input.scheduledBy.trim() || !validTime(input.scheduledAt) || !validTime(input.effectiveFrom) || Date.parse(input.scheduledAt) < Date.parse(input.approval.approvedAt) || Date.parse(input.effectiveFrom) < Date.parse(input.scheduledAt)) throw new Error("Schedule lineage, actors and chronology must agree.");
  return { scheduleId: input.scheduleId, chargeDecisionId: input.chargeDecisionId, state: "SCHEDULED", proposal: input.proposal, approval: input.approval, effectiveFrom: input.effectiveFrom, scheduledBy: input.scheduledBy, scheduledAt: input.scheduledAt };
}

export function publishScheduledSpreadDecision(schedule: ScheduledSpreadDecision, publishedAt: string, policy: SpreadPolicy): PublishedSpreadDecision {
  if (!validTime(publishedAt) || Date.parse(publishedAt) < Date.parse(schedule.effectiveFrom)) throw new Error("Scheduled decisions cannot publish before their effective time.");
  return publishSpreadDecision(schedule.chargeDecisionId, schedule.proposal, schedule.approval, publishedAt, policy);
}

export function withdrawSpreadDecision(decision: PublishedSpreadDecision, input: Readonly<{ withdrawalId: string; withdrawnBy: string; reason: string; withdrawnAt: string }>): SpreadWithdrawal {
  if (!input.withdrawalId.trim() || !input.withdrawnBy.trim() || !input.reason.trim() || !validTime(input.withdrawnAt) || Date.parse(input.withdrawnAt) < Date.parse(decision.publishedAt)) throw new Error("Withdrawal identity, actor, reason and chronology are required.");
  return { withdrawalId: input.withdrawalId, chargeDecisionId: decision.chargeDecisionId, state: "WITHDRAWN", withdrawnBy: input.withdrawnBy, reason: input.reason, withdrawnAt: input.withdrawnAt, stopsNewQuotesOnly: true };
}

export function supersedeSpreadDecision(previous: PublishedSpreadDecision, replacement: PublishedSpreadDecision, input: Readonly<{ supersessionId: string; supersededAt: string }>): SpreadSupersession {
  if (previous.chargeDecisionId === replacement.chargeDecisionId || previous.policyId !== replacement.policyId || !input.supersessionId.trim() || !validTime(input.supersededAt) || Date.parse(input.supersededAt) < Date.parse(replacement.publishedAt)) throw new Error("Supersession requires distinct decisions with matching policy and valid chronology.");
  return { supersessionId: input.supersessionId, previousDecisionId: previous.chargeDecisionId, replacementDecisionId: replacement.chargeDecisionId, state: "SUPERSEDED", supersededAt: input.supersededAt, preservesAcceptedQuotes: true };
}

export function publishSpreadDecision(chargeDecisionId: string, proposal: SpreadProposal, approval: SpreadApproval, publishedAt: string, policy: SpreadPolicy): PublishedSpreadDecision {
  if (approval.proposalId !== proposal.proposalId || proposal.policyId !== policy.policyId || Date.parse(publishedAt) < Date.parse(approval.approvedAt)) throw new Error("Proposal, approval, policy and publication lineage must agree.");
  const totalChargeBps = validateComponents(proposal.components, policy);
  if (totalChargeBps !== proposal.totalChargeBps) throw new Error("Proposal total is not component-derived.");
  return { chargeDecisionId, chargeDecisionVersion: SPREAD_ENGINE_VERSION, policyId: policy.policyId, state: "PUBLISHED", components: { ...proposal.components }, totalChargeBps, proposalId: proposal.proposalId, approvalId: approval.approvalId, makerId: proposal.makerId, checkerId: approval.checkerId, publishedAt };
}

export function toQuoteChargeSnapshot(decision: PublishedSpreadDecision): QuoteChargeSnapshot {
  return { chargeDecisionId: decision.chargeDecisionId, chargeDecisionVersion: decision.chargeDecisionVersion, ...decision.components, totalChargeBps: decision.totalChargeBps };
}
