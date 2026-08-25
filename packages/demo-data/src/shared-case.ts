export const CASE_SCHEMA_VERSION = "shared-case@1.0.0" as const;
export const CASE_ENTRY_SCHEMA_VERSION = "case-entry@1.0.0" as const;
export type SharedCaseState = "OPEN" | "TRIAGED" | "INVESTIGATING" | "PENDING_ACTION" | "RESOLVED" | "CLOSED";
export type SharedCaseDomain = "OPERATIONS" | "FRAUD" | "DATA" | "COMPLIANCE" | "PLATFORM_INTEGRATIONS";
export type SharedCaseSeverity = "NONE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type CaseEntryType = "CASE_OPENED" | "TRIAGED" | "ASSIGNED" | "INVESTIGATION_STARTED" | "EVIDENCE_LINKED" | "NOTE_ADDED" | "RECOMMENDATION_RECORDED" | "ACTION_REQUEST_LINKED" | "DECISION_RECORDED" | "CUSTOMER_NOTICE_LINKED" | "RECOVERY_VERIFIED" | "RESOLVED" | "CLOSED" | "REOPENED" | "CORRECTION_LINKED";

export type SharedCase = Readonly<{
  caseId: string; caseVersion: number; schemaVersion: typeof CASE_SCHEMA_VERSION; caseType: string; domain: SharedCaseDomain; state: SharedCaseState;
  organisationId: string; environment: "demo"; market: "GLOBAL" | "US" | "UK" | "CA"; scenarioId: string; scenarioVersion: string; provenance: "synthetic-seeded";
  severity: Readonly<{ customerMoney: SharedCaseSeverity; integrity: SharedCaseSeverity; privacySecurity: SharedCaseSeverity; operational: SharedCaseSeverity; regulatory: SharedCaseSeverity }>;
  title: string; reasonCodes: readonly string[]; summary: string; ownerId: string | null; ownerTeam: "OPERATIONS" | "FINANCE_OPERATIONS" | "COMPLIANCE_FRAUD" | "DATA_INTEGRATIONS"; assignmentVersion: number;
  openedAt: string; updatedAt: string; dueAt: string; slaState: "ON_TRACK" | "AT_RISK" | "BREACHED";
  linkedEntities: Readonly<{ customerId: string | null; fleetId: string | null; vehicleId: string | null; transactionId: string | null; quoteId: string | null; protectionId: string | null; journalId: string | null; providerReceiptId: string | null; incidentId: string | null; alertId: string | null; governedActionId: string | null; auditCorrelationId: string }>;
  impact: Readonly<{ customerValueMinor: number; capability: string; holdId: string | null; restrictionId: string | null }>;
  evidenceIds: readonly string[]; dataClassification: "CONFIDENTIAL"; sensitiveFieldsRedacted: true; retentionPolicy: string;
  correlationId: string; causationId: string; auditEventIds: readonly string[]; recoveryRoute: string; resolutionReason: string | null; recoveryVerified: boolean; closedAt: string | null; linkedPriorCaseVersion: number | null;
}>;

export type CaseTimelineEntry = Readonly<{
  entryId: string; entryVersion: 1; schemaVersion: typeof CASE_ENTRY_SCHEMA_VERSION; caseId: string; caseVersion: number; organisationId: string; occurredAt: string;
  actorId: string; actorRole: string; entryType: CaseEntryType; outcome: string; reasonCode: string; correlationId: string; causationId: string | null;
  evidenceIds: readonly string[]; visibility: "INTERNAL" | "AUDITOR"; dataClassification: "CONFIDENTIAL"; sensitiveFieldsRedacted: true; contentHash: string; immutable: true;
  untrustedInput: boolean; toolExecutionAllowed: false; linkedEntryId: string | null;
}>;

export const representativeSharedCase: SharedCase = {
  caseId: "CASE-PLATFORM-0092", caseVersion: 1, schemaVersion: CASE_SCHEMA_VERSION, caseType: "INTEGRATION_CONTRACT_VALIDATION", domain: "PLATFORM_INTEGRATIONS", state: "OPEN",
  organisationId: "org-fuelcap-global", environment: "demo", market: "GLOBAL", scenarioId: "platform-config-change", scenarioVersion: "1.0.0", provenance: "synthetic-seeded",
  severity: { customerMoney: "NONE", integrity: "MEDIUM", privacySecurity: "LOW", operational: "MEDIUM", regulatory: "NONE" },
  title: "Validate blocked test-provider receipt and configuration recovery", reasonCodes: ["INVALID_SIGNATURE", "CONTRACT_VALIDATION_REQUIRED"], summary: "A simulated invalid signature was blocked before domain processing; review configuration evidence and recovery health.",
  ownerId: null, ownerTeam: "DATA_INTEGRATIONS", assignmentVersion: 0, openedAt: "2026-08-25T16:30:01.125Z", updatedAt: "2026-08-25T16:30:01.125Z", dueAt: "2026-08-26T16:30:01.125Z", slaState: "ON_TRACK",
  linkedEntities: { customerId: null, fleetId: null, vehicleId: null, transactionId: null, quoteId: null, protectionId: null, journalId: null, providerReceiptId: "WH-RCPT-0091", incidentId: "INC-WEBHOOK-0091", alertId: null, governedActionId: "GA-INT-CONFIG-0092", auditCorrelationId: "CORR-CONFIG-0092" },
  impact: { customerValueMinor: 0, capability: "TEST_PAYMENT_OBSERVATION_INGEST", holdId: null, restrictionId: null }, evidenceIds: ["WH-RCPT-0091", "sha256:webhook-receipt-0091"],
  dataClassification: "CONFIDENTIAL", sensitiveFieldsRedacted: true, retentionPolicy: "platform-case@1.0", correlationId: "CORR-CASE-PLATFORM-0092", causationId: "INC-WEBHOOK-0091", auditEventIds: ["AUD-WH-0091"],
  recoveryRoute: "Validate signed test receipt, verify adapter health and retain immutable audit evidence.", resolutionReason: null, recoveryVerified: false, closedAt: null, linkedPriorCaseVersion: null,
};

const entry = (caseRecord: SharedCase, input: Pick<CaseTimelineEntry, "entryId" | "actorId" | "actorRole" | "entryType" | "outcome" | "reasonCode" | "occurredAt" | "evidenceIds" | "untrustedInput" | "linkedEntryId">): CaseTimelineEntry => ({
  ...input, entryVersion: 1, schemaVersion: CASE_ENTRY_SCHEMA_VERSION, caseId: caseRecord.caseId, caseVersion: caseRecord.caseVersion, organisationId: caseRecord.organisationId,
  correlationId: caseRecord.correlationId, causationId: caseRecord.causationId, visibility: "AUDITOR", dataClassification: "CONFIDENTIAL", sensitiveFieldsRedacted: true,
  contentHash: `sha256:${input.entryId.toLowerCase()}`, immutable: true, toolExecutionAllowed: false,
});

export function openCaseTimeline(caseRecord: SharedCase): readonly CaseTimelineEntry[] { return [entry(caseRecord, { entryId: `${caseRecord.caseId}-EVT-01`, actorId: "case-orchestrator", actorRole: "SERVICE", entryType: "CASE_OPENED", outcome: "OPEN", reasonCode: caseRecord.reasonCodes[0] ?? "CASE_OPENED", occurredAt: caseRecord.openedAt, evidenceIds: caseRecord.evidenceIds, untrustedInput: false, linkedEntryId: null })]; }
export const initialCaseTimeline: readonly CaseTimelineEntry[] = openCaseTimeline(representativeSharedCase);

const allowedTransitions: Readonly<Record<SharedCaseState, readonly SharedCaseState[]>> = { OPEN: ["TRIAGED"], TRIAGED: ["INVESTIGATING"], INVESTIGATING: ["PENDING_ACTION", "RESOLVED"], PENDING_ACTION: ["RESOLVED"], RESOLVED: ["CLOSED", "INVESTIGATING"], CLOSED: ["INVESTIGATING"] };

export function validateSharedCase(caseRecord: SharedCase, timeline: readonly CaseTimelineEntry[]) {
  if (caseRecord.schemaVersion !== CASE_SCHEMA_VERSION || timeline.some(({ schemaVersion }) => schemaVersion !== CASE_ENTRY_SCHEMA_VERSION)) throw new Error("Incompatible case schema version.");
  if (new Set(timeline.map(({ entryId }) => entryId)).size !== timeline.length) throw new Error("Duplicate case timeline entry ID.");
  if (timeline.some((item) => item.caseId !== caseRecord.caseId || item.organisationId !== caseRecord.organisationId)) throw new Error("Cross-tenant or cross-case timeline reference.");
  if (timeline.some((item) => item.causationId && item.causationId !== caseRecord.causationId && !timeline.some(({ entryId }) => entryId === item.causationId))) throw new Error("Broken case timeline causation.");
  if (!caseRecord.sensitiveFieldsRedacted || timeline.some((item) => !item.immutable || !item.sensitiveFieldsRedacted || item.toolExecutionAllowed)) throw new Error("Case integrity metadata is required.");
  return { valid: true as const, entryCount: timeline.length };
}

export function transitionCase(caseRecord: SharedCase, timeline: readonly CaseTimelineEntry[], target: SharedCaseState, actorId: string, reasonCode: string) {
  if (!allowedTransitions[caseRecord.state].includes(target)) throw new Error(`Invalid case transition from ${caseRecord.state} to ${target}.`);
  if (target === "RESOLVED" && (!caseRecord.evidenceIds.length || !caseRecord.resolutionReason)) throw new Error("Resolution evidence and reason are required.");
  if (target === "CLOSED" && (!caseRecord.recoveryVerified || caseRecord.state !== "RESOLVED")) throw new Error("Recovery verification is required before closure.");
  const nextCase: SharedCase = { ...caseRecord, caseVersion: caseRecord.caseVersion + 1, state: target, updatedAt: "2026-08-25T16:40:00.000Z", closedAt: target === "CLOSED" ? "2026-08-25T16:40:00.000Z" : caseRecord.closedAt, linkedPriorCaseVersion: caseRecord.caseVersion };
  const entryType: CaseEntryType = target === "CLOSED" ? "CLOSED" : target === "RESOLVED" ? "RESOLVED" : target === "INVESTIGATING" && caseRecord.state === "CLOSED" ? "REOPENED" : target === "INVESTIGATING" ? "INVESTIGATION_STARTED" : target === "PENDING_ACTION" ? "ACTION_REQUEST_LINKED" : "TRIAGED";
  const newEntry = entry(nextCase, { entryId: `CASE-EVT-0092-${String(timeline.length + 1).padStart(2,"0")}`, actorId, actorRole: "OP", entryType, outcome: target, reasonCode, occurredAt: nextCase.updatedAt, evidenceIds: nextCase.evidenceIds, untrustedInput: false, linkedEntryId: timeline.at(-1)?.entryId ?? null });
  return { caseRecord: nextCase, timeline: [...timeline, newEntry] as readonly CaseTimelineEntry[] };
}

export function assignCase(caseRecord: SharedCase, timeline: readonly CaseTimelineEntry[], input: Readonly<{ actorId: string; actorRole: "OP" | "DI" | "CF" | "DP"; ownerId: string }>) {
  if (input.actorRole === "DP" || !["OP", "DI", "CF"].includes(input.actorRole)) throw new Error("Case assignment is not authorised.");
  const nextCase: SharedCase = { ...caseRecord, ownerId: input.ownerId, assignmentVersion: caseRecord.assignmentVersion + 1, updatedAt: "2026-08-25T16:32:00.000Z" };
  return { caseRecord: nextCase, timeline: [...timeline, entry(nextCase, { entryId: `CASE-EVT-0092-${String(timeline.length + 1).padStart(2,"0")}`, actorId: input.actorId, actorRole: input.actorRole, entryType: "ASSIGNED", outcome: input.ownerId, reasonCode: "OWNER_ASSIGNED", occurredAt: nextCase.updatedAt, evidenceIds: [], untrustedInput: false, linkedEntryId: timeline.at(-1)?.entryId ?? null })] as readonly CaseTimelineEntry[] };
}

export function addInvestigatorNote(caseRecord: SharedCase, timeline: readonly CaseTimelineEntry[], actorId: string, noteHash: string) {
  if (!noteHash.startsWith("sha256:")) throw new Error("Immutable note hash is required.");
  return [...timeline, entry(caseRecord, { entryId: `CASE-EVT-0092-${String(timeline.length + 1).padStart(2,"0")}`, actorId, actorRole: "DI", entryType: "NOTE_ADDED", outcome: "UNTRUSTED_NOTE_RECORDED", reasonCode: "INVESTIGATOR_NOTE", occurredAt: "2026-08-25T16:34:00.000Z", evidenceIds: [noteHash], untrustedInput: true, linkedEntryId: timeline.at(-1)?.entryId ?? null })] as readonly CaseTimelineEntry[];
}

export function prepareResolution(caseRecord: SharedCase, reason: string, recoveryVerified: boolean): SharedCase { if (!reason.trim()) throw new Error("Resolution reason is required."); return { ...caseRecord, resolutionReason: reason, recoveryVerified, auditEventIds: [...caseRecord.auditEventIds, "AUD-EVT-0092-05"] }; }
export function casesForOrganisation(cases: readonly SharedCase[], organisationId: string) { return cases.filter((caseRecord) => caseRecord.organisationId === organisationId); }

export function summariseCase(caseRecord: SharedCase, timeline: readonly CaseTimelineEntry[]) {
  if (!caseRecord.evidenceIds.length || !timeline.some(({ entryType }) => entryType === "EVIDENCE_LINKED" || entryType === "CASE_OPENED")) return { status: "ABSTAIN" as const, citations: timeline.map(({ entryId }) => entryId), summary: "Case evidence is incomplete." };
  return { status: "SUPPORTED" as const, confidenceBps: 9700, citations: [...caseRecord.evidenceIds, ...timeline.map(({ entryId }) => entryId)], summary: `${caseRecord.summary} Customer money impact is ${caseRecord.severity.customerMoney.toLowerCase()}; recovery requires human verification.` };
}
