import { describe, expect, it } from "vitest";
import { approveRuleSet, evaluateRules, publishRuleSet, replayRuleDecision, simulateRuleSet, validateRuleSet, type RuleSet, type VersionedFacts } from "./index";

const draft: RuleSet = { ruleSetId: "ELIGIBILITY-1", ruleSetVersion: "eligibility@2.0.0", domain: "QUOTE_ELIGIBILITY", state: "DRAFT", effectiveFrom: "2026-08-26T12:00:00.000Z", effectiveTo: null, supersedesVersion: "eligibility@1.3.0", schema: { "identity.current": "BOOLEAN", "pricing.eligible": "BOOLEAN", "risk.score": "NUMBER", "customer.market": "STRING" }, rules: [
  { ruleId: "INVALID-PRICE", ruleVersion: "1", precedence: "PROHIBITION_INVALIDITY", conditions: [{ fact: "pricing.eligible", operator: "EQ", value: false }], outcome: "NOT_QUOTE_ELIGIBLE", reasonCode: "PRICE_INVALID", explanationTemplate: "price-unavailable-v1", followUpActions: ["NOTIFY_AVAILABILITY"] },
  { ruleId: "RISK-REVIEW", ruleVersion: "1", precedence: "RISK_FRAUD", conditions: [{ fact: "risk.score", operator: "GTE", value: 70 }], outcome: "HUMAN_REVIEW", reasonCode: "RISK_REVIEW_REQUIRED", explanationTemplate: "review-required-v1", followUpActions: ["OPEN_CASE"] },
  { ruleId: "MARKET", ruleVersion: "1", precedence: "PRODUCT", conditions: [{ fact: "identity.current", operator: "EQ", value: true }, { fact: "customer.market", operator: "IN", value: ["US", "CA", "UK"] }], outcome: "ELIGIBLE", reasonCode: "ELIGIBILITY_CONFIRMED", explanationTemplate: "eligible-v1", followUpActions: [] },
  { ruleId: "FALLBACK", ruleVersion: "1", precedence: "DEFAULT", conditions: [], outcome: "INELIGIBLE", reasonCode: "ELIGIBILITY_FAILED", explanationTemplate: "ineligible-v1", followUpActions: ["SHOW_SUPPORT_PATH"] },
] };
const facts = (overrides: Partial<VersionedFacts["values"]> = {}): VersionedFacts => ({ factsVersion: "facts@1.0.0", values: { "identity.current": true, "pricing.eligible": true, "risk.score": 10, "customer.market": "US", ...overrides }, evidenceReferences: ["CUSTOMER-1", "PRICE-1"] });
const validation = () => validateRuleSet("VALIDATION-1", draft, "2026-08-26T11:50:00.000Z");
const scenarios = [
  { scenarioId: "normal", facts: facts(), expectedOutcome: "ELIGIBLE", evaluatedAt: "2026-08-26T12:01:00.000Z" },
  { scenarioId: "no-price", facts: facts({ "pricing.eligible": false, "risk.score": 90 }), expectedOutcome: "NOT_QUOTE_ELIGIBLE", evaluatedAt: "2026-08-26T12:01:00.000Z" },
  { scenarioId: "risk", facts: facts({ "risk.score": 75 }), expectedOutcome: "HUMAN_REVIEW", evaluatedAt: "2026-08-26T12:01:00.000Z" },
  { scenarioId: "market", facts: facts({ "customer.market": "AU" }), expectedOutcome: "INELIGIBLE", evaluatedAt: "2026-08-26T12:01:00.000Z" },
] as const;
const simulation = () => simulateRuleSet("SIMULATION-1", draft, scenarios, "2026-08-26T11:51:00.000Z");
const approval = () => approveRuleSet({ approvalId: "APPROVAL-1", makerId: "rules-maker", checkerId: "rules-checker", assurance: "STEP_UP", approvedAt: "2026-08-26T11:55:00.000Z" }, draft, validation(), simulation());
const published = () => publishRuleSet(draft, approval(), "2026-08-26T12:00:00.000Z");

describe("rules engine", () => {
  it("validates a typed restricted rule set with an explicit fallback", () => expect(validation()).toMatchObject({ status: "PASS", errors: [] }));
  it("blocks unknown facts, type errors, conflicts and missing fallbacks", () => { const invalid: RuleSet = { ...draft, rules: [{ ...draft.rules[0]!, conditions: [{ fact: "unknown", operator: "EQ", value: true }, { fact: "identity.current", operator: "EQ", value: true }, { fact: "identity.current", operator: "EQ", value: false }, { fact: "customer.market", operator: "GT", value: "US" }] }] }; expect(validateRuleSet("BAD", invalid, "2026-08-26T11:50:00.000Z")).toMatchObject({ status: "BLOCKED", errors: expect.arrayContaining(["MISSING_FALLBACK", "UNKNOWN_FACT", "CONFLICTING_CONDITION", "TYPE_MISMATCH"]) }); });
  it("applies prohibition before risk even when both match", () => expect(evaluateRules("D1", published(), facts({ "pricing.eligible": false, "risk.score": 90 }), "2026-08-26T12:01:00.000Z")).toMatchObject({ outcome: "NOT_QUOTE_ELIGIBLE", ruleId: "INVALID-PRICE" }));
  it("applies risk before product eligibility", () => expect(evaluateRules("D2", published(), facts({ "risk.score": 75 }), "2026-08-26T12:01:00.000Z")).toMatchObject({ outcome: "HUMAN_REVIEW", followUpActions: ["OPEN_CASE"] }));
  it("returns governed explanations, reasons and evidence", () => expect(evaluateRules("D3", published(), facts(), "2026-08-26T12:01:00.000Z")).toMatchObject({ outcome: "ELIGIBLE", reasonCodes: ["ELIGIBILITY_CONFIRMED"], explanationTemplate: "eligible-v1", evidenceReferences: ["CUSTOMER-1", "PRICE-1"] }));
  it("uses the explicit default when no conditional rule matches", () => expect(evaluateRules("D4", published(), facts({ "identity.current": false, "customer.market": "AU" }), "2026-08-26T12:01:00.000Z").outcome).toBe("INELIGIBLE"));
  it("rejects missing or incorrectly typed facts", () => expect(() => evaluateRules("BAD", published(), { ...facts(), values: { ...facts().values, "risk.score": "high" } }, "2026-08-26T12:01:00.000Z")).toThrow(/wrong type/i));
  it("enforces effective dating without retrospective use", () => { expect(() => evaluateRules("EARLY", published(), facts(), "2026-08-26T11:59:59.000Z")).toThrow(/effective/i); });
  it("requires every supplied regression scenario to match", () => { expect(simulation()).toMatchObject({ scenarioCount: 4, passedScenarioCount: 4, status: "PASS" }); expect(simulateRuleSet("BAD", draft, [{ ...scenarios[0], expectedOutcome: "INELIGIBLE" }], "2026-08-26T11:51:00.000Z").status).toBe("BLOCKED"); });
  it("requires a different step-up checker and exact green evidence", () => { expect(approval().checkerId).toBe("rules-checker"); expect(() => approveRuleSet({ approvalId: "A", makerId: "same", checkerId: "same", assurance: "STEP_UP", approvedAt: "2026-08-26T11:55:00.000Z" }, draft, validation(), simulation())).toThrow(/differ/i); expect(() => approveRuleSet({ approvalId: "A", makerId: "maker", checkerId: "checker", assurance: "STEP_UP", approvedAt: "2026-08-26T11:55:00.000Z" }, draft, { ...validation(), status: "BLOCKED" }, simulation())).toThrow(/regression/i); });
  it("schedules future rules and publishes currently effective rules", () => { expect(published().state).toBe("PUBLISHED"); expect(publishRuleSet({ ...draft, effectiveFrom: "2026-08-27T12:00:00.000Z" }, approval(), "2026-08-26T12:00:00.000Z").state).toBe("SCHEDULED"); });
  it("replays only the exact pinned facts, rules and clock", () => { const decision = evaluateRules("REPLAY-1", published(), facts(), "2026-08-26T12:01:00.000Z"); expect(replayRuleDecision(decision, published(), facts())).toEqual(decision); expect(() => replayRuleDecision(decision, published(), { ...facts(), factsVersion: "facts@latest" })).toThrow(/original pinned/i); });
});
