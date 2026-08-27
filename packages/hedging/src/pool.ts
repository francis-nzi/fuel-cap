import type { ExposureCurrency, ExposureSnapshot } from "./index";

export type PoolMovementCategory = "COST_FUNDING" | "BUFFER_CONTRIBUTION" | "CLAIM_UTILISATION" | "HEDGE_PREMIUM" | "HEDGE_RECOVERY" | "APPROVED_TRANSFER_IN" | "APPROVED_TRANSFER_OUT";
export type PoolMovement = Readonly<{ movementId: string; organisationId: string; legalEntityId: string; currency: ExposureCurrency; category: PoolMovementCategory; amountMinor: number; occurredAt: string; sourceId: string; ledgerJournalId: string; simulated: boolean }>;
export type PoolRollForward = Readonly<{ rollForwardId: string; organisationId: string; legalEntityId: string; currency: ExposureCurrency; periodStart: string; periodEnd: string; openingBalanceMinor: number; costFundingMinor: number; bufferContributionMinor: number; hedgeRecoveryMinor: number; approvedTransferInMinor: number; claimUtilisationMinor: number; hedgePremiumMinor: number; approvedTransferOutMinor: number; closingBalanceMinor: number; movementIds: readonly string[]; journalIds: readonly string[]; reconciliationStatus: "PASS" | "BREAK"; differenceMinor: number; marginIncludedMinor: 0; customerMoneyIncludedMinor: 0 }>;
export type PoolScenario = Readonly<{ scenarioId: string; version: number; name: string; state: "DRAFT" | "APPROVED" | "PUBLISHED"; makerId: string; checkerId: string | null; assumptionVersion: string; costFundingChangeBps: number; bufferChangeBps: number; claimChangeBps: number; hedgeRecoveryChangeBps: number; transferInMinor: number; transferOutMinor: number; effectiveFrom: string }>;
export type PoolScenarioProjection = Readonly<{ scenarioId: string; scenarioVersion: number; rollForwardId: string; exposureSnapshotId: string; projectedCostFundingMinor: number; projectedBufferMinor: number; projectedClaimsMinor: number; projectedHedgeRecoveryMinor: number; projectedClosingBalanceMinor: number; expectedClaimsMinor: number; coverageBps: number; status: "ADEQUATE" | "WATCH" | "CRITICAL"; simulated: true }>;

const inflows = new Set<PoolMovementCategory>(["COST_FUNDING", "BUFFER_CONTRIBUTION", "HEDGE_RECOVERY", "APPROVED_TRANSFER_IN"]);
const totalFor = (movements: readonly PoolMovement[], category: PoolMovementCategory) => movements.filter((movement) => movement.category === category).reduce((sum, movement) => sum + movement.amountMinor, 0);

export function createPoolRollForward(input: Readonly<{ rollForwardId: string; organisationId: string; legalEntityId: string; currency: ExposureCurrency; periodStart: string; periodEnd: string; openingBalanceMinor: number; movements: readonly PoolMovement[]; ledgerClosingBalanceMinor: number }>): PoolRollForward {
  const start = Date.parse(input.periodStart), end = Date.parse(input.periodEnd);
  if (!input.rollForwardId.trim() || !Number.isFinite(start) || !Number.isFinite(end) || end <= start || !Number.isSafeInteger(input.openingBalanceMinor) || input.openingBalanceMinor < 0 || !Number.isSafeInteger(input.ledgerClosingBalanceMinor)) throw new Error("Pool identity, period and balances are required.");
  if (input.movements.some((movement) => movement.organisationId !== input.organisationId || movement.legalEntityId !== input.legalEntityId || movement.currency !== input.currency)) throw new Error("Cross-tenant, entity or currency pool aggregation is prohibited.");
  if (input.movements.some((movement) => !Number.isSafeInteger(movement.amountMinor) || movement.amountMinor <= 0 || !movement.sourceId.trim() || !movement.ledgerJournalId.trim() || Date.parse(movement.occurredAt) < start || Date.parse(movement.occurredAt) >= end)) throw new Error("Pool movements require positive minor units, ledger lineage and in-period event time.");
  if (new Set(input.movements.map(({ movementId }) => movementId)).size !== input.movements.length) throw new Error("Pool movement identities must be unique.");
  const costFundingMinor = totalFor(input.movements, "COST_FUNDING"), bufferContributionMinor = totalFor(input.movements, "BUFFER_CONTRIBUTION"), hedgeRecoveryMinor = totalFor(input.movements, "HEDGE_RECOVERY"), approvedTransferInMinor = totalFor(input.movements, "APPROVED_TRANSFER_IN"), claimUtilisationMinor = totalFor(input.movements, "CLAIM_UTILISATION"), hedgePremiumMinor = totalFor(input.movements, "HEDGE_PREMIUM"), approvedTransferOutMinor = totalFor(input.movements, "APPROVED_TRANSFER_OUT");
  const closingBalanceMinor = input.openingBalanceMinor + input.movements.reduce((sum, movement) => sum + (inflows.has(movement.category) ? movement.amountMinor : -movement.amountMinor), 0);
  if (closingBalanceMinor < 0) throw new Error("Pool cannot be projected below zero without a blocking capital action.");
  const differenceMinor = closingBalanceMinor - input.ledgerClosingBalanceMinor;
  return { rollForwardId: input.rollForwardId, organisationId: input.organisationId, legalEntityId: input.legalEntityId, currency: input.currency, periodStart: input.periodStart, periodEnd: input.periodEnd, openingBalanceMinor: input.openingBalanceMinor, costFundingMinor, bufferContributionMinor, hedgeRecoveryMinor, approvedTransferInMinor, claimUtilisationMinor, hedgePremiumMinor, approvedTransferOutMinor, closingBalanceMinor, movementIds: input.movements.map(({ movementId }) => movementId), journalIds: [...new Set(input.movements.map(({ ledgerJournalId }) => ledgerJournalId))], reconciliationStatus: differenceMinor === 0 ? "PASS" : "BREAK", differenceMinor, marginIncludedMinor: 0, customerMoneyIncludedMinor: 0 };
}

export function rejectIneligiblePoolSource(source: "CUSTOMER_AVAILABLE" | "CUSTOMER_RESERVED" | "CUSTOMER_REFUND_PAYABLE" | "MARGIN_REVENUE"): never {
  throw new Error(`${source} cannot be classified as reserve or risk-pool capacity.`);
}

export function approvePoolScenario(scenario: PoolScenario, checkerId: string): PoolScenario {
  if (scenario.state !== "DRAFT" || !checkerId.trim() || checkerId === scenario.makerId) throw new Error("Pool scenario approval requires a different checker.");
  return { ...scenario, checkerId, state: "APPROVED" };
}

export function publishPoolScenario(scenario: PoolScenario): PoolScenario {
  if (scenario.state !== "APPROVED" || !scenario.checkerId || !Number.isFinite(Date.parse(scenario.effectiveFrom))) throw new Error("Only an approved effective pool scenario can be published.");
  return { ...scenario, state: "PUBLISHED" };
}

export function projectPoolScenario(rollForward: PoolRollForward, snapshot: ExposureSnapshot, scenario: PoolScenario, limits: Readonly<{ minimumCoverageBps: number; warningCoverageBps: number }>): PoolScenarioProjection {
  if (scenario.state !== "PUBLISHED" || rollForward.reconciliationStatus !== "PASS" || snapshot.reconciliationStatus !== "PASS" || rollForward.organisationId !== snapshot.organisationId || rollForward.legalEntityId !== snapshot.legalEntityId || rollForward.currency !== snapshot.currency) throw new Error("Published scenario and reconciled tenant-matched pool/exposure are required.");
  if ([scenario.costFundingChangeBps, scenario.bufferChangeBps, scenario.claimChangeBps, scenario.hedgeRecoveryChangeBps].some((value) => !Number.isSafeInteger(value) || value < -10_000 || value > 20_000) || [scenario.transferInMinor, scenario.transferOutMinor, limits.minimumCoverageBps, limits.warningCoverageBps].some((value) => !Number.isSafeInteger(value) || value < 0)) throw new Error("Scenario and limit assumptions are invalid.");
  const adjusted = (amount: number, changeBps: number) => Math.round(amount * (10_000 + changeBps) / 10_000);
  const projectedCostFundingMinor = adjusted(rollForward.costFundingMinor, scenario.costFundingChangeBps), projectedBufferMinor = adjusted(rollForward.bufferContributionMinor, scenario.bufferChangeBps), projectedClaimsMinor = adjusted(rollForward.claimUtilisationMinor, scenario.claimChangeBps), projectedHedgeRecoveryMinor = adjusted(rollForward.hedgeRecoveryMinor, scenario.hedgeRecoveryChangeBps);
  const projectedClosingBalanceMinor = rollForward.openingBalanceMinor + projectedCostFundingMinor + projectedBufferMinor + projectedHedgeRecoveryMinor + rollForward.approvedTransferInMinor + scenario.transferInMinor - projectedClaimsMinor - rollForward.hedgePremiumMinor - rollForward.approvedTransferOutMinor - scenario.transferOutMinor;
  const expectedClaimsMinor = Math.max(snapshot.expectedClaimsMinor, projectedClaimsMinor);
  const coverageBps = expectedClaimsMinor === 0 ? 10_000 : Math.round(Math.max(0, projectedClosingBalanceMinor) * 10_000 / expectedClaimsMinor);
  const status = projectedClosingBalanceMinor < 0 || coverageBps < limits.minimumCoverageBps ? "CRITICAL" : coverageBps < limits.warningCoverageBps ? "WATCH" : "ADEQUATE";
  return { scenarioId: scenario.scenarioId, scenarioVersion: scenario.version, rollForwardId: rollForward.rollForwardId, exposureSnapshotId: snapshot.snapshotId, projectedCostFundingMinor, projectedBufferMinor, projectedClaimsMinor, projectedHedgeRecoveryMinor, projectedClosingBalanceMinor, expectedClaimsMinor, coverageBps, status, simulated: true };
}
