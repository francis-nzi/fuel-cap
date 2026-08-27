import { createHash } from "node:crypto";

export const ALLOCATION_ENGINE_VERSION = "allocation-engine@1.0.0" as const;
export type AllocationCurrency = "USD" | "CAD" | "GBP";
export type ProtectionOwner = Readonly<{ type: "CUSTOMER" | "VEHICLE" | "POOL"; ownerId: string }>;
export type ProtectionScope = Readonly<{ type: "STATION" | "PROVIDER" | "GEOGRAPHY"; scopeId: string }>;
export type ProtectionStatus = "ACTIVE" | "CANCELED" | "EXPIRED";
export type ProtectionPosition = Readonly<{ protectionTransactionId: string; owner: ProtectionOwner; countryCode: string; currency: AllocationCurrency; fuelGradeId: string; scope: ProtectionScope; status: ProtectionStatus; startsAt: string; expiresAt: string; acceptedAt: string; remainingQuantity4dp: number; referencePriceId: string; quoteId: string; spreadDecisionVersion: string; rulesVersion: string }>;
export type AllocationState = Readonly<{ positions: readonly ProtectionPosition[]; allocations: readonly PurchaseAllocation[]; idempotency: Readonly<Record<string, Readonly<{ fingerprint: string; allocationId: string }>>> }>;

export type ClearingEvidence = Readonly<{ clearingId: string; authorizationId: string; customerId: string; walletId: string; organisationId: string; providerReference: string; merchantId: string; amountMinor: number; currency: AllocationCurrency; eventType: "CARD_CLEARING_ACCEPTED"; source: "CARD_SIMULATOR"; correlationId: string }>;
export type PurchaseMatchCommand = Readonly<{ commandId: string; idempotencyKey: string; allocationId: string; purchaseId: string; clearing: ClearingEvidence; customerId: string; vehicleId: string | null; protectionPoolId: string | null; countryCode: string; currency: AllocationCurrency; fuelGradeId: string; stationId: string; providerId: string; geographyId: string; confirmedFuelQuantity4dp: number; nonFuelAmountMinor: number; purchasedAt: string; actualPumpObservationId: string; provenance: "ACTUAL" | "SIMULATED" }>;
export type ProtectionAllocationLine = Readonly<{ lineId: string; protectionTransactionId: string; allocatedQuantity4dp: number; protectionChargeMinor: 0; expiry: string; referencePriceId: string; quoteId: string; spreadDecisionVersion: string; rulesVersion: string }>;
export type PurchaseAllocation = Readonly<{ allocationId: string; purchaseId: string; clearingId: string; authorizationId: string; customerId: string; vehicleId: string | null; walletId: string; organisationId: string; currency: AllocationCurrency; fuelGradeId: string; confirmedFuelQuantity4dp: number; protectedQuantity4dp: number; unprotectedQuantity4dp: number; nonFuelAmountMinor: number; lines: readonly ProtectionAllocationLine[]; unprotectedReason: "NONE" | "NO_ELIGIBLE_PROTECTION" | "PROTECTION_VOLUME_EXHAUSTED"; actualPumpObservationId: string; provenance: "ACTUAL" | "SIMULATED"; purchasedAt: string; correlationId: string; idempotencyKey: string; allocationVersion: typeof ALLOCATION_ENGINE_VERSION }>;
export type AllocationResult = Readonly<{ state: AllocationState; allocation: PurchaseAllocation; idempotentReplay: boolean }>;

const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const requireText = (value: string, label: string) => { if (!value.trim()) throw new Error(`${label} is required.`); };
const requireTimestamp = (value: string, label: string) => { if (!Number.isFinite(Date.parse(value))) throw new Error(`${label} must be a valid timestamp.`); };
const requireNonNegativeMinor = (value: number, label: string) => { if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${label} must be a non-negative safe integer in minor units.`); };
const requirePositiveQuantity = (value: number, label: string) => { if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${label} must be a positive four-decimal integer quantity.`); };

export function createAllocationState(positions: readonly ProtectionPosition[]): AllocationState {
  if (new Set(positions.map(({ protectionTransactionId }) => protectionTransactionId)).size !== positions.length) throw new Error("Protection transaction IDs must be unique.");
  for (const position of positions) validatePosition(position);
  return { positions: positions.map(clonePosition), allocations: [], idempotency: {} };
}

export function allocatePurchase(state: AllocationState, command: PurchaseMatchCommand): AllocationResult {
  validateCommand(command);
  const commandFingerprint = hash(command);
  const prior = state.idempotency[command.idempotencyKey];
  if (prior) {
    if (prior.fingerprint !== commandFingerprint) throw new Error("Allocation idempotency key was reused with a different command.");
    return { state, allocation: state.allocations.find(({ allocationId }) => allocationId === prior.allocationId)!, idempotentReplay: true };
  }
  if (state.allocations.some((allocation) => allocation.allocationId === command.allocationId || allocation.purchaseId === command.purchaseId)) throw new Error("Allocation and purchase IDs must be unique.");
  if (command.clearing.customerId !== command.customerId || command.clearing.currency !== command.currency) throw new Error("Clearing evidence must match the purchase customer and currency.");

  const eligible = state.positions.filter((position) => isEligible(position, command)).sort(comparePositions);
  let remaining = command.confirmedFuelQuantity4dp;
  const lines: ProtectionAllocationLine[] = [];
  const remainingById = new Map(state.positions.map((position) => [position.protectionTransactionId, position.remainingQuantity4dp]));
  for (const position of eligible) {
    if (remaining === 0) break;
    const allocatedQuantity4dp = Math.min(remaining, position.remainingQuantity4dp);
    if (allocatedQuantity4dp === 0) continue;
    lines.push({ lineId: `${command.allocationId}:LINE:${lines.length + 1}`, protectionTransactionId: position.protectionTransactionId, allocatedQuantity4dp, protectionChargeMinor: 0, expiry: position.expiresAt, referencePriceId: position.referencePriceId, quoteId: position.quoteId, spreadDecisionVersion: position.spreadDecisionVersion, rulesVersion: position.rulesVersion });
    remainingById.set(position.protectionTransactionId, position.remainingQuantity4dp - allocatedQuantity4dp);
    remaining -= allocatedQuantity4dp;
  }
  const protectedQuantity4dp = command.confirmedFuelQuantity4dp - remaining;
  const unprotectedReason: PurchaseAllocation["unprotectedReason"] = remaining === 0 ? "NONE" : eligible.length === 0 ? "NO_ELIGIBLE_PROTECTION" : "PROTECTION_VOLUME_EXHAUSTED";
  const allocation: PurchaseAllocation = { allocationId: command.allocationId, purchaseId: command.purchaseId, clearingId: command.clearing.clearingId, authorizationId: command.clearing.authorizationId, customerId: command.customerId, vehicleId: command.vehicleId, walletId: command.clearing.walletId, organisationId: command.clearing.organisationId, currency: command.currency, fuelGradeId: command.fuelGradeId, confirmedFuelQuantity4dp: command.confirmedFuelQuantity4dp, protectedQuantity4dp, unprotectedQuantity4dp: remaining, nonFuelAmountMinor: command.nonFuelAmountMinor, lines, unprotectedReason, actualPumpObservationId: command.actualPumpObservationId, provenance: command.provenance, purchasedAt: command.purchasedAt, correlationId: command.clearing.correlationId, idempotencyKey: command.idempotencyKey, allocationVersion: ALLOCATION_ENGINE_VERSION };
  const positions = state.positions.map((position) => ({ ...position, owner: { ...position.owner }, scope: { ...position.scope }, remainingQuantity4dp: remainingById.get(position.protectionTransactionId)! }));
  return { state: { positions, allocations: [...state.allocations, allocation], idempotency: { ...state.idempotency, [command.idempotencyKey]: { fingerprint: commandFingerprint, allocationId: allocation.allocationId } } }, allocation, idempotentReplay: false };
}

function isEligible(position: ProtectionPosition, command: PurchaseMatchCommand): boolean {
  const ownerMatches = position.owner.type === "CUSTOMER" ? position.owner.ownerId === command.customerId : position.owner.type === "VEHICLE" ? position.owner.ownerId === command.vehicleId : position.owner.ownerId === command.protectionPoolId;
  const scopeMatches = position.scope.type === "STATION" ? position.scope.scopeId === command.stationId : position.scope.type === "PROVIDER" ? position.scope.scopeId === command.providerId : position.scope.scopeId === command.geographyId;
  const purchaseTime = Date.parse(command.purchasedAt);
  return ownerMatches && position.countryCode === command.countryCode && position.currency === command.currency && position.fuelGradeId === command.fuelGradeId && scopeMatches && position.status === "ACTIVE" && position.remainingQuantity4dp > 0 && Date.parse(position.startsAt) <= purchaseTime && purchaseTime < Date.parse(position.expiresAt);
}

function comparePositions(left: ProtectionPosition, right: ProtectionPosition): number {
  return left.expiresAt.localeCompare(right.expiresAt) || left.acceptedAt.localeCompare(right.acceptedAt) || left.protectionTransactionId.localeCompare(right.protectionTransactionId);
}

function validatePosition(position: ProtectionPosition) {
  for (const [value, label] of [[position.protectionTransactionId, "Protection transaction ID"], [position.owner.ownerId, "Protection owner ID"], [position.countryCode, "Country"], [position.fuelGradeId, "Fuel grade"], [position.scope.scopeId, "Protection scope"], [position.referencePriceId, "Reference price ID"], [position.quoteId, "Quote ID"], [position.spreadDecisionVersion, "Spread decision version"], [position.rulesVersion, "Rules version"]] as const) requireText(value, label);
  for (const [value, label] of [[position.startsAt, "Protection start"], [position.expiresAt, "Protection expiry"], [position.acceptedAt, "Protection acceptance"]] as const) requireTimestamp(value, label);
  if (Date.parse(position.startsAt) >= Date.parse(position.expiresAt)) throw new Error("Protection expiry must follow its start.");
  if (!Number.isSafeInteger(position.remainingQuantity4dp) || position.remainingQuantity4dp < 0) throw new Error("Remaining protection must be a non-negative four-decimal integer quantity.");
}
function validateCommand(command: PurchaseMatchCommand) {
  for (const [value, label] of [[command.commandId, "Command ID"], [command.idempotencyKey, "Idempotency key"], [command.allocationId, "Allocation ID"], [command.purchaseId, "Purchase ID"], [command.customerId, "Customer ID"], [command.countryCode, "Country"], [command.fuelGradeId, "Fuel grade"], [command.stationId, "Station ID"], [command.providerId, "Provider ID"], [command.geographyId, "Geography ID"], [command.actualPumpObservationId, "Actual pump observation ID"], [command.clearing.clearingId, "Clearing ID"], [command.clearing.authorizationId, "Authorization ID"], [command.clearing.walletId, "Wallet ID"], [command.clearing.organisationId, "Organisation ID"], [command.clearing.correlationId, "Correlation ID"]] as const) requireText(value, label);
  if (command.clearing.eventType !== "CARD_CLEARING_ACCEPTED" || command.clearing.source !== "CARD_SIMULATOR") throw new Error("Only accepted simulated card clearing evidence can be allocated.");
  requirePositiveQuantity(command.confirmedFuelQuantity4dp, "Confirmed fuel quantity");
  requireNonNegativeMinor(command.nonFuelAmountMinor, "Non-fuel amount");
  requireTimestamp(command.purchasedAt, "Purchase time");
}
const clonePosition = (position: ProtectionPosition): ProtectionPosition => ({ ...position, owner: { ...position.owner }, scope: { ...position.scope } });
