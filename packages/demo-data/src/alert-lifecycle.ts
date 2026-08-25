import { seededDomainCases } from "./seeded-domain-cases";
import type { SharedCaseDomain, SharedCaseSeverity } from "./shared-case";

export const ALERT_SCHEMA_VERSION = "governed-alert@1.0.0" as const;
export const ALERT_EVENT_SCHEMA_VERSION = "alert-event@1.0.0" as const;
export type AlertState = "OPEN" | "ACKNOWLEDGED" | "ASSIGNED" | "RESOLVED";
export type AlertEventType = "ALERT_OPENED" | "ACKNOWLEDGED" | "ASSIGNED" | "RESOLVED";

export type GovernedAlert = Readonly<{
  alertId: string; alertVersion: number; schemaVersion: typeof ALERT_SCHEMA_VERSION; organisationId: string; environment: "demo"; domain: Exclude<SharedCaseDomain, "PLATFORM_INTEGRATIONS">; provenance: "synthetic-seeded";
  state: AlertState; title: string; reasonCodes: readonly string[]; severity: SharedCaseSeverity; openedAt: string; acknowledgedAt: string | null; assignedAt: string | null; resolvedAt: string | null;
  ownerId: string | null; ownerTeam: "FINANCE_OPERATIONS" | "COMPLIANCE_FRAUD" | "DATA_INTEGRATIONS"; assignmentVersion: number; dueAt: string; slaState: "ON_TRACK" | "AT_RISK" | "BREACHED";
  linkedCaseId: string; evidenceIds: readonly string[]; correlationId: string; causationId: string; resolutionRequirement: string; resolutionReason: string | null; resolutionEvidenceIds: readonly string[];
  dataClassification: "CONFIDENTIAL"; sensitiveFieldsRedacted: true; retentionPolicy: string;
}>;

export type AlertEvent = Readonly<{
  eventId: string; eventVersion: 1; schemaVersion: typeof ALERT_EVENT_SCHEMA_VERSION; alertId: string; alertVersion: number; organisationId: string; occurredAt: string; actorId: string; actorRole: string;
  eventType: AlertEventType; outcome: AlertState; reasonCode: string; ownerId: string | null; evidenceIds: readonly string[]; correlationId: string; causationId: string | null; immutable: true; sensitiveFieldsRedacted: true;
}>;

const domainMeta = {
  OPERATIONS: { alertId: "ALERT-OPS-0201", ownerTeam: "FINANCE_OPERATIONS", severity: "HIGH", title: "Settlement reconciliation break", requirement: "Verify balanced journal and posting recovery evidence." },
  FRAUD: { alertId: "ALERT-FRAUD-0202", ownerTeam: "COMPLIANCE_FRAUD", severity: "HIGH", title: "Suspicious transaction hold review", requirement: "Complete human fairness-aware review before changing the hold." },
  DATA: { alertId: "ALERT-DATA-0203", ownerTeam: "DATA_INTEGRATIONS", severity: "MEDIUM", title: "Pricing source conflict", requirement: "Verify source eligibility and governed pricing evidence." },
  COMPLIANCE: { alertId: "ALERT-COMP-0204", ownerTeam: "COMPLIANCE_FRAUD", severity: "HIGH", title: "Consent and retention control review", requirement: "Confirm consent, jurisdiction and retention decision evidence." },
} as const;

export const seededAlerts: readonly GovernedAlert[] = seededDomainCases.map((caseRecord, index) => {
  const domain = caseRecord.domain as GovernedAlert["domain"];
  const meta = domainMeta[domain];
  return { alertId: meta.alertId, alertVersion: 1, schemaVersion: ALERT_SCHEMA_VERSION, organisationId: caseRecord.organisationId, environment: "demo", domain, provenance: "synthetic-seeded", state: "OPEN", title: meta.title, reasonCodes: caseRecord.reasonCodes, severity: meta.severity, openedAt: `2026-08-25T17:${String(30 + index * 5).padStart(2, "0")}:00.000Z`, acknowledgedAt: null, assignedAt: null, resolvedAt: null, ownerId: null, ownerTeam: meta.ownerTeam, assignmentVersion: 0, dueAt: caseRecord.dueAt, slaState: caseRecord.slaState, linkedCaseId: caseRecord.caseId, evidenceIds: caseRecord.evidenceIds, correlationId: `CORR-${meta.alertId}`, causationId: caseRecord.correlationId, resolutionRequirement: meta.requirement, resolutionReason: null, resolutionEvidenceIds: [], dataClassification: "CONFIDENTIAL", sensitiveFieldsRedacted: true, retentionPolicy: caseRecord.retentionPolicy };
});

const event = (alert: GovernedAlert, eventType: AlertEventType, actorId: string, actorRole: string, reasonCode: string, occurredAt: string, evidenceIds: readonly string[]): AlertEvent => ({ eventId: `${alert.alertId}-EVT-${String(alert.alertVersion).padStart(2, "0")}`, eventVersion: 1, schemaVersion: ALERT_EVENT_SCHEMA_VERSION, alertId: alert.alertId, alertVersion: alert.alertVersion, organisationId: alert.organisationId, occurredAt, actorId, actorRole, eventType, outcome: alert.state, reasonCode, ownerId: alert.ownerId, evidenceIds, correlationId: alert.correlationId, causationId: alert.alertVersion === 1 ? alert.causationId : `${alert.alertId}-EVT-${String(alert.alertVersion - 1).padStart(2, "0")}`, immutable: true, sensitiveFieldsRedacted: true });

export const initialAlertEvents: Readonly<Record<string, readonly AlertEvent[]>> = Object.fromEntries(seededAlerts.map((alert) => [alert.alertId, [event(alert, "ALERT_OPENED", "alert-orchestrator", "SERVICE", alert.reasonCodes[0], alert.openedAt, alert.evidenceIds)]]));

export function acknowledgeAlert(alert: GovernedAlert, events: readonly AlertEvent[], actorId: string, actorRole: "OP" | "CF" | "DI" | "DP") {
  if (actorRole === "DP") throw new Error("Alert acknowledgement is not authorised.");
  if (alert.state !== "OPEN") throw new Error("Only open alerts can be acknowledged.");
  const next: GovernedAlert = { ...alert, alertVersion: alert.alertVersion + 1, state: "ACKNOWLEDGED", acknowledgedAt: "2026-08-25T18:00:00.000Z" };
  return { alert: next, events: [...events, event(next, "ACKNOWLEDGED", actorId, actorRole, "HUMAN_ACKNOWLEDGED", next.acknowledgedAt!, [])] as readonly AlertEvent[] };
}

export function assignAlert(alert: GovernedAlert, events: readonly AlertEvent[], actorId: string, actorRole: "OP" | "CF" | "DI" | "DP", ownerId: string) {
  if (actorRole === "DP") throw new Error("Alert assignment is not authorised.");
  if (alert.state !== "ACKNOWLEDGED") throw new Error("Only acknowledged alerts can be assigned.");
  const next: GovernedAlert = { ...alert, alertVersion: alert.alertVersion + 1, state: "ASSIGNED", assignedAt: "2026-08-25T18:02:00.000Z", ownerId, assignmentVersion: alert.assignmentVersion + 1 };
  return { alert: next, events: [...events, event(next, "ASSIGNED", actorId, actorRole, "OWNER_ASSIGNED", next.assignedAt!, [])] as readonly AlertEvent[] };
}

export function resolveAlert(alert: GovernedAlert, events: readonly AlertEvent[], actorId: string, actorRole: "OP" | "CF" | "DI" | "DP", reason: string, evidenceIds: readonly string[]) {
  if (actorRole === "DP") throw new Error("Alert resolution is not authorised.");
  if (alert.state !== "ASSIGNED" || !alert.ownerId) throw new Error("Only assigned alerts with an owner can be resolved.");
  if (!reason.trim() || !evidenceIds.length) throw new Error("Resolution reason and verification evidence are required.");
  const next: GovernedAlert = { ...alert, alertVersion: alert.alertVersion + 1, state: "RESOLVED", resolvedAt: "2026-08-25T18:10:00.000Z", resolutionReason: reason, resolutionEvidenceIds: evidenceIds };
  return { alert: next, events: [...events, event(next, "RESOLVED", actorId, actorRole, "RECOVERY_VERIFIED", next.resolvedAt!, evidenceIds)] as readonly AlertEvent[] };
}

export function validateAlert(alert: GovernedAlert, events: readonly AlertEvent[], caseIds = seededDomainCases.map(({ caseId }) => caseId)) {
  if (alert.schemaVersion !== ALERT_SCHEMA_VERSION || events.some(({ schemaVersion }) => schemaVersion !== ALERT_EVENT_SCHEMA_VERSION)) throw new Error("Incompatible alert schema version.");
  if (!caseIds.includes(alert.linkedCaseId) || !alert.evidenceIds.length || !alert.correlationId || !alert.causationId) throw new Error("Broken alert case, evidence or correlation link.");
  if (new Set(events.map(({ eventId }) => eventId)).size !== events.length) throw new Error("Duplicate alert event ID.");
  if (events.some((item) => item.alertId !== alert.alertId || item.organisationId !== alert.organisationId)) throw new Error("Cross-tenant or cross-alert event.");
  if (!alert.sensitiveFieldsRedacted || events.some((item) => !item.immutable || !item.sensitiveFieldsRedacted)) throw new Error("Alert integrity metadata is required.");
  return { valid: true as const, eventCount: events.length };
}

export const alertsForOrganisation = (alerts: readonly GovernedAlert[], organisationId: string) => alerts.filter((alert) => alert.organisationId === organisationId);
export const filterAlerts = (alerts: readonly GovernedAlert[], input: Readonly<{ domain?: GovernedAlert["domain"]; state?: AlertState }>) => alerts.filter((alert) => (!input.domain || alert.domain === input.domain) && (!input.state || alert.state === input.state));
export function summariseAlert(alert: GovernedAlert, events: readonly AlertEvent[]) { if (!alert.evidenceIds.length || !events.length) return { status: "ABSTAIN" as const, summary: "Alert evidence is incomplete.", citations: events.map(({ eventId }) => eventId) }; return { status: "SUPPORTED" as const, confidenceBps: 9700, summary: `${alert.title} is ${alert.state.toLowerCase()} and requires human-controlled recovery.`, citations: [...alert.evidenceIds, ...events.map(({ eventId }) => eventId)] }; }
