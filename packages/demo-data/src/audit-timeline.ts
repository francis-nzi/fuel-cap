export const AUDIT_SCHEMA_VERSION = "audit-event@1.0.0" as const;
export type AuditOutcome = "REQUESTED" | "ALLOWED" | "DENIED" | "APPROVED" | "EXECUTED" | "VERIFIED" | "REJECTED" | "EXPIRED" | "SUPERSEDED" | "CORRECTED";
export type AuditState = "NORMAL" | "WARNING" | "CRITICAL" | "REDACTED" | "STALE";

export type VersionedAuditEvent = Readonly<{
  eventId: string;
  schemaVersion: typeof AUDIT_SCHEMA_VERSION;
  eventType: string;
  organisationId: string;
  environment: "demo";
  scenarioId: string;
  scenarioVersion: "1.0.0";
  provenance: "synthetic-seeded";
  actorId: string;
  actorRole: string;
  assurance: "service" | "standard" | "step-up";
  workspace: string;
  resourceType: string;
  resourceId: string;
  outcome: AuditOutcome;
  reasonCode: string;
  occurredAt: string;
  recordedAt: string;
  correlationId: string;
  causationId: string | null;
  governedActionId: string;
  beforeHash: string | null;
  afterHash: string | null;
  evidenceIds: readonly string[];
  approverId: string | null;
  executorId: string | null;
  verificationState: "NOT_REQUIRED" | "PENDING" | "VERIFIED" | "FAILED";
  dataClassification: "INTERNAL" | "CONFIDENTIAL" | "RESTRICTED";
  sensitiveFieldsRedacted: boolean;
  retentionPolicy: string;
  state: AuditState;
  linkedEventId: string | null;
  immutable: true;
}>;

const base = {
  schemaVersion: AUDIT_SCHEMA_VERSION,
  organisationId: "org-fuelcap-global",
  environment: "demo",
  scenarioId: "platform-config-change",
  scenarioVersion: "1.0.0",
  provenance: "synthetic-seeded",
  workspace: "platform-integrations-audit",
  resourceType: "INTEGRATION_CONFIGURATION",
  resourceId: "adapter-stripe",
  correlationId: "CORR-CONFIG-0092",
  governedActionId: "INT-CONFIG-0092",
  dataClassification: "RESTRICTED",
  sensitiveFieldsRedacted: true,
  retentionPolicy: "admin-security-audit@1.0",
  immutable: true,
} as const;

export const governedActionAuditChain: readonly VersionedAuditEvent[] = [
  { ...base, eventId: "AUD-EVT-0092-01", eventType: "IntegrationConfigurationChangeRequested", actorId: "principal-data", actorRole: "DI", assurance: "step-up", outcome: "REQUESTED", reasonCode: "CONFIG_CHANGE_REQUESTED", occurredAt: "2026-08-25T16:33:00.000Z", recordedAt: "2026-08-25T16:33:00.125Z", causationId: null, beforeHash: "sha256:stripe-test-config-v4", afterHash: "sha256:stripe-test-config-v5", evidenceIds: ["INT-CONFIG-0092", "ROLLBACK-ADAPTER-STRIPE-TEST-0092"], approverId: null, executorId: null, verificationState: "PENDING", state: "NORMAL", linkedEventId: null },
  { ...base, eventId: "AUD-EVT-0092-02", eventType: "AuthorizationPolicyEvaluated", actorId: "authz-policy", actorRole: "SERVICE", assurance: "service", outcome: "ALLOWED", reasonCode: "ALLOW_DI_INITIATE", occurredAt: "2026-08-25T16:33:00.010Z", recordedAt: "2026-08-25T16:33:00.130Z", causationId: "AUD-EVT-0092-01", beforeHash: null, afterHash: null, evidenceIds: ["admin-authz-demo-1.0.0"], approverId: null, executorId: null, verificationState: "NOT_REQUIRED", state: "NORMAL", linkedEventId: null },
  { ...base, eventId: "AUD-EVT-0092-03", eventType: "IntegrationConfigurationChangeApproved", actorId: "principal-platform-checker", actorRole: "PA", assurance: "step-up", outcome: "APPROVED", reasonCode: "DIFFERENT_APPROVER_CONFIRMED", occurredAt: "2026-08-25T16:34:00.000Z", recordedAt: "2026-08-25T16:34:00.100Z", causationId: "AUD-EVT-0092-02", beforeHash: base.governedActionId, afterHash: "sha256:approval-0092", evidenceIds: ["STEP-UP-0092", "ROLLBACK-ADAPTER-STRIPE-TEST-0092"], approverId: "principal-platform-checker", executorId: null, verificationState: "PENDING", state: "NORMAL", linkedEventId: null },
  { ...base, eventId: "AUD-EVT-0092-04", eventType: "IntegrationConfigurationChangeExecuted", actorId: "configuration-deployer", actorRole: "SERVICE", assurance: "service", outcome: "EXECUTED", reasonCode: "CONFIG_HASH_APPLIED", occurredAt: "2026-08-26T09:02:00.000Z", recordedAt: "2026-08-26T09:02:00.080Z", causationId: "AUD-EVT-0092-03", beforeHash: "sha256:stripe-test-config-v4", afterHash: "sha256:stripe-test-config-v5", evidenceIds: ["DEPLOY-INT-CONFIG-0092"], approverId: "principal-platform-checker", executorId: "configuration-deployer", verificationState: "PENDING", state: "WARNING", linkedEventId: null },
  { ...base, eventId: "AUD-EVT-0092-05", eventType: "IntegrationConfigurationChangeVerified", actorId: "health-verifier", actorRole: "SERVICE", assurance: "service", outcome: "VERIFIED", reasonCode: "POST_CHANGE_HEALTH_GREEN", occurredAt: "2026-08-26T09:03:00.000Z", recordedAt: "2026-08-26T09:03:00.060Z", causationId: "AUD-EVT-0092-04", beforeHash: null, afterHash: "sha256:health-green-0092", evidenceIds: ["HEALTH-CHECK-0092"], approverId: "principal-platform-checker", executorId: "configuration-deployer", verificationState: "VERIFIED", state: "NORMAL", linkedEventId: null },
] as const;

export const exceptionalAuditEvents: readonly VersionedAuditEvent[] = [
  { ...base, eventId: "AUD-EVT-DENIED-01", eventType: "SelfApprovalDenied", actorId: "principal-data", actorRole: "DI", assurance: "step-up", outcome: "DENIED", reasonCode: "DENY_SELF_APPROVAL", occurredAt: "2026-08-25T16:33:30.000Z", recordedAt: "2026-08-25T16:33:30.030Z", causationId: "AUD-EVT-0092-01", beforeHash: null, afterHash: null, evidenceIds: ["admin-authz-demo-1.0.0"], approverId: "principal-data", executorId: null, verificationState: "FAILED", state: "CRITICAL", linkedEventId: null },
  { ...base, eventId: "AUD-EVT-EXPIRED-01", eventType: "ApprovalRequestExpired", actorId: "approval-scheduler", actorRole: "SERVICE", assurance: "service", outcome: "EXPIRED", reasonCode: "APPROVAL_WINDOW_EXPIRED", occurredAt: "2026-08-26T16:33:00.000Z", recordedAt: "2026-08-26T16:33:00.050Z", causationId: "AUD-EVT-0092-01", beforeHash: null, afterHash: null, evidenceIds: ["APPROVAL-POLICY@1.0"], approverId: null, executorId: null, verificationState: "FAILED", state: "WARNING", linkedEventId: null },
  { ...base, eventId: "AUD-EVT-SUPERSEDED-01", eventType: "ConfigurationProposalSuperseded", actorId: "principal-data", actorRole: "DI", assurance: "standard", outcome: "SUPERSEDED", reasonCode: "NEWER_PROPOSAL_CREATED", occurredAt: "2026-08-26T17:00:00.000Z", recordedAt: "2026-08-26T17:00:00.040Z", causationId: "AUD-EVT-0092-01", beforeHash: "sha256:stripe-test-config-v5", afterHash: "sha256:stripe-test-config-v6", evidenceIds: ["INT-CONFIG-0093"], approverId: null, executorId: null, verificationState: "NOT_REQUIRED", state: "NORMAL", linkedEventId: "AUD-EVT-0092-01" },
  { ...base, eventId: "AUD-EVT-CORRECTED-01", eventType: "AuditMetadataCorrected", actorId: "audit-projection", actorRole: "SERVICE", assurance: "service", outcome: "CORRECTED", reasonCode: "DISPLAY_METADATA_CORRECTED", occurredAt: "2026-08-26T17:01:00.000Z", recordedAt: "2026-08-26T17:01:00.020Z", causationId: "AUD-EVT-SUPERSEDED-01", beforeHash: "sha256:metadata-v1", afterHash: "sha256:metadata-v2", evidenceIds: ["CORRECTION-0093"], approverId: null, executorId: null, verificationState: "VERIFIED", state: "REDACTED", linkedEventId: "AUD-EVT-SUPERSEDED-01" },
  { ...base, eventId: "AUD-EVT-STALE-01", eventType: "AuditProjectionDelayed", actorId: "audit-projection", actorRole: "SERVICE", assurance: "service", outcome: "REJECTED", reasonCode: "RECORDING_LAG_EXCEEDED", occurredAt: "2026-08-26T17:02:00.000Z", recordedAt: "2026-08-26T17:12:00.000Z", causationId: "AUD-EVT-CORRECTED-01", beforeHash: null, afterHash: null, evidenceIds: ["SLI-AUDIT-LAG@1.0"], approverId: null, executorId: null, verificationState: "FAILED", state: "STALE", linkedEventId: null },
] as const;

export const auditTimeline = [...governedActionAuditChain, ...exceptionalAuditEvents] as const;

export function validateAuditTimeline(events: readonly VersionedAuditEvent[]) {
  const ids = new Set<string>();
  for (const event of events) {
    if (event.schemaVersion !== AUDIT_SCHEMA_VERSION) throw new Error("Incompatible audit schema version.");
    if (ids.has(event.eventId)) throw new Error("Duplicate audit event ID.");
    if (event.organisationId !== events[0]?.organisationId) throw new Error("Cross-tenant audit reference.");
    if (event.causationId && !events.some(({ eventId }) => eventId === event.causationId)) throw new Error("Broken audit causation.");
    if (!event.sensitiveFieldsRedacted || !event.immutable) throw new Error("Audit integrity metadata is required.");
    ids.add(event.eventId);
  }
  return { valid: true as const, eventCount: events.length };
}

export function eventsForOrganisation(events: readonly VersionedAuditEvent[], organisationId: string) { return events.filter((event) => event.organisationId === organisationId); }

export function createSimulatedAuditExport(events: readonly VersionedAuditEvent[], organisationId: string, requestedBy: string) {
  const scoped = eventsForOrganisation(events, organisationId);
  return { exportId: "AUD-EXPORT-0092", requestedBy, organisationId, eventCount: scoped.length, watermark: "FUELCAP DEMONSTRATOR — SYNTHETIC DATA", expiresAt: "2026-08-25T18:00:00.000Z", simulated: true, sensitiveValuesIncluded: false } as const;
}

export function summariseAuditChain(events: readonly VersionedAuditEvent[]) {
  if (!events.some(({ outcome }) => outcome === "VERIFIED")) return { status: "ABSTAIN" as const, confidenceBps: 0, citations: events.map(({ eventId }) => eventId), summary: "Verification evidence is incomplete." };
  return { status: "SUPPORTED" as const, confidenceBps: 9800, citations: events.map(({ eventId }) => eventId), summary: "A different PA approved the DI request after step-up; deterministic execution and post-change health verification completed." };
}
