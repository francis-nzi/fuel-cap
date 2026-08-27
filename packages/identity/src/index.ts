export type CustomerState = "PROSPECT" | "ONBOARDING" | "PENDING_VERIFICATION" | "ACTIVE" | "RESTRICTED" | "SUSPENDED" | "CLOSED";
export type CustomerProfile = Readonly<{ customerId: string; principalId: string; organisationId: string; state: CustomerState; country: string; region: string; currency: "USD" | "CAD" | "GBP"; profileVersion: number }>;
export type ConsentRecord = Readonly<{ consentId: string; customerId: string; organisationId: string; type: "TERMS" | "PRIVACY" | "MARKETING" | "AUTO_ROLLOVER"; version: number; textHash: string; accepted: boolean; channel: string; recordedAt: string }>;
export type Customer360 = Readonly<{ customer: CustomerProfile; consents: readonly ConsentRecord[]; walletIds: readonly string[]; protectionIds: readonly string[]; transactionIds: readonly string[]; invoiceIds: readonly string[]; caseIds: readonly string[]; evidenceIds: readonly string[] }>;
export type SupportCaseKind = "SUPPORT" | "COMPLAINT" | "DATA_CORRECTION";
export type SupportCaseState = "OPEN" | "ASSIGNED" | "INVESTIGATING" | "AWAITING_CUSTOMER" | "RESOLVED" | "CLOSED";
export type SupportRole = "CS" | "OP" | "CF";
export type SupportCase = Readonly<{ caseId: string; organisationId: string; customerId: string; kind: SupportCaseKind; state: SupportCaseState; summary: string; openedAt: string; dueAt: string; ownerId: string | null; resolution: string | null; resolutionEvidenceIds: readonly string[]; complaintOutcomeSentAt: string | null; version: number }>;
export type SupportCaseEvent = Readonly<{ eventId: string; caseId: string; organisationId: string; version: number; action: "OPENED" | "ASSIGNED" | "INVESTIGATION_STARTED" | "CUSTOMER_INPUT_REQUESTED" | "RESOLVED" | "OUTCOME_SENT" | "CLOSED"; actorId: string; actorRole: SupportRole; occurredAt: string; evidenceIds: readonly string[]; immutable: true }>;
export type SupportCaseHistory = Readonly<{ supportCase: SupportCase; events: readonly SupportCaseEvent[] }>;

const requireTime = (value: string, label: string) => { if (!Number.isFinite(Date.parse(value))) throw new Error(`${label} must be a valid timestamp.`); };
const event = (record: SupportCase, action: SupportCaseEvent["action"], actorId: string, actorRole: SupportRole, occurredAt: string, evidenceIds: readonly string[]): SupportCaseEvent => ({ eventId: `${record.caseId}:EVT:${record.version}`, caseId: record.caseId, organisationId: record.organisationId, version: record.version, action, actorId, actorRole, occurredAt, evidenceIds: [...evidenceIds], immutable: true });

export function buildCustomer360(input: Readonly<{ organisationId: string; customer: CustomerProfile; consents?: readonly ConsentRecord[]; walletIds?: readonly string[]; protectionIds?: readonly string[]; transactionIds?: readonly string[]; invoiceIds?: readonly string[]; caseIds?: readonly string[]; evidenceIds?: readonly string[] }>): Customer360 {
  if (input.customer.organisationId !== input.organisationId || input.consents?.some((item) => item.organisationId !== input.organisationId || item.customerId !== input.customer.customerId)) throw new Error("Cross-tenant customer evidence is prohibited.");
  return { customer: input.customer, consents: [...(input.consents ?? [])], walletIds: [...(input.walletIds ?? [])], protectionIds: [...(input.protectionIds ?? [])], transactionIds: [...(input.transactionIds ?? [])], invoiceIds: [...(input.invoiceIds ?? [])], caseIds: [...(input.caseIds ?? [])], evidenceIds: [...(input.evidenceIds ?? [])] };
}

export function openSupportCase(input: Readonly<{ caseId: string; organisationId: string; customerId: string; kind: SupportCaseKind; summary: string; openedAt: string; dueAt: string; actorId: string; actorRole: SupportRole }>): SupportCaseHistory {
  if (!input.caseId.trim() || !input.organisationId.trim() || !input.customerId.trim() || !input.summary.trim() || !input.actorId.trim()) throw new Error("Case identity, scope, summary and actor are required.");
  if (input.actorRole !== "CS" && input.actorRole !== "OP" && input.actorRole !== "CF") throw new Error("Role cannot open support cases.");
  requireTime(input.openedAt, "Opened time"); requireTime(input.dueAt, "Due time");
  if (Date.parse(input.dueAt) <= Date.parse(input.openedAt)) throw new Error("Case due time must follow opening.");
  const record: SupportCase = { caseId: input.caseId, organisationId: input.organisationId, customerId: input.customerId, kind: input.kind, state: "OPEN", summary: input.summary, openedAt: input.openedAt, dueAt: input.dueAt, ownerId: null, resolution: null, resolutionEvidenceIds: [], complaintOutcomeSentAt: null, version: 1 };
  return { supportCase: record, events: [event(record, "OPENED", input.actorId, input.actorRole, input.openedAt, [])] };
}

export function assignSupportCase(history: SupportCaseHistory, input: Readonly<{ organisationId: string; ownerId: string; actorId: string; actorRole: SupportRole; occurredAt: string }>): SupportCaseHistory {
  if (history.supportCase.organisationId !== input.organisationId) throw new Error("Cross-tenant case access is prohibited.");
  if (history.supportCase.state !== "OPEN" || !input.ownerId.trim()) throw new Error("Only open cases can be assigned.");
  const next = { ...history.supportCase, state: "ASSIGNED" as const, ownerId: input.ownerId, version: history.supportCase.version + 1 };
  return { supportCase: next, events: [...history.events, event(next, "ASSIGNED", input.actorId, input.actorRole, input.occurredAt, [])] };
}

export function startInvestigation(history: SupportCaseHistory, input: Readonly<{ organisationId: string; actorId: string; actorRole: SupportRole; occurredAt: string; evidenceIds: readonly string[] }>): SupportCaseHistory {
  if (history.supportCase.organisationId !== input.organisationId) throw new Error("Cross-tenant case access is prohibited.");
  if (history.supportCase.state !== "ASSIGNED" || !input.evidenceIds.length) throw new Error("Assigned case and investigation evidence are required.");
  const next = { ...history.supportCase, state: "INVESTIGATING" as const, version: history.supportCase.version + 1 };
  return { supportCase: next, events: [...history.events, event(next, "INVESTIGATION_STARTED", input.actorId, input.actorRole, input.occurredAt, input.evidenceIds)] };
}

export function resolveSupportCase(history: SupportCaseHistory, input: Readonly<{ organisationId: string; actorId: string; actorRole: SupportRole; occurredAt: string; resolution: string; evidenceIds: readonly string[] }>): SupportCaseHistory {
  const record = history.supportCase;
  if (record.organisationId !== input.organisationId) throw new Error("Cross-tenant case access is prohibited.");
  if (record.state !== "INVESTIGATING" || !input.resolution.trim() || !input.evidenceIds.length) throw new Error("Investigated case, resolution and evidence are required.");
  if ((record.kind === "COMPLAINT" || record.kind === "DATA_CORRECTION") && input.actorRole !== "CF") throw new Error("Compliance must resolve complaints and sensitive corrections.");
  const next = { ...record, state: "RESOLVED" as const, resolution: input.resolution, resolutionEvidenceIds: [...input.evidenceIds], version: record.version + 1 };
  return { supportCase: next, events: [...history.events, event(next, "RESOLVED", input.actorId, input.actorRole, input.occurredAt, input.evidenceIds)] };
}

export function recordComplaintOutcome(history: SupportCaseHistory, input: Readonly<{ organisationId: string; actorId: string; actorRole: SupportRole; occurredAt: string; evidenceId: string }>): SupportCaseHistory {
  const record = history.supportCase;
  if (record.organisationId !== input.organisationId || record.kind !== "COMPLAINT" || record.state !== "RESOLVED" || !input.evidenceId.trim()) throw new Error("Resolved tenant complaint and outcome evidence are required.");
  const next = { ...record, complaintOutcomeSentAt: input.occurredAt, version: record.version + 1 };
  return { supportCase: next, events: [...history.events, event(next, "OUTCOME_SENT", input.actorId, input.actorRole, input.occurredAt, [input.evidenceId])] };
}

export function closeSupportCase(history: SupportCaseHistory, input: Readonly<{ organisationId: string; actorId: string; actorRole: SupportRole; occurredAt: string }>): SupportCaseHistory {
  const record = history.supportCase;
  if (record.organisationId !== input.organisationId || record.state !== "RESOLVED" || (record.kind === "COMPLAINT" && !record.complaintOutcomeSentAt)) throw new Error("Resolved case and required complaint outcome are required before closure.");
  const next = { ...record, state: "CLOSED" as const, version: record.version + 1 };
  return { supportCase: next, events: [...history.events, event(next, "CLOSED", input.actorId, input.actorRole, input.occurredAt, [])] };
}

export function supportCaseSla(record: SupportCase, at: string): "ON_TRACK" | "DUE_SOON" | "BREACHED" | "COMPLETE" {
  if (record.state === "CLOSED") return "COMPLETE";
  const remaining = Date.parse(record.dueAt) - Date.parse(at);
  return remaining < 0 ? "BREACHED" : remaining <= 86_400_000 ? "DUE_SOON" : "ON_TRACK";
}

export * from "./kyc";
