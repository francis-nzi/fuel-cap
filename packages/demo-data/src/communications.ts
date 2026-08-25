export type CommunicationClass = "REQUIRED" | "TRANSACTIONAL" | "SECURITY_FRAUD" | "SERVICE_ADVISORY" | "MARKETING";
export type Channel = "EMAIL" | "SMS" | "PUSH" | "IN_APP";
export type DeliveryState = "QUEUED" | "SENT" | "DELIVERED" | "BOUNCED" | "FAILED" | "ACKNOWLEDGED";

export type CommunicationTemplate = Readonly<{
  templateId: string;
  version: string;
  purpose: "AUTO_ROLLOVER_PRE_NOTICE" | "AUTO_ROLLOVER_AFTER_NOTICE";
  communicationClass: CommunicationClass;
  market: "US";
  language: "en-US";
  channel: Channel;
  lifecycle: "PUBLISHED" | "DRAFT";
  subject: string;
  sensitiveContentCheck: "PASS";
  provenance: "synthetic-seeded";
}>;

export const rolloverTemplates: readonly CommunicationTemplate[] = [
  { templateId: "TPL-ROLLOVER-PRE-US", version: "rollover-pre@1.2.0", purpose: "AUTO_ROLLOVER_PRE_NOTICE", communicationClass: "REQUIRED", market: "US", language: "en-US", channel: "EMAIL", lifecycle: "PUBLISHED", subject: "Your FuelCap protection is approaching renewal", sensitiveContentCheck: "PASS", provenance: "synthetic-seeded" },
  { templateId: "TPL-ROLLOVER-AFTER-US", version: "rollover-after@1.1.0", purpose: "AUTO_ROLLOVER_AFTER_NOTICE", communicationClass: "REQUIRED", market: "US", language: "en-US", channel: "IN_APP", lifecycle: "PUBLISHED", subject: "Your FuelCap protection has been updated", sensitiveContentCheck: "PASS", provenance: "synthetic-seeded" },
] as const;

export const draftRequiredTemplate: CommunicationTemplate = { ...rolloverTemplates[0], version: "rollover-pre@1.3.0-draft.1", lifecycle: "DRAFT", subject: "Review your upcoming FuelCap protection renewal" };

export const communicationPreference = {
  preferenceId: "PREF-ALEX-0042",
  version: "preferences@2.1.0",
  effectiveFrom: "2026-08-01T00:00:00.000Z",
  marketingEmail: false,
  requiredEmailAvailable: true,
  requiredInAppAvailable: true,
  requiredSmsAvailable: false,
  fleetAdminCanSuppressRequiredNotice: false,
} as const;

export const preNotice = {
  communicationId: "COMM-ROLLOVER-PRE-0042",
  organisationId: "org-fuelcap-global",
  scenarioId: "rollover-rise-fall-us",
  recipientId: "CUS-ALEX-0042",
  governingEventId: "ROLLOVER-SCHEDULED-0042",
  templateId: rolloverTemplates[0].templateId,
  templateVersion: rolloverTemplates[0].version,
  renderedContentHash: "sha256:rollover-pre-alex-0042-v12",
  inputReferences: ["PRT-ALEX-0020", "RULE-ROLLOVER@1.2", "PREF-ALEX-0042"],
  idempotencyKey: "rollover-pre:PRT-ALEX-0020:2026-08-27",
  noticeAt: "2026-08-25T10:00:00.000Z",
  actionAt: "2026-08-27T10:00:00.000Z",
  channel: "EMAIL" as Channel,
  state: "DELIVERED" as DeliveryState,
  requiredDespiteMarketingOptOut: true,
  quietHoursException: "IMMINENT_EXPIRY",
  simulated: true,
} as const;

export const afterNotice = {
  communicationId: "COMM-ROLLOVER-AFTER-0042",
  governingEventId: "ROLLOVER-COMPLETED-0042",
  linkedPreNoticeId: preNotice.communicationId,
  templateId: rolloverTemplates[1].templateId,
  templateVersion: rolloverTemplates[1].version,
  renderedContentHash: "sha256:rollover-after-alex-0042-v11",
  idempotencyKey: "rollover-after:PRT-ALEX-0020:2026-08-27",
  sentAt: "2026-08-27T10:00:05.000Z",
  channel: "IN_APP" as Channel,
  state: "ACKNOWLEDGED" as DeliveryState,
  acknowledgedAt: "2026-08-27T10:04:18.000Z",
  simulated: true,
} as const;

export const outboxEvidence = {
  outboxId: "OUTBOX-ROLLOVER-0042",
  governingTransactionId: "TX-ROLLOVER-0042",
  communicationId: preNotice.communicationId,
  idempotencyKey: preNotice.idempotencyKey,
  intentCommittedAtomically: true,
  duplicateSuppressed: true,
  state: "DISPATCHED",
} as const;

export const criticalDelivery = {
  communicationId: "COMM-SECURITY-0091",
  communicationClass: "SECURITY_FRAUD" as CommunicationClass,
  subjectContainsSensitiveDetail: false,
  attempts: [
    { attempt: 1, channel: "EMAIL" as Channel, state: "FAILED" as DeliveryState, reason: "PROVIDER_TIMEOUT", backoffSeconds: 30 },
    { attempt: 2, channel: "EMAIL" as Channel, state: "FAILED" as DeliveryState, reason: "PROVIDER_TIMEOUT", backoffSeconds: 120 },
    { attempt: 3, channel: "IN_APP" as Channel, state: "DELIVERED" as DeliveryState, reason: "APPROVED_FALLBACK", backoffSeconds: 0 },
  ],
  maxPrimaryAttempts: 2,
  exhaustedPrimaryQueue: true,
  fallbackApproved: true,
  fallbackRespectsPreference: true,
  simulated: true,
} as const;

export function noticeHoursBeforeAction(noticeAt: string, actionAt: string) { return (Date.parse(actionAt) - Date.parse(noticeAt)) / 3_600_000; }

export function enqueueCommunication(idempotencyKey: string, processedKeys = new Set<string>()) {
  if (processedKeys.has(idempotencyKey)) return { status: "DUPLICATE_SUPPRESSED" as const, enqueued: false };
  processedKeys.add(idempotencyKey);
  return { status: "QUEUED" as const, enqueued: true };
}

export function approveRequiredTemplate(input: Readonly<{ initiatedBy: string; approvedBy: string; approverRole: string; assurance: "standard" | "step-up"; evidenceIds: readonly string[]; sensitiveContentCheck: "PASS" | "FAIL" }>) {
  if (input.initiatedBy === input.approvedBy) throw new Error("Self-approval is prohibited.");
  if (input.approverRole !== "CF") throw new Error("Compliance approval is required.");
  if (input.assurance !== "step-up") throw new Error("Step-up assurance is required.");
  if (!input.evidenceIds.length || input.sensitiveContentCheck !== "PASS") throw new Error("Complete safe-content evidence is required.");
  return { requestId: "COMM-TPL-PUB-013", status: "APPROVED" as const, executor: "TEMPLATE_REGISTRY", liveDelivery: false };
}
