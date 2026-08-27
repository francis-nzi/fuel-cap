import { describe, expect, it } from "vitest";
import { createOpenControlRegister, evaluatePhase6Launch, phase6ControlRequirements, type ApprovalEvidence, type PartnerReadiness } from "./index";

const requirement = phase6ControlRequirements[0];
const evidence: ApprovalEvidence = { evidenceId: "legal-opinion-1", controlId: requirement.controlId, status: "APPROVED", issuer: "independent-counsel", issuedAt: "2026-08-01T00:00:00Z", expiresAt: "2027-08-01T00:00:00Z", documentHash: "sha256:legal-opinion", makerActorId: "legal-owner", checkerActorId: "compliance-checker", market: requirement.market, legalEntityId: requirement.legalEntityId };
const partner: PartnerReadiness = { partnerId: "counsel-1", kind: requirement.requiredPartnerKind, environment: "PRODUCTION", contractApproved: true, dueDiligenceApproved: true, dataProcessingApproved: true, credentialIsolationVerified: true, webhookSecurityVerified: true, reconciliationCertified: true };
const run = (overrides = {}) => evaluatePhase6Launch({ requirements: [requirement], evidence: [evidence], partners: [partner], evaluatedAt: "2026-08-27T12:00:00Z", ...overrides });

describe("Phase 6 regulatory and partner launch mapping", () => {
  it("starts every canonical control open without inventing approval", () => { const register = createOpenControlRegister(); expect(register).toHaveLength(6); expect(register.every(({ status }) => status === "OPEN")).toBe(true); });
  it("maps UK, US and Canada product-classification controls", () => expect(new Set(phase6ControlRequirements.filter(({ domain }) => domain === "PRODUCT_CLASSIFICATION").map(({ market }) => market))).toEqual(new Set(["UK", "US", "CA"])));
  it("blocks when approval evidence is missing", () => expect(run({ evidence: [] })).toMatchObject({ decision: "BLOCKED", productionCredentialsMayBeProvisioned: false }));
  it("blocks expired evidence", () => expect(run({ evidence: [{ ...evidence, expiresAt: "2026-08-26T00:00:00Z" }] }).decision).toBe("BLOCKED"));
  it("blocks self-approved evidence", () => expect(run({ evidence: [{ ...evidence, checkerActorId: evidence.makerActorId }] }).decision).toBe("BLOCKED"));
  it("blocks evidence for another market or legal entity", () => expect(run({ evidence: [{ ...evidence, legalEntityId: "other-entity" }] }).decision).toBe("BLOCKED"));
  it("requires content-addressed evidence", () => expect(run({ evidence: [{ ...evidence, documentHash: "not-a-hash" }] }).decision).toBe("BLOCKED"));
  it("blocks sandbox partners from satisfying a production gate", () => expect(run({ partners: [{ ...partner, environment: "SANDBOX" }] }).decision).toBe("BLOCKED"));
  it.each(["contractApproved", "dueDiligenceApproved", "dataProcessingApproved", "credentialIsolationVerified", "webhookSecurityVerified", "reconciliationCertified"] as const)("blocks incomplete partner control %s", (field) => expect(run({ partners: [{ ...partner, [field]: false }] }).decision).toBe("BLOCKED"));
  it("permits credential provisioning only after every mapped control passes", () => expect(run()).toMatchObject({ decision: "READY", passedControlIds: [requirement.controlId], productionCredentialsMayBeProvisioned: true, auditEvidenceIds: [evidence.evidenceId] }));
  it("rejects an invalid evaluation timestamp", () => expect(() => run({ evaluatedAt: "not-a-date" })).toThrow(/valid timestamp/));
});
