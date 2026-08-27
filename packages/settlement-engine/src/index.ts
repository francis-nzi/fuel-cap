import { createHash } from "node:crypto";

export const SETTLEMENT_ENGINE_VERSION = "settlement-engine@1.0.0" as const;
export type SettlementCurrency = "USD" | "CAD" | "GBP";
export type AllocationEvidence = Readonly<{ allocationId: string; purchaseId: string; clearingId: string; customerId: string; walletId: string; organisationId: string; currency: SettlementCurrency; confirmedFuelQuantity4dp: number; unprotectedQuantity4dp: number; nonFuelAmountMinor: number; actualPumpObservationId: string; provenance: "ACTUAL" | "SIMULATED"; correlationId: string; lines: readonly Readonly<{ protectionTransactionId: string; allocatedQuantity4dp: number; protectionChargeMinor: 0; quoteId: string; spreadDecisionVersion: string; rulesVersion: string }>[] }>;
export type ProtectionTerms = Readonly<{ protectionTransactionId: string; strikePrice4dp: number; maximumBoundaryPrice4dp: number; referencePrice4dp: number }>;
export type SettlementAccounts = Readonly<{ customerReservedAccountId: string; customerAvailableAccountId: string; protectionClaimAccountId: string; stationPayableAccountId: string }>;
export type SettlementCommand = Readonly<{ commandId: string; idempotencyKey: string; settlementId: string; allocation: AllocationEvidence; terms: readonly ProtectionTerms[]; actualPumpPrice4dp: number; accounts: SettlementAccounts; legalEntityId: string; market: string; actorId: string; settledAt: string }>;
export type PostingLine = Readonly<{ lineId: string; accountId: string; side: "DEBIT" | "CREDIT"; amountMinor: number }>;
export type SettlementSlice = Readonly<{ protectionTransactionId: string | null; quantity4dp: number; strikePrice4dp: number | null; maximumBoundaryPrice4dp: number | null; stationExactNumerator: number; customerExactNumerator: number; contributionExactNumerator: number; lowerPriceBenefitExactNumerator: number; aboveBoundaryExactNumerator: number }>;
export type SettlementDecision = Readonly<{ settlementId: string; allocationId: string; purchaseId: string; customerId: string; walletId: string; organisationId: string; currency: SettlementCurrency; actualPumpPrice4dp: number; confirmedFuelQuantity4dp: number; stationPaymentMinor: number; customerDebitMinor: number; poolContributionMinor: number; reservedDebitMinor: number; availableDebitMinor: number; lowerPriceReleaseMinor: number; aboveBoundaryCustomerMinor: number; roundingResidualNumerator: number; slices: readonly SettlementSlice[]; postingInstruction: Readonly<{ idempotencyKey: string; eventType: "FUEL_PURCHASE_SETTLED"; lines: readonly PostingLine[]; positionRedemptions: readonly Readonly<{ protectionTransactionId: string; quantity4dp: number }>[]; sourceContractId: string; correlationId: string; rulesVersions: readonly string[]; spreadDecisionVersions: readonly string[]; provenance: "ACTUAL" | "SIMULATED" }>; settledAt: string; settlementVersion: typeof SETTLEMENT_ENGINE_VERSION }>;
export type SettlementState = Readonly<{ decisions: readonly SettlementDecision[]; idempotency: Readonly<Record<string, Readonly<{ fingerprint: string; settlementId: string }>>> }>;
export type CancellationCommand = Readonly<{ cancellationId: string; idempotencyKey: string; protectionTransactionId: string; remainingQuantity4dp: number; strikePrice4dp: number; currency: SettlementCurrency; customerReservedAccountId: string; customerAvailableAccountId: string; canceledAt: string }>;
export type CancellationDecision = Readonly<{ cancellationId: string; protectionTransactionId: string; releasedQuantity4dp: number; exactReleaseNumerator: number; customerCreditMinor: number; absorbedResidualNumerator: number; protectionChargeRefundMinor: 0; postingLines: readonly PostingLine[]; canceledAt: string }>;

const DENOMINATOR = 1_000_000;
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const floorMinor = (numerator: number) => Math.floor(numerator / DENOMINATOR);
const ceilMinor = (numerator: number) => Math.ceil(numerator / DENOMINATOR);
const halfUpMinor = (numerator: number) => Math.floor((numerator + DENOMINATOR / 2) / DENOMINATOR);
const exact = (price4dp: number, quantity4dp: number) => price4dp * quantity4dp;
const requireText = (value: string, label: string) => { if (!value.trim()) throw new Error(`${label} is required.`); };
const requirePositive = (value: number, label: string) => { if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${label} must be a positive safe integer.`); };

export const createSettlementState = (): SettlementState => ({ decisions: [], idempotency: {} });

export function settlePurchase(state: SettlementState, command: SettlementCommand): Readonly<{ state: SettlementState; decision: SettlementDecision; idempotentReplay: boolean }> {
  validateSettlement(command);
  const fingerprint = hash(command);
  const prior = state.idempotency[command.idempotencyKey];
  if (prior) {
    if (prior.fingerprint !== fingerprint) throw new Error("Settlement idempotency key was reused with a different command.");
    return { state, decision: state.decisions.find(({ settlementId }) => settlementId === prior.settlementId)!, idempotentReplay: true };
  }
  if (state.decisions.some((decision) => decision.settlementId === command.settlementId || decision.allocationId === command.allocation.allocationId)) throw new Error("Settlement and allocation IDs must be unique.");
  const terms = new Map(command.terms.map((item) => [item.protectionTransactionId, item]));
  const slices: SettlementSlice[] = command.allocation.lines.map((line) => {
    const term = terms.get(line.protectionTransactionId);
    if (!term) throw new Error("Every protected allocation line requires pinned settlement terms.");
    const contributionPrice4dp = Math.max(0, Math.min(command.actualPumpPrice4dp, term.maximumBoundaryPrice4dp) - term.strikePrice4dp);
    return { protectionTransactionId: line.protectionTransactionId, quantity4dp: line.allocatedQuantity4dp, strikePrice4dp: term.strikePrice4dp, maximumBoundaryPrice4dp: term.maximumBoundaryPrice4dp, stationExactNumerator: exact(command.actualPumpPrice4dp, line.allocatedQuantity4dp), customerExactNumerator: exact(command.actualPumpPrice4dp - contributionPrice4dp, line.allocatedQuantity4dp), contributionExactNumerator: exact(contributionPrice4dp, line.allocatedQuantity4dp), lowerPriceBenefitExactNumerator: exact(Math.max(0, term.strikePrice4dp - command.actualPumpPrice4dp), line.allocatedQuantity4dp), aboveBoundaryExactNumerator: exact(Math.max(0, command.actualPumpPrice4dp - term.maximumBoundaryPrice4dp), line.allocatedQuantity4dp) };
  });
  if (command.allocation.unprotectedQuantity4dp > 0) slices.push({ protectionTransactionId: null, quantity4dp: command.allocation.unprotectedQuantity4dp, strikePrice4dp: null, maximumBoundaryPrice4dp: null, stationExactNumerator: exact(command.actualPumpPrice4dp, command.allocation.unprotectedQuantity4dp), customerExactNumerator: exact(command.actualPumpPrice4dp, command.allocation.unprotectedQuantity4dp), contributionExactNumerator: 0, lowerPriceBenefitExactNumerator: 0, aboveBoundaryExactNumerator: 0 });
  const sum = (key: keyof Pick<SettlementSlice, "stationExactNumerator" | "customerExactNumerator" | "contributionExactNumerator" | "lowerPriceBenefitExactNumerator" | "aboveBoundaryExactNumerator">) => slices.reduce((total, slice) => total + slice[key], 0);
  const stationExact = sum("stationExactNumerator");
  const customerExact = sum("customerExactNumerator");
  const stationPaymentMinor = halfUpMinor(stationExact);
  const customerDebitMinor = floorMinor(customerExact);
  const poolContributionMinor = stationPaymentMinor - customerDebitMinor;
  const lowerPriceReleaseMinor = ceilMinor(sum("lowerPriceBenefitExactNumerator"));
  const aboveBoundaryCustomerMinor = floorMinor(sum("aboveBoundaryExactNumerator"));
  const protectedStrikeExact = command.allocation.lines.reduce((total, line) => total + exact(terms.get(line.protectionTransactionId)!.strikePrice4dp, line.allocatedQuantity4dp), 0);
  const reservedDebitMinor = floorMinor(protectedStrikeExact);
  const availableDebitMinor = Math.max(0, customerDebitMinor + lowerPriceReleaseMinor - reservedDebitMinor);
  const lines: PostingLine[] = [];
  if (reservedDebitMinor > 0) lines.push({ lineId: `${command.settlementId}:RESERVED`, accountId: command.accounts.customerReservedAccountId, side: "DEBIT", amountMinor: reservedDebitMinor });
  if (availableDebitMinor > 0) lines.push({ lineId: `${command.settlementId}:AVAILABLE-DEBIT`, accountId: command.accounts.customerAvailableAccountId, side: "DEBIT", amountMinor: availableDebitMinor });
  if (poolContributionMinor > 0) lines.push({ lineId: `${command.settlementId}:CLAIM`, accountId: command.accounts.protectionClaimAccountId, side: "DEBIT", amountMinor: poolContributionMinor });
  lines.push({ lineId: `${command.settlementId}:STATION`, accountId: command.accounts.stationPayableAccountId, side: "CREDIT", amountMinor: stationPaymentMinor });
  if (lowerPriceReleaseMinor > 0) lines.push({ lineId: `${command.settlementId}:AVAILABLE-CREDIT`, accountId: command.accounts.customerAvailableAccountId, side: "CREDIT", amountMinor: lowerPriceReleaseMinor });
  if (lines.filter(({ side }) => side === "DEBIT").reduce((n, line) => n + line.amountMinor, 0) !== lines.filter(({ side }) => side === "CREDIT").reduce((n, line) => n + line.amountMinor, 0)) throw new Error("Settlement posting instruction must balance.");
  const decision: SettlementDecision = { settlementId: command.settlementId, allocationId: command.allocation.allocationId, purchaseId: command.allocation.purchaseId, customerId: command.allocation.customerId, walletId: command.allocation.walletId, organisationId: command.allocation.organisationId, currency: command.allocation.currency, actualPumpPrice4dp: command.actualPumpPrice4dp, confirmedFuelQuantity4dp: command.allocation.confirmedFuelQuantity4dp, stationPaymentMinor, customerDebitMinor, poolContributionMinor, reservedDebitMinor, availableDebitMinor, lowerPriceReleaseMinor, aboveBoundaryCustomerMinor, roundingResidualNumerator: customerExact - customerDebitMinor * DENOMINATOR, slices, postingInstruction: { idempotencyKey: `settlement:${command.settlementId}`, eventType: "FUEL_PURCHASE_SETTLED", lines, positionRedemptions: command.allocation.lines.map((line) => ({ protectionTransactionId: line.protectionTransactionId, quantity4dp: line.allocatedQuantity4dp })), sourceContractId: command.allocation.allocationId, correlationId: command.allocation.correlationId, rulesVersions: [...new Set(command.allocation.lines.map(({ rulesVersion }) => rulesVersion))], spreadDecisionVersions: [...new Set(command.allocation.lines.map(({ spreadDecisionVersion }) => spreadDecisionVersion))], provenance: command.allocation.provenance }, settledAt: command.settledAt, settlementVersion: SETTLEMENT_ENGINE_VERSION };
  return { state: { decisions: [...state.decisions, decision], idempotency: { ...state.idempotency, [command.idempotencyKey]: { fingerprint, settlementId: decision.settlementId } } }, decision, idempotentReplay: false };
}

export function cancelRemainingProtection(command: CancellationCommand): CancellationDecision {
  for (const value of [command.cancellationId, command.idempotencyKey, command.protectionTransactionId, command.customerReservedAccountId, command.customerAvailableAccountId]) requireText(value, "Cancellation identity");
  requirePositive(command.remainingQuantity4dp, "Remaining quantity"); requirePositive(command.strikePrice4dp, "Strike price");
  if (!Number.isFinite(Date.parse(command.canceledAt))) throw new Error("Cancellation timestamp is required.");
  const exactReleaseNumerator = exact(command.strikePrice4dp, command.remainingQuantity4dp);
  const customerCreditMinor = ceilMinor(exactReleaseNumerator);
  return { cancellationId: command.cancellationId, protectionTransactionId: command.protectionTransactionId, releasedQuantity4dp: command.remainingQuantity4dp, exactReleaseNumerator, customerCreditMinor, absorbedResidualNumerator: customerCreditMinor * DENOMINATOR - exactReleaseNumerator, protectionChargeRefundMinor: 0, postingLines: [{ lineId: `${command.cancellationId}:RESERVED`, accountId: command.customerReservedAccountId, side: "DEBIT", amountMinor: customerCreditMinor }, { lineId: `${command.cancellationId}:AVAILABLE`, accountId: command.customerAvailableAccountId, side: "CREDIT", amountMinor: customerCreditMinor }], canceledAt: command.canceledAt };
}

function validateSettlement(command: SettlementCommand) {
  for (const value of [command.commandId, command.idempotencyKey, command.settlementId, command.legalEntityId, command.market, command.actorId, command.accounts.customerReservedAccountId, command.accounts.customerAvailableAccountId, command.accounts.protectionClaimAccountId, command.accounts.stationPayableAccountId]) requireText(value, "Settlement identity");
  requirePositive(command.actualPumpPrice4dp, "Actual pump price");
  if (!Number.isFinite(Date.parse(command.settledAt))) throw new Error("Settlement timestamp is required.");
  const allocated = command.allocation.lines.reduce((total, line) => total + line.allocatedQuantity4dp, 0) + command.allocation.unprotectedQuantity4dp;
  if (allocated !== command.allocation.confirmedFuelQuantity4dp) throw new Error("Protected and unprotected allocation must equal confirmed fuel quantity.");
  for (const term of command.terms) if (!Number.isSafeInteger(term.strikePrice4dp) || !Number.isSafeInteger(term.maximumBoundaryPrice4dp) || term.maximumBoundaryPrice4dp < term.strikePrice4dp) throw new Error("Settlement terms require valid fixed-point prices and boundary.");
}
