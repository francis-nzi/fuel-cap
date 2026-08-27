import { createHash } from "node:crypto";
export const RECONCILIATION_VERSION = "reconciliation@1.0.0" as const;
export type Currency = "USD" | "CAD" | "GBP";
export type InFlightItem = Readonly<{ itemId: string; type: "PROCESSOR" | "BANK" | "STATION"; amountMinor: number; externalReference: string; identified: boolean }>;
export type ExternalMatch = Readonly<{ matchId: string; source: "STRIPE" | "BANK" | "STATION" | "XERO"; internalReference: string; externalReference: string | null; internalAmountMinor: number; externalAmountMinor: number | null }>;
export type ReconciliationInput = Readonly<{ runId: string; idempotencyKey: string; legalEntityId: string; currency: Currency; safeguardedCashMinor: number; customerAvailableMinor: number; customerReservedMinor: number; refundPayableMinor: number; ledgerIntegrityValid: boolean; inFlightItems: readonly InFlightItem[]; externalMatches: readonly ExternalMatch[]; observedAt: string }>;
export type BreakReason = "LEDGER_INTEGRITY_FAILED" | "SAFEGUARDING_MISMATCH" | "UNIDENTIFIED_IN_FLIGHT_ITEM" | "EXTERNAL_ITEM_MISSING" | "EXTERNAL_AMOUNT_MISMATCH";
export type ReconciliationBreak = Readonly<{ breakId: string; runId: string; reason: BreakReason; reference: string; differenceMinor: number; status: "OPEN" | "CLEARED"; blocks: readonly ("PAYMENTS" | "SETTLEMENT" | "WITHDRAWALS" | "ACCOUNT_CLOSURE")[]; openedAt: string; clearedAt: string | null; clearanceEvidence: string | null; makerId: string | null; checkerId: string | null }>;
export type ReconciliationReport = Readonly<{ runId: string; legalEntityId: string; currency: Currency; safeguardedCashMinor: number; customerLiabilitiesMinor: number; identifiedInFlightAdjustmentMinor: number; differenceMinor: number; status: "PASS" | "BREAK"; breakIds: readonly string[]; observedAt: string; version: typeof RECONCILIATION_VERSION }>;
export type ReconciliationState = Readonly<{ reports: readonly ReconciliationReport[]; breaks: readonly ReconciliationBreak[]; idempotency: Readonly<Record<string, Readonly<{ fingerprint: string; runId: string }>>> }>;
export type ClearBreakCommand = Readonly<{ breakId: string; makerId: string; checkerId: string; evidence: string; stepUpVerified: boolean; breakGlass: boolean; correctedRunId: string; clearedAt: string }>;
const hash = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex");
const blocks = ["PAYMENTS", "SETTLEMENT", "WITHDRAWALS", "ACCOUNT_CLOSURE"] as const;
export const createReconciliationState = (): ReconciliationState => ({ reports: [], breaks: [], idempotency: {} });
export function runReconciliation(state: ReconciliationState, input: ReconciliationInput): Readonly<{ state: ReconciliationState; report: ReconciliationReport; idempotentReplay: boolean }> {
  validate(input); const fingerprint = hash(input); const prior = state.idempotency[input.idempotencyKey];
  if (prior) { if (prior.fingerprint !== fingerprint) throw new Error("Reconciliation idempotency key was reused with different evidence."); return { state, report: state.reports.find((r) => r.runId === prior.runId)!, idempotentReplay: true }; }
  if (state.reports.some((r) => r.runId === input.runId)) throw new Error("Reconciliation run ID must be unique.");
  const customerLiabilitiesMinor = input.customerAvailableMinor + input.customerReservedMinor + input.refundPayableMinor;
  const identifiedInFlightAdjustmentMinor = input.inFlightItems.filter((i) => i.identified).reduce((n, i) => n + i.amountMinor, 0);
  const differenceMinor = input.safeguardedCashMinor + identifiedInFlightAdjustmentMinor - customerLiabilitiesMinor;
  const findings: { reason: BreakReason; reference: string; difference: number }[] = [];
  if (!input.ledgerIntegrityValid) findings.push({ reason: "LEDGER_INTEGRITY_FAILED", reference: input.legalEntityId, difference: 0 });
  if (differenceMinor !== 0) findings.push({ reason: "SAFEGUARDING_MISMATCH", reference: input.legalEntityId, difference: differenceMinor });
  for (const item of input.inFlightItems.filter((i) => !i.identified)) findings.push({ reason: "UNIDENTIFIED_IN_FLIGHT_ITEM", reference: item.itemId, difference: item.amountMinor });
  for (const item of input.externalMatches) if (item.externalReference === null || item.externalAmountMinor === null) findings.push({ reason: "EXTERNAL_ITEM_MISSING", reference: item.internalReference, difference: item.internalAmountMinor }); else if (item.internalAmountMinor !== item.externalAmountMinor) findings.push({ reason: "EXTERNAL_AMOUNT_MISMATCH", reference: item.internalReference, difference: item.externalAmountMinor - item.internalAmountMinor });
  const created = findings.map((f, index): ReconciliationBreak => ({ breakId: `${input.runId}:BREAK:${index + 1}`, runId: input.runId, reason: f.reason, reference: f.reference, differenceMinor: f.difference, status: "OPEN", blocks, openedAt: input.observedAt, clearedAt: null, clearanceEvidence: null, makerId: null, checkerId: null }));
  const report: ReconciliationReport = { runId: input.runId, legalEntityId: input.legalEntityId, currency: input.currency, safeguardedCashMinor: input.safeguardedCashMinor, customerLiabilitiesMinor, identifiedInFlightAdjustmentMinor, differenceMinor, status: created.length ? "BREAK" : "PASS", breakIds: created.map((b) => b.breakId), observedAt: input.observedAt, version: RECONCILIATION_VERSION };
  return { state: { reports: [...state.reports, report], breaks: [...state.breaks, ...created], idempotency: { ...state.idempotency, [input.idempotencyKey]: { fingerprint, runId: input.runId } } }, report, idempotentReplay: false };
}
export function clearBreak(state: ReconciliationState, command: ClearBreakCommand): ReconciliationState {
  const target = state.breaks.find((b) => b.breakId === command.breakId); if (!target || target.status !== "OPEN") throw new Error("An open reconciliation break is required.");
  if (!command.makerId.trim() || !command.checkerId.trim() || command.makerId === command.checkerId) throw new Error("Different maker and checker identities are required.");
  if (!command.evidence.trim() || !command.stepUpVerified) throw new Error("Clearance evidence and step-up verification are required.");
  if (command.breakGlass) throw new Error("Break-glass cannot clear or manufacture reconciliation.");
  const corrected = state.reports.find((r) => r.runId === command.correctedRunId); if (!corrected || corrected.status !== "PASS" || corrected.legalEntityId !== state.reports.find((r) => r.runId === target.runId)?.legalEntityId || corrected.currency !== state.reports.find((r) => r.runId === target.runId)?.currency) throw new Error("A passing corrected reconciliation for the same scope is required.");
  if (!Number.isFinite(Date.parse(command.clearedAt))) throw new Error("Clearance timestamp is required.");
  return { ...state, breaks: state.breaks.map((b) => b.breakId === target.breakId ? { ...b, status: "CLEARED", clearedAt: command.clearedAt, clearanceEvidence: command.evidence, makerId: command.makerId, checkerId: command.checkerId } : b) };
}
export const isActionBlocked = (state: ReconciliationState, action: ReconciliationBreak["blocks"][number]) => state.breaks.some((b) => b.status === "OPEN" && b.blocks.includes(action));
function validate(input: ReconciliationInput) { for (const value of [input.runId, input.idempotencyKey, input.legalEntityId]) if (!value.trim()) throw new Error("Reconciliation identity is required."); for (const value of [input.safeguardedCashMinor, input.customerAvailableMinor, input.customerReservedMinor, input.refundPayableMinor]) if (!Number.isSafeInteger(value) || value < 0) throw new Error("Balances require non-negative integer minor units."); if (!Number.isFinite(Date.parse(input.observedAt))) throw new Error("Observation timestamp is required."); for (const item of input.inFlightItems) if (!item.itemId.trim() || !item.externalReference.trim() || !Number.isSafeInteger(item.amountMinor)) throw new Error("In-flight items require identity, evidence and integer amount."); }
