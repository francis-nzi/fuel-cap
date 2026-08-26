export const SPREAD_ENGINE_VERSION = "spread-engine@1.0.0" as const;
export type SpreadComponents = Readonly<{ modelledProtectionCostBps: number; fuelCapMarginBps: number; reserveBufferBps: number }>;
export type SpreadPolicy = Readonly<{ policyId: string; maximumTotalChargeBps: number; defaultComponents: SpreadComponents; fuelCapPlusRemovesMargin: true }>;
export type SpreadProposal = Readonly<{ proposalId: string; proposalVersion: typeof SPREAD_ENGINE_VERSION; policyId: string; state: "DRAFT"; components: SpreadComponents; totalChargeBps: number; makerId: string; reason: string; subsidySource: string | null; createdAt: string }>;
export type SpreadApproval = Readonly<{ approvalId: string; proposalId: string; checkerId: string; assurance: "STEP_UP"; approvedAt: string }>;
export type PublishedSpreadDecision = Readonly<{ chargeDecisionId: string; chargeDecisionVersion: typeof SPREAD_ENGINE_VERSION; policyId: string; state: "PUBLISHED"; components: SpreadComponents; totalChargeBps: number; proposalId: string; approvalId: string; makerId: string; checkerId: string; publishedAt: string }>;
export type QuoteChargeSnapshot = Readonly<{ chargeDecisionId: string; chargeDecisionVersion: typeof SPREAD_ENGINE_VERSION; modelledProtectionCostBps: number; fuelCapMarginBps: number; reserveBufferBps: number; totalChargeBps: number }>;

export const totalSpreadBps = ({ modelledProtectionCostBps, fuelCapMarginBps, reserveBufferBps }: SpreadComponents) => modelledProtectionCostBps + fuelCapMarginBps + reserveBufferBps;
const validBps = (value: number) => Number.isInteger(value) && value >= 0;
const validateComponents = (components: SpreadComponents, policy: SpreadPolicy) => {
  if (!validBps(components.modelledProtectionCostBps) || !validBps(components.fuelCapMarginBps) || !validBps(components.reserveBufferBps)) throw new Error("Spread components must be non-negative integer basis points.");
  const total = totalSpreadBps(components);
  if (total > policy.maximumTotalChargeBps) throw new Error("Spread total exceeds policy limit.");
  return total;
};

export function createSpreadProposal(input: Readonly<{ proposalId: string; makerId: string; reason: string; createdAt: string; components: SpreadComponents; subsidySource?: string | null }>, policy: SpreadPolicy): SpreadProposal {
  if (!input.makerId.trim() || !input.reason.trim() || !Number.isFinite(Date.parse(input.createdAt))) throw new Error("Maker, reason and time are required.");
  const totalChargeBps = validateComponents(input.components, policy);
  const reducesProtectionCost = input.components.modelledProtectionCostBps < policy.defaultComponents.modelledProtectionCostBps;
  if (reducesProtectionCost && !input.subsidySource?.trim()) throw new Error("Protection-cost reductions require an identified subsidy source.");
  return { proposalId: input.proposalId, proposalVersion: SPREAD_ENGINE_VERSION, policyId: policy.policyId, state: "DRAFT", components: { ...input.components }, totalChargeBps, makerId: input.makerId, reason: input.reason, subsidySource: input.subsidySource?.trim() || null, createdAt: input.createdAt };
}

export function createFuelCapPlusProposal(input: Omit<Parameters<typeof createSpreadProposal>[0], "components">, policy: SpreadPolicy) {
  return createSpreadProposal({ ...input, components: { ...policy.defaultComponents, fuelCapMarginBps: 0 } }, policy);
}

export function approveSpreadProposal(proposal: SpreadProposal, input: Readonly<{ approvalId: string; checkerId: string; assurance: "STEP_UP"; approvedAt: string }>): SpreadApproval {
  if (input.checkerId === proposal.makerId) throw new Error("Maker and checker must differ.");
  if (!input.checkerId.trim() || input.assurance !== "STEP_UP" || !Number.isFinite(Date.parse(input.approvedAt)) || Date.parse(input.approvedAt) < Date.parse(proposal.createdAt)) throw new Error("Valid step-up checker approval is required.");
  return { approvalId: input.approvalId, proposalId: proposal.proposalId, checkerId: input.checkerId, assurance: input.assurance, approvedAt: input.approvedAt };
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
