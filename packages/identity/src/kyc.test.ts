import { describe, expect, it } from "vitest";
import { authorizeVerificationEnvironment, createDeterministicSandboxResult, normalizeVerificationResult, type VerificationRequest } from "./kyc";

const blockedGate = { decision: "BLOCKED" as const, evaluatedAt: "2026-08-27T00:00:00Z", passedControlIds: [], blockers: ["external approvals open"], productionCredentialsMayBeProvisioned: false, auditEvidenceIds: [] };
const readyGate = { ...blockedGate, decision: "READY" as const, blockers: [], productionCredentialsMayBeProvisioned: true };
const request: VerificationRequest = { requestId: "VER-1", idempotencyKey: "idem-ver-1", organisationId: "ORG-1", subjectId: "CUS-1", kind: "KYC", market: "UK", purpose: "ONBOARDING", requestedChecks: ["IDENTITY", "SANCTIONS", "PEP"], evidenceTokens: ["tok_document_1"] };
const clear = createDeterministicSandboxResult(request, "CLEAR");
const run = (overrides = {}) => normalizeVerificationResult({ request, result: clear, launchGate: blockedGate, ...overrides });

describe("KYC/KYB and financial-crime adapters", () => {
  it("allows deterministic sandbox use while external approvals are open", () => expect(run()).toMatchObject({ recommendation: "PASS", providerEnvironment: "SANDBOX", canMutateEligibility: false, immutable: true }));
  it("blocks production while the P6-001 launch gate is blocked", () => expect(() => run({ result: { ...clear, environment: "PRODUCTION" } })).toThrow(/P6-001/));
  it("allows production boundary only when the launch gate permits credentials", () => expect(() => authorizeVerificationEnvironment({ environment: "PRODUCTION", launchGate: readyGate })).not.toThrow());
  it("rejects duplicate provider events", () => expect(() => run({ seenProviderEventIds: new Set([clear.providerEventId]) })).toThrow(/Duplicate/));
  it("rejects tenant, request or subject mismatches", () => { expect(() => run({ result: { ...clear, organisationId: "ORG-2" } })).toThrow(/scope/); expect(() => run({ result: { ...clear, subjectId: "CUS-2" } })).toThrow(/scope/); });
  it("requires authenticated, content-addressed webhooks", () => { expect(() => run({ result: { ...clear, signatureVerified: false } })).toThrow(/signature/); expect(() => run({ result: { ...clear, payloadHash: "raw" } })).toThrow(/content-addressed/); });
  it("prohibits raw document references", () => expect(() => run({ request: { ...request, evidenceTokens: ["passport.pdf"] } })).toThrow(/raw identity documents/));
  it("routes a possible sanctions match to human review without changing eligibility", () => expect(run({ result: createDeterministicSandboxResult(request, "POSSIBLE_SANCTIONS_MATCH") })).toMatchObject({ recommendation: "HUMAN_REVIEW", reasonCodes: ["SANCTIONS_POSSIBLE_MATCH"], requiresHumanApproval: true, canMutateEligibility: false }));
  it("requests evidence for inconclusive checks", () => expect(run({ result: createDeterministicSandboxResult(request, "INCONCLUSIVE") }).recommendation).toBe("REQUEST_EVIDENCE"));
  it("requests evidence when a provider omits a requested check", () => expect(run({ result: { ...clear, checks: clear.checks.slice(0, 2) } }).recommendation).toBe("REQUEST_EVIDENCE"));
  it("rejects provider-invented check types and unsafe evidence references", () => { expect(() => run({ result: { ...clear, checks: [{ type: "ADVERSE_MEDIA", outcome: "CLEAR", evidenceReference: "evd_1" }] } })).toThrow(/requested types/); expect(() => run({ result: { ...clear, checks: [{ ...clear.checks[0], evidenceReference: "raw-document" }] } })).toThrow(/safe evidence/); });
  it("produces stable sandbox events for safe replay testing", () => expect(createDeterministicSandboxResult(request, "CLEAR")).toEqual(clear));
});
