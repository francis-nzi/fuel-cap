export type AiCapability =
  | "OPERATIONAL_SUMMARY" | "CUSTOMER_EXPLANATION" | "ANOMALY_INTERPRETATION"
  | "CASE_EVIDENCE_SUMMARY" | "RULE_IMPACT_EXPLANATION" | "GOVERNED_ACTION_DRAFT"
  | "COMMUNICATIONS_DRAFT" | "SCENARIO_REHEARSAL" | "OPERATOR_ASSISTANCE";
export type DataClassification = "PUBLIC" | "INTERNAL" | "CONFIDENTIAL" | "RESTRICTED";
export type EvaluationDimension = "FACTUALITY" | "CITATION_CORRECTNESS" | "ABSTENTION" | "PROMPT_INJECTION" | "TENANT_ISOLATION" | "HARMFUL_ACTION" | "BIAS" | "LATENCY" | "COST";
export type ConfigurationStatus = "DRAFT" | "APPROVED" | "PUBLISHED" | "SUPERSEDED";

export interface AiConfiguration {
  readonly configurationId: string; readonly version: string; readonly status: ConfigurationStatus;
  readonly capability: AiCapability; readonly provider: string; readonly model: string;
  readonly promptVersion: string; readonly systemInstructionVersion: string; readonly toolVersion: string;
  readonly retrievalVersion: string; readonly outputSchemaVersion: string; readonly evaluationSetVersion: string;
  readonly regions: readonly string[]; readonly dataClassifications: readonly DataClassification[];
  readonly latencyBudgetMs: number; readonly costBudgetMicros: number; readonly fallbackModel: string;
  readonly killSwitch: boolean; readonly ownerActorId: string; readonly checkerActorId?: string;
}

export interface EvaluationResult { readonly dimension: EvaluationDimension; readonly passed: boolean; readonly scoreBps: number; readonly evidenceId: string; }
const requiredDimensions: readonly EvaluationDimension[] = ["FACTUALITY", "CITATION_CORRECTNESS", "ABSTENTION", "PROMPT_INJECTION", "TENANT_ISOLATION", "HARMFUL_ACTION", "BIAS", "LATENCY", "COST"];

export function approveConfiguration(configuration: AiConfiguration, checkerActorId: string, results: readonly EvaluationResult[]): AiConfiguration {
  if (configuration.status !== "DRAFT") throw new Error("Only a draft AI configuration can be approved");
  if (checkerActorId === configuration.ownerActorId) throw new Error("AI configuration approval requires a different checker");
  const resultByDimension = new Map(results.map((result) => [result.dimension, result]));
  const failed = requiredDimensions.filter((dimension) => !resultByDimension.get(dimension)?.passed);
  if (failed.length) throw new Error(`AI evaluation gate failed: ${failed.join(", ")}`);
  return { ...configuration, status: "APPROVED", checkerActorId };
}

export function publishConfiguration(configuration: AiConfiguration): AiConfiguration {
  if (configuration.status !== "APPROVED" || !configuration.checkerActorId) throw new Error("Only a checked AI configuration can be published");
  return { ...configuration, status: "PUBLISHED" };
}

export interface EvidenceRecord { readonly evidenceId: string; readonly tenantId: string; readonly classification: DataClassification; readonly immutable: boolean; readonly authorised: boolean; }
export type RequestedAction = "READ" | "DRAFT" | "RECOMMEND" | "APPROVE" | "EXECUTE" | "MOVE_MONEY" | "ALTER_ELIGIBILITY" | "PUBLISH_CONFIGURATION";
export interface AiRequest { readonly interactionId: string; readonly tenantId: string; readonly actorId: string; readonly purpose: string; readonly capability: AiCapability; readonly evidence: readonly EvidenceRecord[]; readonly untrustedText?: string; readonly requestedAction: RequestedAction; }
export type AiPolicyDecision = "ALLOW" | "VERIFY" | "ABSTAIN" | "BLOCK" | "FALLBACK";
export interface GovernedAiOutput { readonly decision: AiPolicyDecision; readonly facts: readonly string[]; readonly calculation: readonly string[]; readonly inference: readonly string[]; readonly recommendation: readonly string[]; readonly citations: readonly string[]; readonly confidenceBps: number; readonly humanRoute: string | null; readonly readOnly: true; readonly canApprove: false; readonly canExecute: false; }
export interface AiAuditRecord { readonly interactionId: string; readonly tenantId: string; readonly actorId: string; readonly purpose: string; readonly evidenceIds: readonly string[]; readonly configurationId: string; readonly configurationVersion: string; readonly promptVersion: string; readonly model: string; readonly output: GovernedAiOutput; readonly policyDecision: AiPolicyDecision; readonly subsequentHumanAction: null; }

const injectionPatterns = [/ignore (all|previous) instructions/i, /system prompt/i, /execute (a |the )?tool/i, /reveal (a |the )?secret/i, /cross[- ]tenant/i, /approve (it|this)/i];
const prohibitedActions = new Set<RequestedAction>(["APPROVE", "EXECUTE", "MOVE_MONEY", "ALTER_ELIGIBILITY", "PUBLISH_CONFIGURATION"]);
const blocked = (decision: AiPolicyDecision, route: string): GovernedAiOutput => ({ decision, facts: [], calculation: [], inference: [], recommendation: [], citations: [], confidenceBps: 0, humanRoute: route, readOnly: true, canApprove: false, canExecute: false });

export function governAiInteraction(input: Readonly<{ configuration: AiConfiguration; request: AiRequest; confidenceBps: number; facts: readonly string[]; calculation?: readonly string[]; inference?: readonly string[]; recommendation?: readonly string[]; citedEvidenceIds: readonly string[] }>): { output: GovernedAiOutput; audit: AiAuditRecord } {
  const { configuration, request } = input;
  let output: GovernedAiOutput;
  if (configuration.status !== "PUBLISHED" || configuration.capability !== request.capability) output = blocked("BLOCK", "Use an approved configuration for this capability.");
  else if (configuration.killSwitch) output = blocked("FALLBACK", `Use deterministic fallback ${configuration.fallbackModel}.`);
  else if (prohibitedActions.has(request.requestedAction)) output = blocked("BLOCK", "Return to evidence, simulation, step-up and human approval.");
  else if (request.untrustedText && injectionPatterns.some((pattern) => pattern.test(request.untrustedText!))) output = blocked("BLOCK", "Review the isolated untrusted source safely.");
  else if (request.evidence.some((record) => record.tenantId !== request.tenantId || !record.authorised || !record.immutable || !configuration.dataClassifications.includes(record.classification))) output = blocked("BLOCK", "Correct tenant scope, authorisation, immutability or classification.");
  else {
    const permittedIds = new Set(request.evidence.map(({ evidenceId }) => evidenceId));
    const citationsValid = input.citedEvidenceIds.length > 0 && input.citedEvidenceIds.every((id) => permittedIds.has(id));
    if (!citationsValid || input.confidenceBps < 6000) output = blocked("ABSTAIN", "Use deterministic search or human review.");
    else {
      const decision: AiPolicyDecision = input.confidenceBps < 8500 ? "VERIFY" : "ALLOW";
      output = { decision, facts: input.facts, calculation: input.calculation ?? [], inference: input.inference ?? [], recommendation: input.recommendation ?? [], citations: input.citedEvidenceIds, confidenceBps: input.confidenceBps, humanRoute: decision === "VERIFY" ? "Verify the evidence before relying on this output." : null, readOnly: true, canApprove: false, canExecute: false };
    }
  }
  const audit: AiAuditRecord = { interactionId: request.interactionId, tenantId: request.tenantId, actorId: request.actorId, purpose: request.purpose, evidenceIds: request.evidence.map(({ evidenceId }) => evidenceId), configurationId: configuration.configurationId, configurationVersion: configuration.version, promptVersion: configuration.promptVersion, model: configuration.model, output, policyDecision: output.decision, subsequentHumanAction: null };
  return { output, audit };
}
