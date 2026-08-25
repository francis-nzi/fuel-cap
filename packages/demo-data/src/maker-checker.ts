export type GovernedActionState = "DRAFT" | "VALIDATED" | "SIMULATED" | "PENDING_APPROVAL" | "APPROVED" | "EXECUTING" | "EXECUTED" | "VERIFIED";

export type GovernedActionRequest = Readonly<{
  requestId: string;
  requestVersion: number;
  actionType: "INTEGRATION_CONFIGURATION_CHANGE";
  state: GovernedActionState;
  organisationId: "org-fuelcap-global";
  environment: "demo";
  workspace: "platform-integrations-audit";
  targetType: "INTEGRATION_ADAPTER";
  targetId: "adapter-stripe";
  makerId: string;
  makerRole: "DI";
  requestedEffectiveAt: string;
  maintenanceWindow: string;
  capabilityScope: "payment-observation-ingest";
  customerImpact: "NONE";
  moneyMovement: false;
  integrityImpact: "TEST_ADAPTER_RESTART";
  beforeHash: string;
  afterHash: string;
  credentialReference: string;
  secretValueDisplayed: false;
  reason: string;
  evidenceIds: readonly string[];
  evidenceDigest: string;
  compatibilityStatus: "PENDING" | "PASS";
  rollbackReference: string;
  requiredApproverRoles: readonly ["DI", "PA"];
  differentPrincipalRequired: true;
  stepUpRequired: true;
  authzPolicyVersion: string;
  clock: string;
  correlationId: string;
  causationId: string;
  approval: Readonly<{ checkerId: string; checkerRole: "DI" | "PA"; assurance: "step-up"; requestVersion: number; evidenceDigest: string; approvedAt: string; approvalHash: string }> | null;
  executorId: string | null;
  executionHash: string | null;
  verificationEvidenceId: string | null;
  immutableTransitionIds: readonly string[];
}>;

export const draftConfigurationRequest: GovernedActionRequest = {
  requestId: "GA-INT-CONFIG-0092", requestVersion: 1, actionType: "INTEGRATION_CONFIGURATION_CHANGE", state: "DRAFT",
  organisationId: "org-fuelcap-global", environment: "demo", workspace: "platform-integrations-audit", targetType: "INTEGRATION_ADAPTER", targetId: "adapter-stripe",
  makerId: "principal-data-maker", makerRole: "DI", requestedEffectiveAt: "2026-08-26T09:00:00.000Z", maintenanceWindow: "2026-08-26T09:00:00.000Z/2026-08-26T09:15:00.000Z",
  capabilityScope: "payment-observation-ingest", customerImpact: "NONE", moneyMovement: false, integrityImpact: "TEST_ADAPTER_RESTART",
  beforeHash: "sha256:stripe-test-config-v4", afterHash: "sha256:stripe-test-config-v5", credentialReference: "secret://stripe/test-v2", secretValueDisplayed: false,
  reason: "Rotate the test credential reference after the simulated invalid-signature incident.", evidenceIds: ["INC-WEBHOOK-0091", "RULE-VAL-CONFIG-0092", "ROLLBACK-ADAPTER-STRIPE-TEST-0092"], evidenceDigest: "sha256:evidence-ga-0092-v1",
  compatibilityStatus: "PENDING", rollbackReference: "ROLLBACK-ADAPTER-STRIPE-TEST-0092", requiredApproverRoles: ["DI", "PA"], differentPrincipalRequired: true, stepUpRequired: true,
  authzPolicyVersion: "admin-authz-demo-1.0.0", clock: "2026-08-25T16:33:00.000Z", correlationId: "CORR-CONFIG-0092", causationId: "INC-WEBHOOK-0091",
  approval: null, executorId: null, executionHash: null, verificationEvidenceId: null, immutableTransitionIds: ["GA-EVT-0092-DRAFT"],
};

const next = (request: GovernedActionRequest, state: GovernedActionState, transitionId: string, changes: Partial<GovernedActionRequest> = {}): GovernedActionRequest => ({ ...request, ...changes, state, immutableTransitionIds: [...request.immutableTransitionIds, transitionId] });
const requireState = (request: GovernedActionRequest, expected: GovernedActionState) => { if (request.state !== expected) throw new Error(`Invalid transition from ${request.state}; expected ${expected}.`); };

export function validateGovernedAction(request: GovernedActionRequest) {
  requireState(request, "DRAFT");
  if (!request.reason.trim() || !request.evidenceIds.length || !request.rollbackReference.trim()) throw new Error("Complete reason, evidence and rollback are required.");
  if (request.secretValueDisplayed || !request.credentialReference.startsWith("secret://")) throw new Error("Only a hidden secret reference is permitted.");
  if (request.beforeHash === request.afterHash) throw new Error("A typed configuration change is required.");
  return next(request, "VALIDATED", "GA-EVT-0092-VALIDATED", { compatibilityStatus: "PASS" });
}

export function simulateGovernedAction(request: GovernedActionRequest) {
  requireState(request, "VALIDATED");
  if (request.compatibilityStatus !== "PASS" || request.customerImpact !== "NONE" || request.moneyMovement) throw new Error("Safe compatible simulation is required.");
  return next(request, "SIMULATED", "GA-EVT-0092-SIMULATED");
}

export function requestGovernedApproval(request: GovernedActionRequest) { requireState(request, "SIMULATED"); return next(request, "PENDING_APPROVAL", "GA-EVT-0092-PENDING"); }

export function approveGovernedAction(request: GovernedActionRequest, input: Readonly<{ checkerId: string; checkerRole: "DI" | "PA" | "OP"; assurance: "standard" | "step-up"; requestVersion: number; evidenceDigest: string }>) {
  requireState(request, "PENDING_APPROVAL");
  if (input.checkerId === request.makerId) throw new Error("Self-approval is prohibited.");
  if (input.checkerRole !== "DI" && input.checkerRole !== "PA") throw new Error("Different DI or PA approval is required.");
  if (input.assurance !== "step-up") throw new Error("Fresh step-up assurance is required.");
  if (input.requestVersion !== request.requestVersion) throw new Error("Stale request version cannot be approved.");
  if (input.evidenceDigest !== request.evidenceDigest) throw new Error("Changed evidence requires a new approval.");
  const approval = { checkerId: input.checkerId, checkerRole: input.checkerRole, assurance: input.assurance, requestVersion: input.requestVersion, evidenceDigest: input.evidenceDigest, approvedAt: "2026-08-25T16:34:00.000Z", approvalHash: "sha256:approval-ga-0092-v1" } as const;
  return next(request, "APPROVED", "GA-EVT-0092-APPROVED", { approval });
}

export function beginGovernedExecution(request: GovernedActionRequest, requestVersion: number, evidenceDigest: string) {
  requireState(request, "APPROVED");
  if (!request.approval || request.approval.requestVersion !== requestVersion || request.approval.evidenceDigest !== evidenceDigest || request.requestVersion !== requestVersion || request.evidenceDigest !== evidenceDigest) throw new Error("Executor requires the exact bound approval.");
  return next(request, "EXECUTING", "GA-EVT-0092-EXECUTING", { executorId: "configuration-deployer" });
}

export function completeGovernedExecution(request: GovernedActionRequest) { requireState(request, "EXECUTING"); return next(request, "EXECUTED", "GA-EVT-0092-EXECUTED", { executionHash: request.afterHash }); }
export function verifyGovernedExecution(request: GovernedActionRequest, healthEvidenceId: string) { requireState(request, "EXECUTED"); if (!healthEvidenceId.trim()) throw new Error("Post-change health evidence is required."); return next(request, "VERIFIED", "GA-EVT-0092-VERIFIED", { verificationEvidenceId: healthEvidenceId }); }

export function runRepresentativeMakerCheckerFlow() {
  const validated = validateGovernedAction(draftConfigurationRequest);
  const simulated = simulateGovernedAction(validated);
  const pending = requestGovernedApproval(simulated);
  const approved = approveGovernedAction(pending, { checkerId: "principal-platform-checker", checkerRole: "PA", assurance: "step-up", requestVersion: pending.requestVersion, evidenceDigest: pending.evidenceDigest });
  const executing = beginGovernedExecution(approved, approved.requestVersion, approved.evidenceDigest);
  return verifyGovernedExecution(completeGovernedExecution(executing), "HEALTH-CHECK-0092");
}
