export type AdapterMode = "LIVE" | "TEST" | "MOCK" | "SIMULATED";
export type ServiceHealth = "HEALTHY" | "DEGRADED" | "BLOCKED";

export const platformRelease = {
  service: "fuelcap-app",
  environment: "production",
  deploymentCommit: "a56110f",
  releaseVersion: "admin-demonstrator@1.0",
  checkedAt: "2026-08-25T16:36:59.360Z",
  health: "HEALTHY" as ServiceHealth,
  productionGradeSloClaimed: false,
  provenance: "deployment-health",
} as const;

export const serviceChecks = [
  { serviceId: "admin-web", owner: "Platform", dependency: "Next.js runtime", health: "HEALTHY" as ServiceHealth, freshnessSeconds: 8, sli: "HTTP availability", objective: "Demonstrator health only" },
  { serviceId: "demo-runtime", owner: "Platform", dependency: "Injected scenario clock", health: "HEALTHY" as ServiceHealth, freshnessSeconds: 12, sli: "Scenario readiness", objective: "12/12 deterministic scenarios" },
  { serviceId: "webhook-worker", owner: "Data & Integrations", dependency: "Mock provider queue", health: "DEGRADED" as ServiceHealth, freshnessSeconds: 95, sli: "Receipt processing", objective: "Simulated incident" },
] as const;

export const adapters = [
  { adapterId: "adapter-stripe", purpose: "Payment observations", mode: "TEST" as AdapterMode, contractVersion: "payments@1.0", compatible: true, credentialReference: "secret://stripe/test", credentialHealthy: true, secretDisplayed: false },
  { adapterId: "adapter-xero", purpose: "Accounting projection", mode: "SIMULATED" as AdapterMode, contractVersion: "accounting@1.0", compatible: true, credentialReference: null, credentialHealthy: null, secretDisplayed: false },
  { adapterId: "adapter-pricing", purpose: "Pricing observations", mode: "MOCK" as AdapterMode, contractVersion: "pricing@1.4", compatible: true, credentialReference: null, credentialHealthy: null, secretDisplayed: false },
] as const;

export const webhookReceipt = {
  receiptId: "WH-RCPT-0091",
  adapterId: "adapter-stripe",
  organisationId: "org-fuelcap-global",
  eventType: "PaymentObserved",
  schemaVersion: "payments@1.0",
  aggregateId: "PAY-DEMO-0091",
  sequence: 3,
  occurredAt: "2026-08-25T16:30:00.000Z",
  recordedAt: "2026-08-25T16:30:01.125Z",
  correlationId: "CORR-PROTECTION-0042",
  causationId: "CMD-PAYMENT-0091",
  idempotencyKey: "stripe-test:evt_demo_0091",
  provenance: "provider-test-observation",
  signatureValid: false,
  authenticationValid: true,
  replayProtected: true,
  tenantValid: true,
  schemaCompatible: true,
  rawPayloadHash: "sha256:webhook-receipt-0091",
  rawPayloadDisplayed: false,
  processingState: "DEAD_LETTER",
  reasonCode: "INVALID_SIGNATURE",
  retryCount: 0,
  deadLetterOwner: "Data & Integrations",
} as const;

export const correlationTrace = [
  { step: 1, domain: "QUOTE", recordId: "QUOTE-GLOBAL-1101", correlationId: webhookReceipt.correlationId, state: "ACCEPTED" },
  { step: 2, domain: "PROTECTION", recordId: "PRT-ALEX-0020", correlationId: webhookReceipt.correlationId, state: "CREATED" },
  { step: 3, domain: "LEDGER", recordId: "JRN-PROTECTION-0020", correlationId: webhookReceipt.correlationId, state: "POSTED" },
  { step: 4, domain: "SETTLEMENT", recordId: "SETTLE-0042", correlationId: webhookReceipt.correlationId, state: "COMPLETED" },
  { step: 5, domain: "COMMUNICATION", recordId: "COMM-ROLLOVER-PRE-0042", correlationId: webhookReceipt.correlationId, state: "DELIVERED" },
  { step: 6, domain: "ACCOUNTING_HEDGING", recordId: "PROJ-XERO-HEDGE-0042", correlationId: webhookReceipt.correlationId, state: "SIMULATED" },
] as const;

export const incident = {
  incidentId: "INC-WEBHOOK-0091",
  title: "Invalid provider signature blocked",
  technicalSeverity: "SEV3",
  customerMoneyRisk: "NONE",
  dataPrivacyRisk: "NONE",
  pricingIntegrityRisk: "NONE",
  regulatoryImpact: "NONE",
  affectedCapability: "TEST_PAYMENT_OBSERVATIONS",
  affectedCustomers: 0,
  runbookId: "RUNBOOK-WEBHOOK-SIGNATURE-01",
  containment: "Receipt quarantined; no domain command emitted",
  rollbackReference: "ROLLBACK-ADAPTER-STRIPE-TEST-0089",
  recoveryVerification: "Awaiting valid signed test receipt",
  state: "OPEN",
  simulated: true,
} as const;

export const configurationProposal = {
  proposalId: "INT-CONFIG-0092",
  adapterId: "adapter-stripe",
  environment: "test",
  capabilityScope: "payment-observation-ingest",
  beforeConfigurationHash: "sha256:stripe-test-config-v4",
  afterConfigurationHash: "sha256:stripe-test-config-v5",
  credentialReference: "secret://stripe/test-v2",
  secretValueDisplayed: false,
  compatibilityStatus: "PASS",
  impactStatus: "NO_DOMAIN_MUTATION",
  rollbackReference: "ROLLBACK-ADAPTER-STRIPE-TEST-0092",
  maintenanceWindow: "2026-08-26T09:00:00.000Z/2026-08-26T09:15:00.000Z",
  state: "DRAFT",
} as const;

export const auditRecords = [
  { auditId: "AUD-WH-0091", actor: "webhook-worker", organisationId: "org-fuelcap-global", action: "WEBHOOK_REJECTED", evidenceId: webhookReceipt.receiptId, beforeHash: null, afterHash: webhookReceipt.rawPayloadHash, sensitiveFieldsRedacted: true, immutable: true, occurredAt: webhookReceipt.recordedAt },
  { auditId: "AUD-CONFIG-0092", actor: "principal-data", organisationId: "org-fuelcap-global", action: "CONFIG_CHANGE_DRAFTED", evidenceId: configurationProposal.proposalId, beforeHash: configurationProposal.beforeConfigurationHash, afterHash: configurationProposal.afterConfigurationHash, sensitiveFieldsRedacted: true, immutable: true, occurredAt: "2026-08-25T16:33:00.000Z" },
] as const;

export function validateWebhook(receipt: typeof webhookReceipt) {
  if (!receipt.signatureValid || !receipt.authenticationValid) return { accepted: false, reasonCode: "DENY_INVALID_SIGNATURE" as const };
  if (!receipt.tenantValid) return { accepted: false, reasonCode: "DENY_TENANT_CONTEXT" as const };
  if (!receipt.schemaCompatible) return { accepted: false, reasonCode: "DENY_INCOMPATIBLE_SCHEMA" as const };
  return { accepted: true, reasonCode: "ACCEPT" as const };
}

export function replayEvent(eventId: string, inbox = new Set<string>(), postedJournals = new Set<string>()) {
  if (inbox.has(eventId)) return { status: "DUPLICATE_SUPPRESSED" as const, journalPosted: false, duplicateFinancialPosting: false };
  inbox.add(eventId);
  const journalId = "JRN-REPLAY-0091";
  if (postedJournals.has(journalId)) return { status: "JOURNAL_ALREADY_EXISTS" as const, journalPosted: false, duplicateFinancialPosting: false };
  postedJournals.add(journalId);
  return { status: "REPLAYED" as const, journalPosted: true, duplicateFinancialPosting: false };
}

export function approveIntegrationConfiguration(input: Readonly<{ initiatedBy: string; approvedBy: string; approverRole: "DI" | "PA" | "OP"; assurance: "standard" | "step-up"; compatibilityStatus: "PASS" | "FAIL"; rollbackReference: string; secretValueDisplayed: boolean }>) {
  if (input.initiatedBy === input.approvedBy) throw new Error("Self-approval is prohibited.");
  if (input.approverRole !== "DI" && input.approverRole !== "PA") throw new Error("Different DI or PA approval is required.");
  if (input.assurance !== "step-up") throw new Error("Step-up assurance is required.");
  if (input.compatibilityStatus !== "PASS" || !input.rollbackReference.trim()) throw new Error("Compatibility and rollback evidence are required.");
  if (input.secretValueDisplayed) throw new Error("Secret values must never be displayed.");
  return { requestId: configurationProposal.proposalId, status: "APPROVED" as const, executor: "DETERMINISTIC_DEPLOYMENT", postChangeHealthRequired: true };
}
