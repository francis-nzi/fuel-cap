export const RULES_ENGINE_VERSION = "rules-engine@1.0.0" as const;

export type RuleDomain = "QUOTE_ELIGIBILITY" | "PRICING" | "SPREAD_FX" | "ALLOCATION_SETTLEMENT" | "ROLLOVER_CANCELLATION" | "RISK_FRAUD" | "EXPOSURE_HEDGING" | "BILLING" | "COMMUNICATIONS" | "ADMIN_AUTHORIZATION";
export type RulePrecedence = "PROHIBITION_INVALIDITY" | "REGULATORY_LEGAL_ENTITY" | "RISK_FRAUD" | "PRODUCT" | "ORGANISATION_GROUP" | "PROMOTION_CUSTOMER_CHOICE" | "DEFAULT";
export type RuleSetState = "DRAFT" | "VALIDATED" | "APPROVED" | "SCHEDULED" | "PUBLISHED" | "SUPERSEDED" | "WITHDRAWN";
export type FactType = "STRING" | "NUMBER" | "BOOLEAN";
export type FactValue = string | number | boolean;
export type RestrictedOperator = "EQ" | "NEQ" | "GT" | "GTE" | "LT" | "LTE" | "IN";

export type FactSchema = Readonly<Record<string, FactType>>;
export type VersionedFacts = Readonly<{ factsVersion: string; values: Readonly<Record<string, FactValue>>; evidenceReferences: readonly string[] }>;
export type RuleCondition = Readonly<{ fact: string; operator: RestrictedOperator; value: FactValue | readonly FactValue[] }>;
export type Rule = Readonly<{ ruleId: string; ruleVersion: string; precedence: RulePrecedence; conditions: readonly RuleCondition[]; outcome: string; reasonCode: string; explanationTemplate: string; followUpActions: readonly string[]; calculatedValues?: Readonly<Record<string, number>> }>;
export type RuleSet = Readonly<{ ruleSetId: string; ruleSetVersion: string; domain: RuleDomain; state: RuleSetState; effectiveFrom: string; effectiveTo: string | null; supersedesVersion: string | null; schema: FactSchema; rules: readonly Rule[] }>;
export type RuleValidation = Readonly<{ validationId: string; ruleSetId: string; ruleSetVersion: string; status: "PASS" | "BLOCKED"; errors: readonly string[]; validatedAt: string; engineVersion: typeof RULES_ENGINE_VERSION }>;
export type ScenarioEvaluation = Readonly<{ scenarioId: string; facts: VersionedFacts; expectedOutcome: string; evaluatedAt: string }>;
export type RuleSimulation = Readonly<{ simulationId: string; ruleSetId: string; ruleSetVersion: string; scenarioCount: number; passedScenarioCount: number; changedOutcomeCount: number; status: "PASS" | "BLOCKED"; evaluatedAt: string }>;
export type RuleApproval = Readonly<{ approvalId: string; ruleSetId: string; ruleSetVersion: string; makerId: string; checkerId: string; assurance: "STEP_UP"; validationId: string; simulationId: string; approvedAt: string }>;
export type RuleDecision = Readonly<{ decisionId: string; engineVersion: typeof RULES_ENGINE_VERSION; ruleSetId: string; ruleSetVersion: string; ruleId: string; ruleVersion: string; factsVersion: string; outcome: string; matchedConditions: readonly string[]; failedConditions: readonly string[]; reasonCodes: readonly string[]; calculatedValues: Readonly<Record<string, number>>; followUpActions: readonly string[]; explanationTemplate: string; evidenceReferences: readonly string[]; evaluatedAt: string }>;

const precedenceOrder: Readonly<Record<RulePrecedence, number>> = { PROHIBITION_INVALIDITY: 0, REGULATORY_LEGAL_ENTITY: 1, RISK_FRAUD: 2, PRODUCT: 3, ORGANISATION_GROUP: 4, PROMOTION_CUSTOMER_CHOICE: 5, DEFAULT: 6 };
const validInstant = (value: string) => Number.isFinite(Date.parse(value));
const scalarType = (value: FactValue): FactType => typeof value === "string" ? "STRING" : typeof value === "number" ? "NUMBER" : "BOOLEAN";
const conditionText = (condition: RuleCondition) => `${condition.fact} ${condition.operator} ${Array.isArray(condition.value) ? `[${condition.value.join(",")}]` : String(condition.value)}`;

function conditionMatches(condition: RuleCondition, actual: FactValue): boolean {
  switch (condition.operator) {
    case "EQ": return actual === condition.value;
    case "NEQ": return actual !== condition.value;
    case "GT": return typeof actual === "number" && typeof condition.value === "number" && actual > condition.value;
    case "GTE": return typeof actual === "number" && typeof condition.value === "number" && actual >= condition.value;
    case "LT": return typeof actual === "number" && typeof condition.value === "number" && actual < condition.value;
    case "LTE": return typeof actual === "number" && typeof condition.value === "number" && actual <= condition.value;
    case "IN": return Array.isArray(condition.value) && condition.value.includes(actual);
  }
}

export function validateRuleSet(validationId: string, ruleSet: RuleSet, validatedAt: string): RuleValidation {
  const errors: string[] = [];
  if (!validInstant(ruleSet.effectiveFrom) || (ruleSet.effectiveTo !== null && (!validInstant(ruleSet.effectiveTo) || Date.parse(ruleSet.effectiveTo) <= Date.parse(ruleSet.effectiveFrom)))) errors.push("INVALID_EFFECTIVE_WINDOW");
  if (!validInstant(validatedAt)) errors.push("INVALID_VALIDATION_TIME");
  if (ruleSet.rules.length === 0 || !ruleSet.rules.some((rule) => rule.precedence === "DEFAULT" && rule.conditions.length === 0)) errors.push("MISSING_FALLBACK");
  const identities = new Set<string>();
  for (const rule of ruleSet.rules) {
    if (!rule.ruleId.trim() || !rule.ruleVersion.trim() || !rule.reasonCode.trim() || !rule.explanationTemplate.trim()) errors.push("INCOMPLETE_RULE");
    const identity = `${rule.ruleId}@${rule.ruleVersion}`;
    if (identities.has(identity)) errors.push("DUPLICATE_RULE");
    identities.add(identity);
    const equals = new Map<string, FactValue>();
    for (const condition of rule.conditions) {
      const expectedType = ruleSet.schema[condition.fact];
      if (!expectedType) { errors.push("UNKNOWN_FACT"); continue; }
      const values = Array.isArray(condition.value) ? condition.value : [condition.value];
      if ((condition.operator === "IN") !== Array.isArray(condition.value) || values.some((value) => scalarType(value) !== expectedType)) errors.push("TYPE_MISMATCH");
      if (["GT", "GTE", "LT", "LTE"].includes(condition.operator) && expectedType !== "NUMBER") errors.push("TYPE_MISMATCH");
      if (condition.operator === "EQ") {
        const prior = equals.get(condition.fact);
        if (prior !== undefined && prior !== condition.value) errors.push("CONFLICTING_CONDITION");
        if (!Array.isArray(condition.value)) equals.set(condition.fact, condition.value as FactValue);
      }
    }
  }
  return { validationId, ruleSetId: ruleSet.ruleSetId, ruleSetVersion: ruleSet.ruleSetVersion, status: errors.length === 0 ? "PASS" : "BLOCKED", errors: [...new Set(errors)], validatedAt, engineVersion: RULES_ENGINE_VERSION };
}

function assertFacts(schema: FactSchema, facts: VersionedFacts) {
  for (const [name, type] of Object.entries(schema)) {
    if (!(name in facts.values) || scalarType(facts.values[name]!) !== type) throw new Error(`Fact ${name} is missing or has the wrong type.`);
  }
}

export function evaluateRules(decisionId: string, ruleSet: RuleSet, facts: VersionedFacts, evaluatedAt: string): RuleDecision {
  if (ruleSet.state !== "PUBLISHED" || !validInstant(evaluatedAt) || Date.parse(evaluatedAt) < Date.parse(ruleSet.effectiveFrom) || (ruleSet.effectiveTo !== null && Date.parse(evaluatedAt) >= Date.parse(ruleSet.effectiveTo))) throw new Error("Rule set is not published and effective at the evaluation time.");
  assertFacts(ruleSet.schema, facts);
  const ordered = [...ruleSet.rules].sort((left, right) => precedenceOrder[left.precedence] - precedenceOrder[right.precedence] || left.ruleId.localeCompare(right.ruleId));
  for (const rule of ordered) {
    const results = rule.conditions.map((condition) => ({ text: conditionText(condition), matched: conditionMatches(condition, facts.values[condition.fact]!) }));
    if (results.every(({ matched }) => matched)) return { decisionId, engineVersion: RULES_ENGINE_VERSION, ruleSetId: ruleSet.ruleSetId, ruleSetVersion: ruleSet.ruleSetVersion, ruleId: rule.ruleId, ruleVersion: rule.ruleVersion, factsVersion: facts.factsVersion, outcome: rule.outcome, matchedConditions: results.map(({ text }) => text), failedConditions: [], reasonCodes: [rule.reasonCode], calculatedValues: { ...rule.calculatedValues }, followUpActions: [...rule.followUpActions], explanationTemplate: rule.explanationTemplate, evidenceReferences: [...facts.evidenceReferences], evaluatedAt };
  }
  throw new Error("Validated rule sets must have a matching fallback.");
}

export function simulateRuleSet(simulationId: string, ruleSet: RuleSet, scenarios: readonly ScenarioEvaluation[], evaluatedAt: string): RuleSimulation {
  const published = { ...ruleSet, state: "PUBLISHED" as const };
  const passedScenarioCount = scenarios.filter((scenario) => evaluateRules(`${simulationId}:${scenario.scenarioId}`, published, scenario.facts, scenario.evaluatedAt).outcome === scenario.expectedOutcome).length;
  return { simulationId, ruleSetId: ruleSet.ruleSetId, ruleSetVersion: ruleSet.ruleSetVersion, scenarioCount: scenarios.length, passedScenarioCount, changedOutcomeCount: scenarios.length - passedScenarioCount, status: passedScenarioCount === scenarios.length && scenarios.length > 0 ? "PASS" : "BLOCKED", evaluatedAt };
}

export function approveRuleSet(input: Readonly<{ approvalId: string; makerId: string; checkerId: string; assurance: "STEP_UP"; approvedAt: string }>, ruleSet: RuleSet, validation: RuleValidation, simulation: RuleSimulation): RuleApproval {
  if (input.makerId === input.checkerId) throw new Error("Maker and checker must differ.");
  if (!input.makerId.trim() || !input.checkerId.trim() || input.assurance !== "STEP_UP" || !validInstant(input.approvedAt)) throw new Error("Valid step-up approval is required.");
  if (validation.ruleSetId !== ruleSet.ruleSetId || validation.ruleSetVersion !== ruleSet.ruleSetVersion || validation.status !== "PASS" || simulation.ruleSetId !== ruleSet.ruleSetId || simulation.ruleSetVersion !== ruleSet.ruleSetVersion || simulation.status !== "PASS") throw new Error("Validation and canonical scenario regression must pass for this exact rule version.");
  return { ...input, ruleSetId: ruleSet.ruleSetId, ruleSetVersion: ruleSet.ruleSetVersion, validationId: validation.validationId, simulationId: simulation.simulationId };
}

export function publishRuleSet(ruleSet: RuleSet, approval: RuleApproval, publishedAt: string): RuleSet {
  if (approval.ruleSetId !== ruleSet.ruleSetId || approval.ruleSetVersion !== ruleSet.ruleSetVersion || !validInstant(publishedAt) || Date.parse(publishedAt) < Date.parse(approval.approvedAt)) throw new Error("Approval and publication lineage must agree.");
  return { ...ruleSet, state: Date.parse(ruleSet.effectiveFrom) > Date.parse(publishedAt) ? "SCHEDULED" : "PUBLISHED", rules: ruleSet.rules.map((rule) => ({ ...rule, conditions: rule.conditions.map((condition) => ({ ...condition })) })) };
}

export function replayRuleDecision(expected: RuleDecision, ruleSet: RuleSet, facts: VersionedFacts): RuleDecision {
  if (expected.ruleSetVersion !== ruleSet.ruleSetVersion || expected.factsVersion !== facts.factsVersion) throw new Error("Replay requires the original pinned rule and facts versions.");
  const replay = evaluateRules(expected.decisionId, ruleSet, facts, expected.evaluatedAt);
  if (JSON.stringify(replay) !== JSON.stringify(expected)) throw new Error("Historical replay diverged from the pinned decision.");
  return replay;
}
