import { projectAccounts, verifyLedgerIntegrity, type Currency, type LedgerState, type PositionMovement } from "@fuelcap/ledger";

export const WALLET_VERSION = "wallet@1.0.0" as const;
export type WalletDefinition = Readonly<{ walletId: string; customerId: string; organisationId: string; legalEntityId: string; currency: Currency; availableAccountId: string; reservedAccountId: string; refundPayableAccountId: string; positionIds: readonly string[] }>;
export type WalletBalance = Readonly<{ walletId: string; customerId: string; currency: Currency; availableMinor: number; reservedMinor: number; refundPayableMinor: number; totalCustomerValueMinor: number; protectedQuantity4dp: number; state: "CURRENT" | "BREAK"; reasonCodes: readonly string[]; throughSequence: number; throughIntegrityHash: string; derivedBy: typeof WALLET_VERSION }>;
export type WalletActivity = Readonly<{ journalId: string; sequence: number; transactionId: string; eventType: string; postedAt: string; availableDeltaMinor: number; reservedDeltaMinor: number; refundPayableDeltaMinor: number; protectedQuantityDelta4dp: number; integrityHash: string }>;

const movementEffect = (movement: PositionMovement) => movement.type === "PROTECT" ? movement.quantity4dp : movement.type === "REDEEM" || movement.type === "RELEASE" ? -movement.quantity4dp : 0;

function validateDefinition(state: LedgerState, definition: WalletDefinition) {
  if (!definition.walletId.trim() || !definition.customerId.trim() || !definition.organisationId.trim() || !definition.legalEntityId.trim()) throw new Error("Wallet identity and scope are required.");
  const required = [[definition.availableAccountId, "CUSTOMER_AVAILABLE"], [definition.reservedAccountId, "CUSTOMER_RESERVED"], [definition.refundPayableAccountId, "CUSTOMER_REFUND_PAYABLE"]] as const;
  if (new Set(required.map(([accountId]) => accountId)).size !== required.length) throw new Error("Wallet liability accounts must be distinct.");
  for (const [accountId, purpose] of required) {
    const account = state.accounts.find((candidate) => candidate.accountId === accountId);
    if (!account || account.purpose !== purpose || account.type !== "LIABILITY" || account.currency !== definition.currency || account.legalEntityId !== definition.legalEntityId) throw new Error("Wallet account purpose, entity and currency must agree.");
  }
}

function positionDeltaForJournal(state: LedgerState, journalIndex: number, positionIds: ReadonlySet<string>) {
  const journal = state.journals[journalIndex]!;
  if (journal.correctionOf !== null && journal.positionMovements.every(({ type }) => type === "REVERSE")) {
    const original = state.journals.find(({ journalId }) => journalId === journal.correctionOf);
    if (!original) return 0;
    return -original.positionMovements.filter(({ positionId }) => positionIds.has(positionId)).reduce((sum, movement) => sum + movementEffect(movement), 0);
  }
  return journal.positionMovements.filter(({ positionId }) => positionIds.has(positionId)).reduce((sum, movement) => sum + movementEffect(movement), 0);
}

export function deriveWalletBalance(state: LedgerState, definition: WalletDefinition): WalletBalance {
  validateDefinition(state, definition);
  const reasonCodes: string[] = [];
  if (!verifyLedgerIntegrity(state)) reasonCodes.push("LEDGER_INTEGRITY_FAILED");
  const projections = projectAccounts(state);
  const balance = (accountId: string) => projections.find((projection) => projection.accountId === accountId)!.balanceMinor;
  const availableMinor = balance(definition.availableAccountId);
  const reservedMinor = balance(definition.reservedAccountId);
  const refundPayableMinor = balance(definition.refundPayableAccountId);
  if ([availableMinor, reservedMinor, refundPayableMinor].some((value) => value < 0)) reasonCodes.push("NEGATIVE_CUSTOMER_LIABILITY");
  const positionIds = new Set(definition.positionIds);
  const protectedQuantity4dp = state.journals.reduce((sum, _journal, index) => sum + positionDeltaForJournal(state, index, positionIds), 0);
  if (protectedQuantity4dp < 0) reasonCodes.push("NEGATIVE_PROTECTED_QUANTITY");
  const last = state.journals.at(-1);
  return { walletId: definition.walletId, customerId: definition.customerId, currency: definition.currency, availableMinor, reservedMinor, refundPayableMinor, totalCustomerValueMinor: availableMinor + reservedMinor + refundPayableMinor, protectedQuantity4dp, state: reasonCodes.length ? "BREAK" : "CURRENT", reasonCodes, throughSequence: last?.sequence ?? 0, throughIntegrityHash: last?.integrityHash ?? "GENESIS", derivedBy: WALLET_VERSION };
}

export function deriveWalletActivity(state: LedgerState, definition: WalletDefinition): readonly WalletActivity[] {
  validateDefinition(state, definition);
  const positionIds = new Set(definition.positionIds);
  const signedLiabilityDelta = (accountId: string, lines: LedgerState["journals"][number]["lines"]) => lines.filter((line) => line.accountId === accountId).reduce((sum, line) => sum + (line.side === "CREDIT" ? line.amountMinor : -line.amountMinor), 0);
  return state.journals.map((journal, index) => ({ journalId: journal.journalId, sequence: journal.sequence, transactionId: journal.transactionId, eventType: journal.eventType, postedAt: journal.postedAt, availableDeltaMinor: signedLiabilityDelta(definition.availableAccountId, journal.lines), reservedDeltaMinor: signedLiabilityDelta(definition.reservedAccountId, journal.lines), refundPayableDeltaMinor: signedLiabilityDelta(definition.refundPayableAccountId, journal.lines), protectedQuantityDelta4dp: positionDeltaForJournal(state, index, positionIds), integrityHash: journal.integrityHash })).filter((activity) => activity.availableDeltaMinor !== 0 || activity.reservedDeltaMinor !== 0 || activity.refundPayableDeltaMinor !== 0 || activity.protectedQuantityDelta4dp !== 0);
}

export function assertWalletSnapshot(state: LedgerState, definition: WalletDefinition, expected: WalletBalance): WalletBalance {
  const rebuilt = deriveWalletBalance(state, definition);
  if (JSON.stringify(rebuilt) !== JSON.stringify(expected)) throw new Error("Stored wallet snapshot diverges from the authoritative journal rebuild.");
  return rebuilt;
}
