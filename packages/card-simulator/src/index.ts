import { createHash } from "node:crypto";

export const CARD_SIMULATOR_VERSION = "card-simulator@1.0.0" as const;
export type CardCurrency = "USD" | "CAD" | "GBP";
export type SimulatorMode = "SIMULATED" | "LIVE";
export type CardStatus = "ACTIVE" | "FROZEN" | "CLOSED";
export type AuthorizationOutcome = "APPROVED" | "DECLINED";
export type AuthorizationReason = "APPROVED" | "CARD_NOT_ACTIVE" | "CURRENCY_NOT_ALLOWED" | "MERCHANT_CATEGORY_NOT_ALLOWED" | "TRANSACTION_LIMIT_EXCEEDED" | "DAILY_LIMIT_EXCEEDED" | "INSUFFICIENT_AVAILABLE_VALUE";

export type CardProfile = Readonly<{ cardId: string; customerId: string; walletId: string; organisationId: string; currency: CardCurrency; status: CardStatus; allowedMerchantCategoryCodes: readonly string[]; transactionLimitMinor: number; dailyLimitMinor: number }>;
export type Merchant = Readonly<{ merchantId: string; merchantName: string; merchantCategoryCode: string; countryCode: string }>;
export type AuthorizeCardCommand = Readonly<{ commandId: string; idempotencyKey: string; authorizationId: string; cardId: string; amountMinor: number; currency: CardCurrency; merchant: Merchant; availableValueMinor: number; occurredAt: string; correlationId: string; mode: SimulatorMode }>;
export type CardAuthorization = Readonly<{ authorizationId: string; cardId: string; customerId: string; walletId: string; organisationId: string; amountMinor: number; currency: CardCurrency; merchant: Merchant; outcome: AuthorizationOutcome; reason: AuthorizationReason; status: "OPEN" | "PARTIALLY_CLEARED" | "CLEARED" | "REVERSED" | "DECLINED"; clearedMinor: number; releasedMinor: number; outstandingMinor: number; authorizedAt: string; correlationId: string; idempotencyKey: string; mode: "SIMULATED"; simulatorVersion: typeof CARD_SIMULATOR_VERSION }>;
export type ClearCardCommand = Readonly<{ commandId: string; idempotencyKey: string; clearingId: string; authorizationId: string; providerReference: string; amountMinor: number; currency: CardCurrency; clearedAt: string; mode: SimulatorMode }>;
export type CardClearing = Readonly<{ clearingId: string; authorizationId: string | null; providerReference: string; amountMinor: number; currency: CardCurrency; status: "ACCEPTED" | "BREAK"; reason: "MATCHED_AUTHORIZATION" | "AUTHORIZATION_NOT_FOUND" | "AUTHORIZATION_NOT_OPEN" | "AMOUNT_EXCEEDS_AUTHORIZATION" | "CURRENCY_MISMATCH"; clearedAt: string; idempotencyKey: string; mode: "SIMULATED" }>;
export type ReverseAuthorizationCommand = Readonly<{ commandId: string; idempotencyKey: string; reversalId: string; authorizationId: string; reason: string; reversedAt: string; mode: SimulatorMode }>;
export type AuthorizationReversal = Readonly<{ reversalId: string; authorizationId: string; releasedMinor: number; reason: string; reversedAt: string; idempotencyKey: string; mode: "SIMULATED" }>;
export type ClearingInstruction = Readonly<{ instructionId: string; idempotencyKey: string; clearingId: string; authorizationId: string; customerId: string; walletId: string; organisationId: string; providerReference: string; merchantId: string; amountMinor: number; currency: CardCurrency; eventType: "CARD_CLEARING_ACCEPTED"; source: "CARD_SIMULATOR"; correlationId: string }>;
export type ReconciliationBreak = Readonly<{ breakId: string; clearingId: string; reason: CardClearing["reason"]; amountMinor: number; currency: CardCurrency; status: "OPEN"; createdAt: string }>;

const fingerprint = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const requireText = (value: string, label: string) => { if (!value.trim()) throw new Error(`${label} is required.`); };
const requireTimestamp = (value: string, label: string) => { if (!Number.isFinite(Date.parse(value))) throw new Error(`${label} must be a valid timestamp.`); };
const requirePositiveMinor = (value: number, label: string) => { if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${label} must be a positive safe integer in minor units.`); };
const requireSimulated = (mode: SimulatorMode) => { if (mode !== "SIMULATED") throw new Error("Live card processing is prohibited before the Phase 6 controlled enablement."); };
const dateKey = (timestamp: string) => timestamp.slice(0, 10);

export class CardAuthorizationClearingSimulator {
  private readonly cards = new Map<string, CardProfile>();
  private readonly authorizations = new Map<string, CardAuthorization>();
  private readonly authorizationKeys = new Map<string, Readonly<{ fingerprint: string; authorizationId: string }>>();
  private readonly clearings = new Map<string, CardClearing>();
  private readonly clearingKeys = new Map<string, Readonly<{ fingerprint: string; clearingId: string }>>();
  private readonly reversals = new Map<string, AuthorizationReversal>();
  private readonly reversalKeys = new Map<string, Readonly<{ fingerprint: string; reversalId: string }>>();
  private readonly instructions = new Map<string, ClearingInstruction>();
  private readonly breaks = new Map<string, ReconciliationBreak>();

  constructor(cards: readonly CardProfile[]) {
    if (cards.length === 0) throw new Error("At least one card profile is required.");
    for (const card of cards) {
      validateCard(card);
      if (this.cards.has(card.cardId)) throw new Error("Card IDs must be unique.");
      this.cards.set(card.cardId, { ...card, allowedMerchantCategoryCodes: [...card.allowedMerchantCategoryCodes] });
    }
  }

  authorize(command: AuthorizeCardCommand): CardAuthorization {
    validateAuthorizationCommand(command);
    const replay = this.authorizationKeys.get(command.idempotencyKey);
    const commandFingerprint = fingerprint(command);
    if (replay) {
      if (replay.fingerprint !== commandFingerprint) throw new Error("Authorization idempotency key was reused with a different command.");
      return this.authorizations.get(replay.authorizationId)!;
    }
    if (this.authorizations.has(command.authorizationId)) throw new Error("Authorization ID must be unique.");
    const card = this.cards.get(command.cardId);
    if (!card) throw new Error("Card profile was not found.");
    const reservedMinor = [...this.authorizations.values()].filter((authorization) => authorization.cardId === card.cardId && authorization.outcome === "APPROVED").reduce((sum, authorization) => sum + authorization.outstandingMinor, 0);
    const dailyApprovedMinor = [...this.authorizations.values()].filter((authorization) => authorization.cardId === card.cardId && authorization.outcome === "APPROVED" && dateKey(authorization.authorizedAt) === dateKey(command.occurredAt)).reduce((sum, authorization) => sum + authorization.amountMinor, 0);
    let reason: AuthorizationReason = "APPROVED";
    if (card.status !== "ACTIVE") reason = "CARD_NOT_ACTIVE";
    else if (card.currency !== command.currency) reason = "CURRENCY_NOT_ALLOWED";
    else if (!card.allowedMerchantCategoryCodes.includes(command.merchant.merchantCategoryCode)) reason = "MERCHANT_CATEGORY_NOT_ALLOWED";
    else if (command.amountMinor > card.transactionLimitMinor) reason = "TRANSACTION_LIMIT_EXCEEDED";
    else if (dailyApprovedMinor + command.amountMinor > card.dailyLimitMinor) reason = "DAILY_LIMIT_EXCEEDED";
    else if (reservedMinor + command.amountMinor > command.availableValueMinor) reason = "INSUFFICIENT_AVAILABLE_VALUE";
    const approved = reason === "APPROVED";
    const authorization: CardAuthorization = { authorizationId: command.authorizationId, cardId: card.cardId, customerId: card.customerId, walletId: card.walletId, organisationId: card.organisationId, amountMinor: command.amountMinor, currency: command.currency, merchant: { ...command.merchant }, outcome: approved ? "APPROVED" : "DECLINED", reason, status: approved ? "OPEN" : "DECLINED", clearedMinor: 0, releasedMinor: 0, outstandingMinor: approved ? command.amountMinor : 0, authorizedAt: command.occurredAt, correlationId: command.correlationId, idempotencyKey: command.idempotencyKey, mode: "SIMULATED", simulatorVersion: CARD_SIMULATOR_VERSION };
    this.authorizations.set(authorization.authorizationId, authorization);
    this.authorizationKeys.set(command.idempotencyKey, { fingerprint: commandFingerprint, authorizationId: authorization.authorizationId });
    return authorization;
  }

  clear(command: ClearCardCommand): CardClearing {
    validateClearingCommand(command);
    const replay = this.clearingKeys.get(command.idempotencyKey);
    const commandFingerprint = fingerprint(command);
    if (replay) {
      if (replay.fingerprint !== commandFingerprint) throw new Error("Clearing idempotency key was reused with a different command.");
      return this.clearings.get(replay.clearingId)!;
    }
    if (this.clearings.has(command.clearingId)) throw new Error("Clearing ID must be unique.");
    const authorization = this.authorizations.get(command.authorizationId);
    let reason: CardClearing["reason"] = "MATCHED_AUTHORIZATION";
    if (!authorization) reason = "AUTHORIZATION_NOT_FOUND";
    else if (authorization.status !== "OPEN" && authorization.status !== "PARTIALLY_CLEARED") reason = "AUTHORIZATION_NOT_OPEN";
    else if (authorization.currency !== command.currency) reason = "CURRENCY_MISMATCH";
    else if (command.amountMinor > authorization.outstandingMinor) reason = "AMOUNT_EXCEEDS_AUTHORIZATION";
    const accepted = reason === "MATCHED_AUTHORIZATION";
    const clearing: CardClearing = { clearingId: command.clearingId, authorizationId: authorization?.authorizationId ?? null, providerReference: command.providerReference, amountMinor: command.amountMinor, currency: command.currency, status: accepted ? "ACCEPTED" : "BREAK", reason, clearedAt: command.clearedAt, idempotencyKey: command.idempotencyKey, mode: "SIMULATED" };
    this.clearings.set(clearing.clearingId, clearing);
    this.clearingKeys.set(command.idempotencyKey, { fingerprint: commandFingerprint, clearingId: clearing.clearingId });
    if (accepted && authorization) {
      const clearedMinor = authorization.clearedMinor + command.amountMinor;
      const outstandingMinor = authorization.amountMinor - clearedMinor - authorization.releasedMinor;
      this.authorizations.set(authorization.authorizationId, { ...authorization, clearedMinor, outstandingMinor, status: outstandingMinor === 0 ? "CLEARED" : "PARTIALLY_CLEARED" });
      this.instructions.set(clearing.clearingId, { instructionId: `card-clearing:${clearing.clearingId}`, idempotencyKey: `card-clearing:${clearing.clearingId}`, clearingId: clearing.clearingId, authorizationId: authorization.authorizationId, customerId: authorization.customerId, walletId: authorization.walletId, organisationId: authorization.organisationId, providerReference: clearing.providerReference, merchantId: authorization.merchant.merchantId, amountMinor: clearing.amountMinor, currency: clearing.currency, eventType: "CARD_CLEARING_ACCEPTED", source: "CARD_SIMULATOR", correlationId: authorization.correlationId });
    } else {
      this.breaks.set(clearing.clearingId, { breakId: `card-break:${clearing.clearingId}`, clearingId: clearing.clearingId, reason, amountMinor: clearing.amountMinor, currency: clearing.currency, status: "OPEN", createdAt: clearing.clearedAt });
    }
    return clearing;
  }

  reverse(command: ReverseAuthorizationCommand): AuthorizationReversal {
    validateReversalCommand(command);
    const replay = this.reversalKeys.get(command.idempotencyKey);
    const commandFingerprint = fingerprint(command);
    if (replay) {
      if (replay.fingerprint !== commandFingerprint) throw new Error("Reversal idempotency key was reused with a different command.");
      return this.reversals.get(replay.reversalId)!;
    }
    if (this.reversals.has(command.reversalId)) throw new Error("Reversal ID must be unique.");
    const authorization = this.authorizations.get(command.authorizationId);
    if (!authorization || (authorization.status !== "OPEN" && authorization.status !== "PARTIALLY_CLEARED")) throw new Error("Only an open authorization can be reversed.");
    const reversal: AuthorizationReversal = { reversalId: command.reversalId, authorizationId: authorization.authorizationId, releasedMinor: authorization.outstandingMinor, reason: command.reason, reversedAt: command.reversedAt, idempotencyKey: command.idempotencyKey, mode: "SIMULATED" };
    this.authorizations.set(authorization.authorizationId, { ...authorization, releasedMinor: authorization.releasedMinor + authorization.outstandingMinor, outstandingMinor: 0, status: "REVERSED" });
    this.reversals.set(reversal.reversalId, reversal);
    this.reversalKeys.set(command.idempotencyKey, { fingerprint: commandFingerprint, reversalId: reversal.reversalId });
    return reversal;
  }

  getAuthorization(authorizationId: string): CardAuthorization | undefined { return this.authorizations.get(authorizationId); }
  listClearings(): readonly CardClearing[] { return [...this.clearings.values()]; }
  listClearingInstructions(): readonly ClearingInstruction[] { return [...this.instructions.values()]; }
  listReconciliationBreaks(): readonly ReconciliationBreak[] { return [...this.breaks.values()]; }
}

function validateCard(card: CardProfile) {
  for (const [value, label] of [[card.cardId, "Card ID"], [card.customerId, "Customer ID"], [card.walletId, "Wallet ID"], [card.organisationId, "Organisation ID"]] as const) requireText(value, label);
  if (card.allowedMerchantCategoryCodes.length === 0 || card.allowedMerchantCategoryCodes.some((code) => !code.trim())) throw new Error("At least one merchant category code is required.");
  requirePositiveMinor(card.transactionLimitMinor, "Transaction limit");
  requirePositiveMinor(card.dailyLimitMinor, "Daily limit");
  if (card.transactionLimitMinor > card.dailyLimitMinor) throw new Error("Transaction limit cannot exceed daily limit.");
}
function validateAuthorizationCommand(command: AuthorizeCardCommand) {
  requireSimulated(command.mode);
  for (const [value, label] of [[command.commandId, "Command ID"], [command.idempotencyKey, "Idempotency key"], [command.authorizationId, "Authorization ID"], [command.cardId, "Card ID"], [command.correlationId, "Correlation ID"], [command.merchant.merchantId, "Merchant ID"], [command.merchant.merchantName, "Merchant name"], [command.merchant.merchantCategoryCode, "Merchant category code"], [command.merchant.countryCode, "Merchant country"]] as const) requireText(value, label);
  requirePositiveMinor(command.amountMinor, "Authorization amount");
  if (!Number.isSafeInteger(command.availableValueMinor) || command.availableValueMinor < 0) throw new Error("Available value must be a non-negative safe integer in minor units.");
  requireTimestamp(command.occurredAt, "Authorization time");
}
function validateClearingCommand(command: ClearCardCommand) {
  requireSimulated(command.mode);
  for (const [value, label] of [[command.commandId, "Command ID"], [command.idempotencyKey, "Idempotency key"], [command.clearingId, "Clearing ID"], [command.authorizationId, "Authorization ID"], [command.providerReference, "Provider reference"]] as const) requireText(value, label);
  requirePositiveMinor(command.amountMinor, "Clearing amount");
  requireTimestamp(command.clearedAt, "Clearing time");
}
function validateReversalCommand(command: ReverseAuthorizationCommand) {
  requireSimulated(command.mode);
  for (const [value, label] of [[command.commandId, "Command ID"], [command.idempotencyKey, "Idempotency key"], [command.reversalId, "Reversal ID"], [command.authorizationId, "Authorization ID"], [command.reason, "Reversal reason"]] as const) requireText(value, label);
  requireTimestamp(command.reversedAt, "Reversal time");
}
