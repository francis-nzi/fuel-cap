import { createHash } from "node:crypto";

export const LEDGER_VERSION = "ledger@1.0.0" as const;
export type Currency = "USD" | "CAD" | "GBP" | "EUR";
export type AccountType = "ASSET" | "LIABILITY" | "REVENUE" | "EXPENSE" | "EQUITY_RESERVE";
export type Side = "DEBIT" | "CREDIT";
export type AccountPurpose = "SAFEGUARDED_CASH" | "PROCESSOR_CLEARING" | "CUSTOMER_AVAILABLE" | "CUSTOMER_RESERVED" | "CUSTOMER_REFUND_PAYABLE" | "STATION_PAYABLE" | "POOL_FUNDING" | "BUFFER_RESERVE" | "MARGIN_REVENUE" | "PROTECTION_CLAIM" | "HEDGE_ASSET_PAYABLE" | "HEDGE_COST_RECOVERY" | "FX_ROUNDING_GAIN_LOSS" | "FX_BRIDGE";
export type LedgerAccount = Readonly<{ accountId: string; legalEntityId: string; currency: Currency; type: AccountType; normalBalance: Side; purpose: AccountPurpose }>;
export type JournalLine = Readonly<{ lineId: string; accountId: string; currency: Currency; side: Side; amountMinor: number }>;
export type PositionMovement = Readonly<{ movementId: string; positionId: string; fuelProductId: string; type: "PROTECT" | "ALLOCATE" | "REDEEM" | "RELEASE" | "REVERSE"; quantity4dp: number }>;
export type PostingLineage = Readonly<{ organisationId: string; legalEntityId: string; market: string; sourceContractId: string; rulesVersion: string; scenarioId: string | null; externalReference: string | null; actorId: string; correlationId: string }>;
export type PostJournalCommand = Readonly<{ commandId: string; idempotencyKey: string; journalId: string; transactionId: string; eventType: string; postedAt: string; lines: readonly JournalLine[]; positionMovements: readonly PositionMovement[]; lineage: PostingLineage; correctionOf: string | null }>;
export type PostedJournal = Readonly<PostJournalCommand & { ledgerVersion: typeof LEDGER_VERSION; sequence: number; previousHash: string; integrityHash: string; commandFingerprint: string }>;
export type LedgerState = Readonly<{ ledgerId: string; accounts: readonly LedgerAccount[]; journals: readonly PostedJournal[]; idempotency: Readonly<Record<string, string>> }>;
export type PostingResult = Readonly<{ state: LedgerState; journal: PostedJournal; idempotentReplay: boolean }>;
export type AccountProjection = Readonly<{ accountId: string; currency: Currency; debitsMinor: number; creditsMinor: number; balanceMinor: number }>;
export type SafeguardingReconciliation = Readonly<{ legalEntityId: string; currency: Currency; safeguardedCashMinor: number; customerLiabilitiesMinor: number; inFlightAdjustmentMinor: number; differenceMinor: number; status: "PASS" | "BREAK"; reasonCode: "SAFEGUARDING_RECONCILES" | "SAFEGUARDING_SHORTFALL_OR_EXCESS" }>;

const currencyScale: Readonly<Record<Currency, number>> = { USD: 2, CAD: 2, GBP: 2, EUR: 2 };
export const minorUnitScale = (currency: Currency) => currencyScale[currency];
const hash = (value: unknown) => `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
const commandFingerprint = (command: PostJournalCommand) => hash(command);
const signed = (side: Side, amountMinor: number) => side === "DEBIT" ? amountMinor : -amountMinor;

function validateCommand(state: LedgerState, command: PostJournalCommand) {
  if (!command.commandId.trim() || !command.idempotencyKey.trim() || !command.journalId.trim() || !command.transactionId.trim() || !command.eventType.trim() || !Number.isFinite(Date.parse(command.postedAt))) throw new Error("Journal identity, event and timestamp are required.");
  if (!command.lineage.organisationId.trim() || !command.lineage.legalEntityId.trim() || !command.lineage.sourceContractId.trim() || !command.lineage.rulesVersion.trim() || !command.lineage.actorId.trim() || !command.lineage.correlationId.trim()) throw new Error("Complete posting lineage is required.");
  if (command.lines.length < 2) throw new Error("A journal requires at least two lines.");
  const lineIds = new Set<string>();
  const balances = new Map<Currency, number>();
  for (const line of command.lines) {
    if (!line.lineId.trim() || lineIds.has(line.lineId) || !Number.isSafeInteger(line.amountMinor) || line.amountMinor <= 0) throw new Error("Journal lines require unique identities and positive integer minor units.");
    lineIds.add(line.lineId);
    const account = state.accounts.find(({ accountId }) => accountId === line.accountId);
    if (!account || account.currency !== line.currency || account.legalEntityId !== command.lineage.legalEntityId) throw new Error("Journal account, currency and legal entity must agree.");
    balances.set(line.currency, (balances.get(line.currency) ?? 0) + signed(line.side, line.amountMinor));
  }
  if ([...balances.values()].some((balance) => balance !== 0)) throw new Error("Journal must balance independently in every currency.");
  const movementIds = new Set<string>();
  for (const movement of command.positionMovements) {
    if (!movement.movementId.trim() || movementIds.has(movement.movementId) || !movement.positionId.trim() || !movement.fuelProductId.trim() || !Number.isSafeInteger(movement.quantity4dp) || movement.quantity4dp <= 0) throw new Error("Position movements require unique identities and positive four-decimal quantities.");
    movementIds.add(movement.movementId);
  }
  if (state.journals.some(({ journalId }) => journalId === command.journalId)) throw new Error("Journal identity must be unique.");
  if (command.correctionOf !== null && !state.journals.some(({ journalId }) => journalId === command.correctionOf)) throw new Error("Correction must reference an existing journal.");
}

export function createLedgerState(ledgerId: string, accounts: readonly LedgerAccount[]): LedgerState {
  if (!ledgerId.trim() || accounts.length === 0 || new Set(accounts.map(({ accountId }) => accountId)).size !== accounts.length) throw new Error("Ledger and unique accounts are required.");
  for (const account of accounts) {
    const requiredNormal: Side = account.type === "ASSET" || account.type === "EXPENSE" ? "DEBIT" : "CREDIT";
    if (!account.accountId.trim() || !account.legalEntityId.trim() || account.normalBalance !== requiredNormal) throw new Error("Account normal balance does not match its accounting type.");
  }
  return { ledgerId, accounts: accounts.map((account) => ({ ...account })), journals: [], idempotency: {} };
}

export function postJournal(state: LedgerState, command: PostJournalCommand): PostingResult {
  const fingerprint = commandFingerprint(command);
  const existingJournalId = state.idempotency[command.idempotencyKey];
  if (existingJournalId) {
    const existing = state.journals.find(({ journalId }) => journalId === existingJournalId)!;
    if (existing.commandFingerprint !== fingerprint) throw new Error("Idempotency key was reused with a different command.");
    return { state, journal: existing, idempotentReplay: true };
  }
  validateCommand(state, command);
  const previous = state.journals.at(-1);
  const sequence = (previous?.sequence ?? 0) + 1;
  const previousHash = previous?.integrityHash ?? "GENESIS";
  const journalWithoutHash = { ...command, ledgerVersion: LEDGER_VERSION, sequence, previousHash, commandFingerprint: fingerprint };
  const journal: PostedJournal = { ...journalWithoutHash, lines: command.lines.map((line) => ({ ...line })), positionMovements: command.positionMovements.map((movement) => ({ ...movement })), lineage: { ...command.lineage }, integrityHash: hash(journalWithoutHash) };
  return { state: { ...state, journals: [...state.journals, journal], idempotency: { ...state.idempotency, [command.idempotencyKey]: journal.journalId } }, journal, idempotentReplay: false };
}

export function verifyLedgerIntegrity(state: LedgerState): boolean {
  let previousHash = "GENESIS";
  for (let index = 0; index < state.journals.length; index += 1) {
    const journal = state.journals[index]!;
    const { integrityHash, ...journalWithoutHash } = journal;
    if (journal.sequence !== index + 1 || journal.previousHash !== previousHash || hash(journalWithoutHash) !== integrityHash) return false;
    previousHash = integrityHash;
  }
  return true;
}

export function projectAccounts(state: LedgerState): readonly AccountProjection[] {
  return state.accounts.map((account) => {
    const lines = state.journals.flatMap(({ lines: journalLines }) => journalLines).filter(({ accountId }) => accountId === account.accountId);
    const debitsMinor = lines.filter(({ side }) => side === "DEBIT").reduce((sum, { amountMinor }) => sum + amountMinor, 0);
    const creditsMinor = lines.filter(({ side }) => side === "CREDIT").reduce((sum, { amountMinor }) => sum + amountMinor, 0);
    const balanceMinor = account.normalBalance === "DEBIT" ? debitsMinor - creditsMinor : creditsMinor - debitsMinor;
    return { accountId: account.accountId, currency: account.currency, debitsMinor, creditsMinor, balanceMinor };
  });
}

export function reconcileSafeguarding(state: LedgerState, legalEntityId: string, currency: Currency, inFlightAdjustmentMinor: number): SafeguardingReconciliation {
  if (!Number.isSafeInteger(inFlightAdjustmentMinor)) throw new Error("In-flight adjustment must use integer minor units.");
  const projections = projectAccounts(state);
  const accounts = state.accounts.filter((account) => account.legalEntityId === legalEntityId && account.currency === currency);
  const balanceFor = (purposes: readonly AccountPurpose[]) => accounts.filter(({ purpose }) => purposes.includes(purpose)).reduce((sum, account) => sum + (projections.find(({ accountId }) => accountId === account.accountId)?.balanceMinor ?? 0), 0);
  const safeguardedCashMinor = balanceFor(["SAFEGUARDED_CASH"]);
  const customerLiabilitiesMinor = balanceFor(["CUSTOMER_AVAILABLE", "CUSTOMER_RESERVED", "CUSTOMER_REFUND_PAYABLE"]);
  const differenceMinor = safeguardedCashMinor + inFlightAdjustmentMinor - customerLiabilitiesMinor;
  return { legalEntityId, currency, safeguardedCashMinor, customerLiabilitiesMinor, inFlightAdjustmentMinor, differenceMinor, status: differenceMinor === 0 ? "PASS" : "BREAK", reasonCode: differenceMinor === 0 ? "SAFEGUARDING_RECONCILES" : "SAFEGUARDING_SHORTFALL_OR_EXCESS" };
}

export function createReversalCommand(original: PostedJournal, input: Readonly<{ commandId: string; idempotencyKey: string; journalId: string; transactionId: string; postedAt: string; actorId: string; approverId: string; reason: string }>): PostJournalCommand {
  if (input.actorId === input.approverId) throw new Error("Correction maker and checker must differ.");
  if (!input.reason.trim()) throw new Error("Correction reason is required.");
  return { commandId: input.commandId, idempotencyKey: input.idempotencyKey, journalId: input.journalId, transactionId: input.transactionId, eventType: `REVERSAL:${original.eventType}`, postedAt: input.postedAt, lines: original.lines.map((line, index) => ({ ...line, lineId: `${input.journalId}:LINE:${index + 1}`, side: line.side === "DEBIT" ? "CREDIT" : "DEBIT" })), positionMovements: original.positionMovements.map((movement, index) => ({ ...movement, movementId: `${input.journalId}:MOV:${index + 1}`, type: "REVERSE" })), lineage: { ...original.lineage, actorId: input.actorId, sourceContractId: `${original.lineage.sourceContractId}:REVERSAL`, correlationId: `${original.lineage.correlationId}:REVERSAL` }, correctionOf: original.journalId };
}
