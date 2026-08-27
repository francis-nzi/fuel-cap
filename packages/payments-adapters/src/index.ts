import type { LaunchGateResult } from "@fuelcap/compliance";

export type AdapterEnvironment = "SANDBOX" | "PRODUCTION";
export type MoneyCurrency = "USD" | "CAD" | "GBP";
export type CardEventType = "AUTHORIZATION" | "CLEARING" | "REVERSAL";
export interface CardProgrammeEvent { readonly eventId: string; readonly eventType: CardEventType; readonly providerId: string; readonly environment: AdapterEnvironment; readonly organisationId: string; readonly legalEntityId: string; readonly cardToken: string; readonly providerReference: string; readonly amountMinor: number; readonly currency: MoneyCurrency; readonly occurredAt: string; readonly signatureVerified: boolean; readonly payloadHash: string; }
export interface BankObservation { readonly observationId: string; readonly providerId: string; readonly environment: AdapterEnvironment; readonly organisationId: string; readonly legalEntityId: string; readonly accountToken: string; readonly providerReference: string; readonly direction: "CREDIT" | "DEBIT"; readonly amountMinor: number; readonly currency: MoneyCurrency; readonly bookedAt: string; readonly signatureVerified: boolean; readonly payloadHash: string; }
export interface NormalizedExternalInstruction { readonly instructionId: string; readonly sourceEventId: string; readonly source: "CARD_PROGRAMME" | "BANK"; readonly type: CardEventType | "BANK_CREDIT" | "BANK_DEBIT"; readonly organisationId: string; readonly legalEntityId: string; readonly providerReference: string; readonly tokenizedInstrument: string; readonly amountMinor: number; readonly currency: MoneyCurrency; readonly occurredAt: string; readonly evidenceHash: string; readonly environment: AdapterEnvironment; readonly canPostLedger: false; readonly requiresLedgerIdempotency: true; readonly immutable: true; }
export interface AdapterDeadLetter { readonly deadLetterId: string; readonly sourceEventId: string; readonly reason: string; readonly ownerRole: "DATA_INTEGRATIONS"; readonly retryable: boolean; readonly evidenceHash: string | null; }

export function authorizePaymentEnvironment(environment: AdapterEnvironment, launchGate: LaunchGateResult): void {
  if (environment === "PRODUCTION" && (launchGate.decision !== "READY" || !launchGate.productionCredentialsMayBeProvisioned)) throw new Error("Production card and banking integrations are blocked by the P6-001 launch gate.");
}

const validateCommon = (event: Readonly<{ environment: AdapterEnvironment; organisationId: string; legalEntityId: string; amountMinor: number; occurredAt: string; signatureVerified: boolean; payloadHash: string }>, launchGate: LaunchGateResult) => {
  authorizePaymentEnvironment(event.environment, launchGate);
  if (!event.organisationId.trim() || !event.legalEntityId.trim()) throw new Error("Tenant and legal-entity scope are required.");
  if (!Number.isSafeInteger(event.amountMinor) || event.amountMinor <= 0) throw new Error("Amount must be positive safe-integer minor units.");
  if (!Number.isFinite(Date.parse(event.occurredAt))) throw new Error("A valid event timestamp is required.");
  if (!event.signatureVerified || !event.payloadHash.startsWith("sha256:")) throw new Error("Authenticated, content-addressed provider evidence is required.");
};
const ensureFresh = (eventId: string, seen: ReadonlySet<string> | undefined) => { if (seen?.has(eventId)) throw new Error("Duplicate provider event is blocked; replay must use the downstream idempotency record."); };

export function normalizeCardProgrammeEvent(event: CardProgrammeEvent, launchGate: LaunchGateResult, seenEventIds?: ReadonlySet<string>): NormalizedExternalInstruction {
  validateCommon(event, launchGate); ensureFresh(event.eventId, seenEventIds);
  if (!event.cardToken.startsWith("card_tok_") || !event.providerReference.trim()) throw new Error("Tokenized card and provider reference are required; PAN data is prohibited.");
  return { instructionId: `card:${event.eventId}`, sourceEventId: event.eventId, source: "CARD_PROGRAMME", type: event.eventType, organisationId: event.organisationId, legalEntityId: event.legalEntityId, providerReference: event.providerReference, tokenizedInstrument: event.cardToken, amountMinor: event.amountMinor, currency: event.currency, occurredAt: event.occurredAt, evidenceHash: event.payloadHash, environment: event.environment, canPostLedger: false, requiresLedgerIdempotency: true, immutable: true };
}

export function normalizeBankObservation(event: BankObservation, launchGate: LaunchGateResult, seenObservationIds?: ReadonlySet<string>): NormalizedExternalInstruction {
  validateCommon({ ...event, occurredAt: event.bookedAt }, launchGate); ensureFresh(event.observationId, seenObservationIds);
  if (!event.accountToken.startsWith("bank_tok_") || !event.providerReference.trim()) throw new Error("Tokenized bank account and provider reference are required; account details are prohibited.");
  return { instructionId: `bank:${event.observationId}`, sourceEventId: event.observationId, source: "BANK", type: event.direction === "CREDIT" ? "BANK_CREDIT" : "BANK_DEBIT", organisationId: event.organisationId, legalEntityId: event.legalEntityId, providerReference: event.providerReference, tokenizedInstrument: event.accountToken, amountMinor: event.amountMinor, currency: event.currency, occurredAt: event.bookedAt, evidenceHash: event.payloadHash, environment: event.environment, canPostLedger: false, requiresLedgerIdempotency: true, immutable: true };
}

export function createDeadLetter(sourceEventId: string, reason: string, evidenceHash: string | null, retryable = true): AdapterDeadLetter {
  if (!sourceEventId.trim() || !reason.trim()) throw new Error("Dead-letter source and reason are required.");
  return { deadLetterId: `payments-dlq:${sourceEventId}`, sourceEventId, reason, ownerRole: "DATA_INTEGRATIONS", retryable, evidenceHash };
}

export function reconcileExternalInstruction(instruction: NormalizedExternalInstruction, internal: Readonly<{ organisationId: string; legalEntityId: string; amountMinor: number; currency: MoneyCurrency; internalReference: string }>) {
  if (instruction.organisationId !== internal.organisationId || instruction.legalEntityId !== internal.legalEntityId) return { status: "BREAK" as const, reason: "SCOPE_MISMATCH" as const, differenceMinor: instruction.amountMinor };
  if (instruction.currency !== internal.currency) return { status: "BREAK" as const, reason: "CURRENCY_MISMATCH" as const, differenceMinor: instruction.amountMinor };
  const differenceMinor = instruction.amountMinor - internal.amountMinor;
  return differenceMinor === 0 ? { status: "MATCHED" as const, reason: null, differenceMinor: 0, internalReference: internal.internalReference } : { status: "BREAK" as const, reason: "AMOUNT_MISMATCH" as const, differenceMinor };
}
