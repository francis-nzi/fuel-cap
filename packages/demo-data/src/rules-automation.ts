import type { ScenarioId } from "./index";

export type RuleDomain = "ELIGIBILITY" | "PRICING" | "SPREAD_FX" | "RISK_FRAUD" | "BILLING" | "COMMUNICATIONS";
export type RuleLifecycle = "DRAFT" | "VALIDATED" | "PENDING_APPROVAL" | "SCHEDULED" | "PUBLISHED" | "SUPERSEDED" | "WITHDRAWN";
export type RestrictedOperator = "EQ" | "NEQ" | "GT" | "GTE" | "LT" | "LTE" | "IN" | "AND" | "OR" | "NOT";

export type RuleCondition = Readonly<{
  fact: "identity.status" | "pricing.eligible" | "customer.market" | "rollover.requested";
  operator: RestrictedOperator;
  value: string | boolean | readonly string[];
}>;

export type RuleSet = Readonly<{
  ruleSetId: string;
  domain: RuleDomain;
  ownerRole: "PA" | "RT" | "FR" | "CF";
  version: string;
  lifecycle: RuleLifecycle;
  effectiveFrom: string;
  effectiveTo: string | null;
  supersedesVersion: string | null;
  conditions: readonly RuleCondition[];
  outcome: "ELIGIBLE" | "HUMAN_REVIEW";
  reasonCode: string;
  explanationTemplate: string;
  provenance: "synthetic-seeded";
}>;

export const publishedEligibilityRule: RuleSet = {
  ruleSetId: "RULESET-ELIGIBILITY-010",
  domain: "ELIGIBILITY",
  ownerRole: "CF",
  version: "eligibility@1.3.0",
  lifecycle: "PUBLISHED",
  effectiveFrom: "2026-08-21T16:40:00.000Z",
  effectiveTo: null,
  supersedesVersion: "eligibility@1.2.0",
  conditions: [
    { fact: "identity.status", operator: "EQ", value: "CURRENT" },
    { fact: "pricing.eligible", operator: "EQ", value: true },
  ],
  outcome: "ELIGIBLE",
  reasonCode: "IDENTITY_AND_PRICE_CURRENT",
  explanationTemplate: "eligibility-approved-v3",
  provenance: "synthetic-seeded",
};

export const draftEligibilityRule: RuleSet = {
  ...publishedEligibilityRule,
  version: "eligibility@1.4.0-draft.1",
  lifecycle: "DRAFT",
  effectiveFrom: "2026-08-29T09:00:00.000Z",
  supersedesVersion: publishedEligibilityRule.version,
  conditions: [
    ...publishedEligibilityRule.conditions,
    { fact: "customer.market", operator: "IN", value: ["US", "CA", "UK"] },
  ],
  reasonCode: "IDENTITY_PRICE_AND_MARKET_CURRENT",
};

export const canonicalScenarioIds = [
  "flat-market-us", "rise-within-boundary-us", "boundary-breach-us", "falling-price-us",
  "multi-lock-partial-fill-us", "rollover-rise-fall-us", "no-valid-quote-uk", "eligibility-fraud-canada",
  "insufficient-funding-us", "fleet-multi-vehicle-us", "fx-movement-multi-market", "exposure-ai-recommendation",
] as const satisfies readonly ScenarioId[];

export const validationEvidence = {
  validationId: "RULE-VAL-ELG-014",
  expressionLanguage: "fuelcap-restricted-expressions@1.0",
  arbitraryCodeAllowed: false,
  checks: { types: "PASS", ranges: "PASS", conflicts: "PASS", unreachableBranches: "PASS", fallback: "PASS", compatibility: "PASS" },
  status: "PASS",
  validatedAt: "2026-08-25T15:10:00.000Z",
} as const;

export const blockingValidationEvidence = {
  validationId: "RULE-VAL-ELG-UNSAFE",
  expressionLanguage: "fuelcap-restricted-expressions@1.0",
  arbitraryCodeAllowed: false,
  checks: { types: "FAIL", ranges: "PASS", conflicts: "FAIL", unreachableBranches: "FAIL", fallback: "FAIL", compatibility: "PASS" },
  status: "BLOCKED",
  reasonCodes: ["TYPE_MISMATCH", "CONFLICTING_BRANCH", "UNREACHABLE_BRANCH", "MISSING_FALLBACK"],
} as const;

export const scenarioRegression = canonicalScenarioIds.map((scenarioId, index) => ({
  scenarioId,
  currentOutcome: scenarioId === "eligibility-fraud-canada" ? "HUMAN_REVIEW" : scenarioId === "no-valid-quote-uk" ? "NOT_QUOTE_ELIGIBLE" : "ELIGIBLE",
  proposedOutcome: scenarioId === "eligibility-fraud-canada" ? "HUMAN_REVIEW" : scenarioId === "no-valid-quote-uk" ? "NOT_QUOTE_ELIGIBLE" : "ELIGIBLE",
  changed: false,
  assertionCount: 8 + index,
  status: "PASS" as const,
}));

export const ruleImpact = {
  simulationId: "RULE-SIM-ELG-014",
  currentVersion: publishedEligibilityRule.version,
  proposedVersion: draftEligibilityRule.version,
  scenarioCount: scenarioRegression.length,
  passedScenarioCount: scenarioRegression.filter(({ status }) => status === "PASS").length,
  changedCustomers: 0,
  changedTransactions: 0,
  exposureDeltaMinor: 0,
  marginDeltaMinor: 0,
  reserveDeltaMinor: 0,
  operationalReviewDelta: 0,
  simulatedAt: "2026-08-25T15:11:00.000Z",
  status: "PASS",
} as const;

export const pinnedRuleDecision = {
  decisionId: "RULE-DEC-ELG-0088",
  ruleSetId: publishedEligibilityRule.ruleSetId,
  ruleVersion: publishedEligibilityRule.version,
  scenarioId: "eligibility-fraud-canada" as ScenarioId,
  outcome: "HUMAN_REVIEW",
  matchedConditions: ["pricing.eligible = true"],
  failedConditions: ["identity.status = CURRENT"],
  reasonCodes: ["IDENTITY_SIGNAL_CONFLICT", "HUMAN_REVIEW_REQUIRED"],
  calculatedValues: { retainedCustomerValueMinor: 692_000, heldFromRollover4dp: 48_600_000 },
  followUpActions: ["OPEN_CASE", "SEND_REVIEW_NOTICE"],
  evidenceReferences: ["CASE-CA-ON-018", validationEvidence.validationId],
  evaluatedAt: "2026-08-22T11:02:00.000Z",
  immutable: true,
} as const;

export function approveRulePublication(input: Readonly<{
  initiatedBy: string;
  approvedBy: string;
  initiatorRole: RuleSet["ownerRole"];
  approverRole: RuleSet["ownerRole"];
  requiredRole: RuleSet["ownerRole"];
  assurance: "standard" | "step-up";
  validationStatus: "PASS" | "BLOCKED";
  regressionPassed: boolean;
}>) {
  if (input.initiatedBy === input.approvedBy) throw new Error("Self-approval is prohibited.");
  if (input.initiatorRole !== input.requiredRole || input.approverRole !== input.requiredRole) throw new Error("Same-domain authority is required.");
  if (input.assurance !== "step-up") throw new Error("Step-up assurance is required.");
  if (input.validationStatus !== "PASS" || !input.regressionPassed) throw new Error("Validation and regression must pass.");
  return { requestId: "RULE-PUB-ELG-014", status: "SCHEDULED" as const, effectiveAt: draftEligibilityRule.effectiveFrom, liveAutonomousPublication: false };
}

export function replayPinnedRuleDecision(ruleVersion: string, factsVersion: string, clock: string) {
  if (ruleVersion !== pinnedRuleDecision.ruleVersion || factsVersion !== "eligibility-facts@1.0" || clock !== pinnedRuleDecision.evaluatedAt) throw new Error("Replay requires the original pinned inputs.");
  return pinnedRuleDecision;
}
