import type { LaunchGateResult } from "@fuelcap/compliance";

export type VerificationKind = "KYC" | "KYB";
export type ScreeningType = "IDENTITY" | "BUSINESS_REGISTRY" | "BENEFICIAL_OWNER" | "SANCTIONS" | "PEP" | "ADVERSE_MEDIA";
export type VerificationRecommendation = "PASS" | "REQUEST_EVIDENCE" | "HUMAN_REVIEW" | "REJECT_PROVIDER_RESULT";
export interface VerificationRequest {
  readonly requestId: string; readonly idempotencyKey: string; readonly organisationId: string;
  readonly subjectId: string; readonly kind: VerificationKind; readonly market: "UK" | "US" | "CA";
  readonly purpose: "ONBOARDING" | "PERIODIC_REVIEW" | "TRIGGERED_REVIEW";
  readonly requestedChecks: readonly ScreeningType[]; readonly evidenceTokens: readonly string[];
}
export interface ProviderVerificationResult {
  readonly providerEventId: string; readonly requestId: string; readonly organisationId: string;
  readonly subjectId: string; readonly providerId: string; readonly environment: "SANDBOX" | "PRODUCTION";
  readonly receivedAt: string; readonly signatureVerified: boolean; readonly payloadHash: string;
  readonly checks: readonly Readonly<{ type: ScreeningType; outcome: "CLEAR" | "POSSIBLE_MATCH" | "CONFIRMED_MATCH" | "INCONCLUSIVE"; evidenceReference: string }>[];
}
export interface NormalizedVerificationDecision {
  readonly decisionId: string; readonly requestId: string; readonly organisationId: string; readonly subjectId: string;
  readonly recommendation: VerificationRecommendation; readonly reasonCodes: readonly string[];
  readonly providerId: string; readonly providerEventId: string; readonly providerEnvironment: "SANDBOX" | "PRODUCTION";
  readonly evidenceReferences: readonly string[]; readonly payloadHash: string; readonly decidedAt: string;
  readonly canMutateEligibility: false; readonly requiresHumanApproval: boolean; readonly immutable: true;
}

export function authorizeVerificationEnvironment(input: Readonly<{ environment: "SANDBOX" | "PRODUCTION"; launchGate: LaunchGateResult }>): void {
  if (input.environment === "PRODUCTION" && (input.launchGate.decision !== "READY" || !input.launchGate.productionCredentialsMayBeProvisioned)) throw new Error("Production KYC/KYB integration is blocked by the P6-001 launch gate.");
}

export function normalizeVerificationResult(input: Readonly<{ request: VerificationRequest; result: ProviderVerificationResult; launchGate: LaunchGateResult; seenProviderEventIds?: ReadonlySet<string> }>): NormalizedVerificationDecision {
  const { request, result } = input;
  authorizeVerificationEnvironment({ environment: result.environment, launchGate: input.launchGate });
  if (input.seenProviderEventIds?.has(result.providerEventId)) throw new Error("Duplicate provider event is blocked.");
  if (request.requestId !== result.requestId || request.organisationId !== result.organisationId || request.subjectId !== result.subjectId) throw new Error("Provider result scope does not match the verification request.");
  if (!result.signatureVerified || !result.payloadHash.startsWith("sha256:")) throw new Error("Verified webhook signature and content-addressed payload are required.");
  if (!request.evidenceTokens.length || request.evidenceTokens.some((token) => !token.startsWith("tok_"))) throw new Error("Tokenized evidence references are required; raw identity documents are prohibited.");
  if (!result.checks.length || result.checks.some((check) => !request.requestedChecks.includes(check.type) || !check.evidenceReference.startsWith("evd_"))) throw new Error("Provider checks require requested types and safe evidence references.");
  const outcomes = result.checks.map(({ outcome }) => outcome);
  const hasMatch = outcomes.some((outcome) => outcome === "POSSIBLE_MATCH" || outcome === "CONFIRMED_MATCH");
  const inconclusive = outcomes.includes("INCONCLUSIVE") || request.requestedChecks.some((type) => !result.checks.some((check) => check.type === type));
  const recommendation: VerificationRecommendation = hasMatch ? "HUMAN_REVIEW" : inconclusive ? "REQUEST_EVIDENCE" : "PASS";
  const reasonCodes = hasMatch ? result.checks.filter(({ outcome }) => outcome.includes("MATCH")).map(({ type, outcome }) => `${type}_${outcome}`) : inconclusive ? ["INCOMPLETE_OR_INCONCLUSIVE"] : ["ALL_REQUESTED_CHECKS_CLEAR"];
  return { decisionId: `verification:${result.providerEventId}`, requestId: request.requestId, organisationId: request.organisationId, subjectId: request.subjectId, recommendation, reasonCodes, providerId: result.providerId, providerEventId: result.providerEventId, providerEnvironment: result.environment, evidenceReferences: result.checks.map(({ evidenceReference }) => evidenceReference), payloadHash: result.payloadHash, decidedAt: result.receivedAt, canMutateEligibility: false, requiresHumanApproval: recommendation === "HUMAN_REVIEW", immutable: true };
}

export function createDeterministicSandboxResult(request: VerificationRequest, scenario: "CLEAR" | "POSSIBLE_SANCTIONS_MATCH" | "INCONCLUSIVE"): ProviderVerificationResult {
  const outcome = scenario === "CLEAR" ? "CLEAR" : scenario === "INCONCLUSIVE" ? "INCONCLUSIVE" : undefined;
  return { providerEventId: `sandbox:${request.requestId}:${scenario}`, requestId: request.requestId, organisationId: request.organisationId, subjectId: request.subjectId, providerId: "deterministic-identity-sandbox", environment: "SANDBOX", receivedAt: "2026-08-27T12:00:00.000Z", signatureVerified: true, payloadHash: `sha256:sandbox-${request.requestId}-${scenario}`, checks: request.requestedChecks.map((type) => ({ type, outcome: scenario === "POSSIBLE_SANCTIONS_MATCH" && type === "SANCTIONS" ? "POSSIBLE_MATCH" : outcome ?? "CLEAR", evidenceReference: `evd_${request.requestId}_${type}` })) };
}
