import type { RuleDecision } from "@fuelcap/rules-engine";

export type RiskSignalType = "IDENTITY_KYC" | "DEVICE_SESSION_CHANGE" | "PAYMENT_FAILURE" | "VELOCITY" | "LOCATION_IMPOSSIBILITY" | "STATION_GRADE_MISMATCH" | "BOUNDARY_EXPLOITATION" | "LINKED_ACCOUNTS" | "FLEET_CARD_MISUSE" | "UNUSUAL_WITHDRAWAL" | "PROMOTION_ABUSE";
export type RiskSignal = Readonly<{ signalId: string; organisationId: string; subjectId: string; type: RiskSignalType; scoreBps: number; confidenceBps: number; modelVersion: string; reasonCode: string; evidenceIds: readonly string[]; observedAt: string; simulated: boolean }>;
export type RiskOutcome = "ALLOW" | "MONITOR" | "STEP_UP" | "TEMPORARY_HOLD" | "DECLINE_TRANSACTION" | "RESTRICT_NEW_PROTECTION" | "RESTRICT_WITHDRAWAL" | "HUMAN_REVIEW";
export type RiskCapability = "TRANSACTION" | "NEW_PROTECTION" | "WITHDRAWAL" | "AUTO_ROLLOVER" | "IDENTITY_VERIFICATION";
export type RiskScore = Readonly<{ organisationId: string; subjectId: string; scoreBps: number; confidenceBps: number; modelVersion: string; signalIds: readonly string[]; reasonCodes: readonly string[]; evidenceIds: readonly string[] }>;
export type RiskDecision = Readonly<{ decisionId: string; organisationId: string; subjectId: string; outcome: RiskOutcome; capability: RiskCapability | null; scopeReference: string | null; startsAt: string; expiresAt: string | null; score: RiskScore; ruleDecisionId: string; ruleSetVersion: string; ruleVersion: string; reasonCodes: readonly string[]; evidenceIds: readonly string[]; reviewRoute: string; customerValueErasedMinor: 0; generativeAiAuthority: false }>;
export type RiskHold = Readonly<{ holdId: string; organisationId: string; decisionId: string; capability: RiskCapability; scopeReference: string; amountMinor: number; startsAt: string; expiresAt: string; releaseRule: string; state: "PROPOSED" | "APPROVED" | "RELEASED"; customerValueErasedMinor: 0; makerId: string; checkerId: string | null }>;
export type FairnessSnapshot = Readonly<{ snapshotId: string; market: string; segment: string; modelVersion: string; falsePositiveRateBps: number; medianReviewMinutes: number; lossAvoidedMinor: number; customerImpactCount: number; protectedAttributesUsed: false; proxyTestStatus: "PASS" | "FAIL"; sampledAt: string }>;

const allowedOutcomes = new Set<RiskOutcome>(["ALLOW", "MONITOR", "STEP_UP", "TEMPORARY_HOLD", "DECLINE_TRANSACTION", "RESTRICT_NEW_PROTECTION", "RESTRICT_WITHDRAWAL", "HUMAN_REVIEW"]);

export function scoreRiskSignals(signals: readonly RiskSignal[], weights: Readonly<Partial<Record<RiskSignalType, number>>>, modelVersion: string): RiskScore {
  if (!signals.length || !modelVersion.trim()) throw new Error("Risk scoring requires signals and a model version.");
  const first = signals[0]!;
  if (signals.some((signal) => signal.organisationId !== first.organisationId || signal.subjectId !== first.subjectId)) throw new Error("Cross-tenant or cross-subject risk scoring is prohibited.");
  if (signals.some((signal) => !Number.isInteger(signal.scoreBps) || signal.scoreBps < 0 || signal.scoreBps > 10_000 || !Number.isInteger(signal.confidenceBps) || signal.confidenceBps < 0 || signal.confidenceBps > 10_000 || !signal.evidenceIds.length)) throw new Error("Signals require bounded scores, confidence and evidence.");
  const weighted = signals.map((signal) => ({ signal, weight: weights[signal.type] ?? 1 }));
  if (weighted.some(({ weight }) => !Number.isInteger(weight) || weight <= 0)) throw new Error("Signal weights must be positive integers.");
  const totalWeight = weighted.reduce((sum, item) => sum + item.weight, 0);
  const scoreBps = Math.round(weighted.reduce((sum, { signal, weight }) => sum + signal.scoreBps * weight, 0) / totalWeight);
  const confidenceBps = Math.min(...signals.map((signal) => signal.confidenceBps));
  return { organisationId: first.organisationId, subjectId: first.subjectId, scoreBps, confidenceBps, modelVersion, signalIds: signals.map(({ signalId }) => signalId), reasonCodes: [...new Set(signals.map(({ reasonCode }) => reasonCode))], evidenceIds: [...new Set(signals.flatMap(({ evidenceIds }) => evidenceIds))] };
}

export function recordRiskDecision(input: Readonly<{ decisionId: string; score: RiskScore; ruleDecision: RuleDecision; capability: RiskCapability | null; scopeReference: string | null; startsAt: string; expiresAt: string | null; reviewRoute: string }>): RiskDecision {
  if (!allowedOutcomes.has(input.ruleDecision.outcome as RiskOutcome)) throw new Error("Rules Engine returned an unsupported risk outcome.");
  const outcome = input.ruleDecision.outcome as RiskOutcome;
  const scoped = outcome !== "ALLOW" && outcome !== "MONITOR" && outcome !== "HUMAN_REVIEW";
  if (scoped && (!input.capability || !input.scopeReference?.trim())) throw new Error("Restrictive outcomes require an exact capability and scope.");
  if ((outcome === "TEMPORARY_HOLD" || outcome.startsWith("RESTRICT_")) && (!input.expiresAt || Date.parse(input.expiresAt) <= Date.parse(input.startsAt))) throw new Error("Holds and restrictions require a valid expiry.");
  if (!input.reviewRoute.trim() || !input.ruleDecision.evidenceReferences.length) throw new Error("Review route and Rules Engine evidence are required.");
  return { decisionId: input.decisionId, organisationId: input.score.organisationId, subjectId: input.score.subjectId, outcome, capability: input.capability, scopeReference: input.scopeReference, startsAt: input.startsAt, expiresAt: input.expiresAt, score: input.score, ruleDecisionId: input.ruleDecision.decisionId, ruleSetVersion: input.ruleDecision.ruleSetVersion, ruleVersion: input.ruleDecision.ruleVersion, reasonCodes: [...new Set([...input.score.reasonCodes, ...input.ruleDecision.reasonCodes])], evidenceIds: [...new Set([...input.score.evidenceIds, ...input.ruleDecision.evidenceReferences])], reviewRoute: input.reviewRoute, customerValueErasedMinor: 0, generativeAiAuthority: false };
}

export function proposeRiskHold(decision: RiskDecision, input: Readonly<{ holdId: string; amountMinor: number; releaseRule: string; makerId: string }>): RiskHold {
  if ((decision.outcome !== "TEMPORARY_HOLD" && !decision.outcome.startsWith("RESTRICT_")) || !decision.capability || !decision.scopeReference || !decision.expiresAt) throw new Error("A scoped expiring restriction decision is required.");
  if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor < 0 || !input.releaseRule.trim() || !input.makerId.trim()) throw new Error("Hold amount, release rule and maker are required.");
  return { holdId: input.holdId, organisationId: decision.organisationId, decisionId: decision.decisionId, capability: decision.capability, scopeReference: decision.scopeReference, amountMinor: input.amountMinor, startsAt: decision.startsAt, expiresAt: decision.expiresAt, releaseRule: input.releaseRule, state: "PROPOSED", customerValueErasedMinor: 0, makerId: input.makerId, checkerId: null };
}

export function approveRiskHold(hold: RiskHold, input: Readonly<{ checkerId: string; stepUp: boolean; evidenceIds: readonly string[] }>): RiskHold {
  if (hold.state !== "PROPOSED" || !input.checkerId.trim() || input.checkerId === hold.makerId || !input.stepUp || !input.evidenceIds.length) throw new Error("Different-checker step-up approval with evidence is required.");
  return { ...hold, state: "APPROVED", checkerId: input.checkerId };
}

export function validateFairnessSnapshot(snapshot: FairnessSnapshot): "PASS" {
  if (snapshot.protectedAttributesUsed || snapshot.proxyTestStatus !== "PASS") throw new Error("Protected attributes and discriminatory proxy effects are prohibited.");
  if ([snapshot.falsePositiveRateBps, snapshot.medianReviewMinutes, snapshot.lossAvoidedMinor, snapshot.customerImpactCount].some((value) => !Number.isSafeInteger(value) || value < 0)) throw new Error("Fairness metrics must be non-negative integers.");
  return "PASS";
}
