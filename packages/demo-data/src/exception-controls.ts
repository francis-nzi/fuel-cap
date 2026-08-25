import { ALERT_EVENT_SCHEMA_VERSION, type AlertEvent, type GovernedAlert } from "./alert-lifecycle";
import type { GovernedActionRequest } from "./maker-checker";

export function rejectGovernedAction(request: GovernedActionRequest, input: Readonly<{ checkerId: string; checkerRole: "DI" | "PA" | "OP"; requestVersion: number; evidenceDigest: string; reasonCode: string; rationaleReference: string }>) {
  if (request.state !== "PENDING_APPROVAL") throw new Error("Only pending requests can be rejected.");
  if (input.checkerId === request.makerId) throw new Error("Self-rejection through the checker path is prohibited.");
  if (input.checkerRole !== "DI" && input.checkerRole !== "PA") throw new Error("Different DI or PA rejection is required.");
  if (input.requestVersion !== request.requestVersion) throw new Error("Stale request version cannot be rejected.");
  if (input.evidenceDigest !== request.evidenceDigest) throw new Error("Changed evidence requires a new rejection decision.");
  if (!input.reasonCode.trim() || !input.rationaleReference.trim()) throw new Error("Rejection reason and rationale evidence are required.");
  return { ...request, state: "REJECTED" as const, rejection: { checkerId: input.checkerId, checkerRole: input.checkerRole, requestVersion: input.requestVersion, evidenceDigest: input.evidenceDigest, reasonCode: input.reasonCode, rationaleReference: input.rationaleReference, rejectedAt: "2026-08-25T17:00:00.000Z" }, immutableTransitionIds: [...request.immutableTransitionIds, "GA-EVT-0092-REJECTED"] };
}

export function expireGovernedAction(request: GovernedActionRequest, injectedNow: string) {
  if (request.state === "EXPIRED") return request;
  if (request.state !== "PENDING_APPROVAL") throw new Error("Only pending requests can expire.");
  if (Date.parse(injectedNow) < Date.parse(request.expiresAt)) throw new Error("Request is not eligible for expiry.");
  return { ...request, state: "EXPIRED" as const, clock: injectedNow, immutableTransitionIds: [...request.immutableTransitionIds, "GA-EVT-0092-EXPIRED"] };
}

export function replaceTerminalRequest(request: GovernedActionRequest) {
  if (request.state !== "REJECTED" && request.state !== "EXPIRED") throw new Error("Only terminal requests require replacement.");
  return { ...request, requestVersion: request.requestVersion + 1, state: "DRAFT" as const, clock: "2026-08-25T18:05:00.000Z", expiresAt: "2026-08-25T20:00:00.000Z", approval: null, rejection: null, immutableTransitionIds: [...request.immutableTransitionIds, `GA-EVT-0092-REPLACEMENT-V${request.requestVersion + 1}`] };
}

export function escalateAlert(alert: GovernedAlert, events: readonly AlertEvent[], input: Readonly<{ actorId: string; actorRole: "OP" | "CF" | "DI" | "AU" | "DP"; injectedNow: string; target: string }>) {
  if (input.actorRole === "AU" || input.actorRole === "DP") throw new Error("Alert escalation is not authorised.");
  if (alert.state !== "ACKNOWLEDGED" && alert.state !== "ASSIGNED" && alert.state !== "ESCALATED") throw new Error("Only unresolved acknowledged or assigned alerts can escalate.");
  if (alert.escalationLevel >= 2) return { alert, events, idempotent: true as const };
  const threshold = alert.escalationLevel === 0 ? alert.dueAt : alert.escalationDueAt!;
  if (Date.parse(input.injectedNow) < Date.parse(threshold)) return { alert, events, idempotent: true as const };
  const level = (alert.escalationLevel + 1) as 1 | 2;
  const next: GovernedAlert = { ...alert, alertVersion: alert.alertVersion + 1, state: "ESCALATED", escalationLevel: level, escalatedAt: input.injectedNow, escalationTarget: input.target, escalationDueAt: level === 1 ? "2026-08-25T23:00:00.000Z" : "2026-08-26T01:00:00.000Z", ownerId: input.target, assignmentVersion: alert.assignmentVersion + 1 };
  const escalationEvent: AlertEvent = { eventId: `${alert.alertId}-EVT-${String(next.alertVersion).padStart(2, "0")}`, eventVersion: 1, schemaVersion: ALERT_EVENT_SCHEMA_VERSION, alertId: alert.alertId, alertVersion: next.alertVersion, organisationId: alert.organisationId, occurredAt: input.injectedNow, actorId: input.actorId, actorRole: input.actorRole, eventType: "ESCALATED", outcome: "ESCALATED", reasonCode: `SLA_ESCALATION_LEVEL_${level}`, ownerId: input.target, evidenceIds: alert.evidenceIds, correlationId: alert.correlationId, causationId: events.at(-1)?.eventId ?? alert.causationId, immutable: true, sensitiveFieldsRedacted: true };
  return { alert: next, events: [...events, escalationEvent] as readonly AlertEvent[], idempotent: false as const };
}

export const filterTerminalRequests = (requests: readonly GovernedActionRequest[], state: "PENDING_APPROVAL" | "REJECTED" | "EXPIRED") => requests.filter((request) => request.state === state);
export const filterEscalatedAlerts = (alerts: readonly GovernedAlert[], level?: 1 | 2) => alerts.filter((alert) => alert.state === "ESCALATED" && (!level || alert.escalationLevel === level));
