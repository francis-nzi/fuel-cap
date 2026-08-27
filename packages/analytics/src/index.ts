export type MetricStatus = "DRAFT" | "APPROVED" | "PUBLISHED" | "SUPERSEDED";
export type MetricDefinition = Readonly<{ metricId: string; version: number; businessName: string; meaning: string; formula: string; authoritativeSources: readonly string[]; ownerId: string; approverId: string | null; grain: string; currencyTreatment: string; freshnessMinutes: number; exclusions: readonly string[]; status: MetricStatus }>;
export type FinanceCategory = "POOL_COST_FUNDING" | "MARGIN_REVENUE" | "BUFFER_RESERVE" | "PROTECTION_CLAIM" | "HEDGE_COST" | "HEDGE_RECOVERY";
export type FinanceRecord = Readonly<{ recordId: string; organisationId: string; category: FinanceCategory; amountMinor: number; currency: "USD" | "CAD" | "GBP"; provenance: "LEDGER_ACTUAL" | "SIMULATED"; eventAt: string; processedAt: string; sourceId: string; assumptionVersion: string | null }>;
export type FinanceTotals = Readonly<{ poolCostFundingMinor: number; marginRevenueMinor: number; bufferReserveMinor: number; protectionClaimsMinor: number; hedgeCostMinor: number; hedgeRecoveryMinor: number; totalProtectionChargeMinor: number; poolResultMinor: number; netEconomicsMinor: number }>;
export type FinanceReport = Readonly<{ reportId: string; organisationId: string; currency: FinanceRecord["currency"]; periodStart: string; periodEnd: string; metricVersion: number; generatedAt: string; actual: FinanceTotals; simulated: FinanceTotals; actualSourceIds: readonly string[]; simulatedSourceIds: readonly string[]; assumptionVersions: readonly string[]; reconciliationStatus: "PASS" | "BREAK"; quality: "CURRENT" | "STALE" | "UNRECONCILED" | "INCOMPLETE"; exclusions: readonly string[] }>;

const emptyTotals = (): Record<keyof FinanceTotals, number> => ({ poolCostFundingMinor: 0, marginRevenueMinor: 0, bufferReserveMinor: 0, protectionClaimsMinor: 0, hedgeCostMinor: 0, hedgeRecoveryMinor: 0, totalProtectionChargeMinor: 0, poolResultMinor: 0, netEconomicsMinor: 0 });
const categoryKey: Readonly<Record<FinanceCategory, keyof FinanceTotals>> = { POOL_COST_FUNDING: "poolCostFundingMinor", MARGIN_REVENUE: "marginRevenueMinor", BUFFER_RESERVE: "bufferReserveMinor", PROTECTION_CLAIM: "protectionClaimsMinor", HEDGE_COST: "hedgeCostMinor", HEDGE_RECOVERY: "hedgeRecoveryMinor" };

export function approveMetric(definition: MetricDefinition, approverId: string): MetricDefinition {
  if (definition.status !== "DRAFT" || !approverId.trim() || approverId === definition.ownerId) throw new Error("Metric approval requires a different approver.");
  if (!definition.authoritativeSources.length || !definition.formula.trim() || definition.freshnessMinutes <= 0) throw new Error("Metric definition is incomplete.");
  return { ...definition, approverId, status: "APPROVED" };
}

export function publishMetric(definition: MetricDefinition): MetricDefinition {
  if (definition.status !== "APPROVED" || !definition.approverId) throw new Error("Only approved metrics can be published.");
  return { ...definition, status: "PUBLISHED" };
}

function total(records: readonly FinanceRecord[]): FinanceTotals {
  const result = emptyTotals();
  for (const record of records) result[categoryKey[record.category]] += record.amountMinor;
  result.totalProtectionChargeMinor = result.poolCostFundingMinor + result.marginRevenueMinor + result.bufferReserveMinor;
  result.poolResultMinor = result.poolCostFundingMinor + result.bufferReserveMinor + result.hedgeRecoveryMinor - result.protectionClaimsMinor - result.hedgeCostMinor;
  result.netEconomicsMinor = result.totalProtectionChargeMinor + result.hedgeRecoveryMinor - result.protectionClaimsMinor - result.hedgeCostMinor;
  return result;
}

export function createFinanceReport(input: Readonly<{ reportId: string; organisationId: string; currency: FinanceRecord["currency"]; periodStart: string; periodEnd: string; generatedAt: string; metric: MetricDefinition; records: readonly FinanceRecord[]; ledgerActualByCategory: Readonly<Partial<Record<FinanceCategory, number>>>; exclusions?: readonly string[] }>): FinanceReport {
  if (!input.reportId.trim() || !input.organisationId.trim() || input.metric.status !== "PUBLISHED") throw new Error("Report identity, scope and published metric are required.");
  const start = Date.parse(input.periodStart), end = Date.parse(input.periodEnd), generated = Date.parse(input.generatedAt);
  if (![start, end, generated].every(Number.isFinite) || end <= start) throw new Error("Valid reporting period and generation time are required.");
  if (input.records.some((record) => record.organisationId !== input.organisationId || record.currency !== input.currency)) throw new Error("Cross-tenant or cross-currency finance records are prohibited.");
  if (input.records.some((record) => !Number.isSafeInteger(record.amountMinor) || record.amountMinor < 0 || !record.sourceId.trim() || Date.parse(record.eventAt) < start || Date.parse(record.eventAt) >= end)) throw new Error("Finance records require non-negative minor units, source lineage and in-period event time.");
  const actualRecords = input.records.filter((record) => record.provenance === "LEDGER_ACTUAL");
  const simulatedRecords = input.records.filter((record) => record.provenance === "SIMULATED");
  const actual = total(actualRecords), simulated = total(simulatedRecords);
  const reconciles = (Object.keys(input.ledgerActualByCategory) as FinanceCategory[]).every((category) => actual[categoryKey[category]] === input.ledgerActualByCategory[category]);
  const latestProcessed = input.records.reduce((latest, record) => Math.max(latest, Date.parse(record.processedAt)), 0);
  const stale = generated - latestProcessed > input.metric.freshnessMinutes * 60_000;
  const incomplete = input.metric.authoritativeSources.some((source) => !actualRecords.some((record) => record.sourceId.startsWith(source)));
  const reconciliationStatus = reconciles ? "PASS" : "BREAK";
  const quality: FinanceReport["quality"] = !reconciles ? "UNRECONCILED" : incomplete ? "INCOMPLETE" : stale ? "STALE" : "CURRENT";
  return { reportId: input.reportId, organisationId: input.organisationId, currency: input.currency, periodStart: input.periodStart, periodEnd: input.periodEnd, metricVersion: input.metric.version, generatedAt: input.generatedAt, actual, simulated, actualSourceIds: actualRecords.map(({ sourceId }) => sourceId), simulatedSourceIds: simulatedRecords.map(({ sourceId }) => sourceId), assumptionVersions: [...new Set(simulatedRecords.map(({ assumptionVersion }) => assumptionVersion).filter((value): value is string => value !== null))], reconciliationStatus, quality, exclusions: [...(input.exclusions ?? [])] };
}
