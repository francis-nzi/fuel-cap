export type StressKind = "CALM" | "WITHIN_BOUNDARY_RISE" | "BOUNDARY_BREACH" | "VOLATILITY_SHOCK" | "BASIS_DIVERGENCE" | "CORRELATION_BREAKDOWN" | "COUNTERPARTY_FAILURE";

export type AcceptedExposureSnapshot = Readonly<{
  snapshotId: string;
  version: "exposure-snapshot@1.0";
  scenarioId: "exposure-ai-recommendation";
  organisationId: "fuelcap-global";
  market: "US-TX";
  asOf: string;
  acceptedQuantity4dp: number;
  texasConcentrationBps: number;
  valueAtBoundaryMinor: number;
  expectedClaimsMinor: number;
  reserveAvailableMinor: number;
  poolCoverageBefore100dp: number;
  positionIds: readonly string[];
  pricingDecisionId: string;
  spreadDecisionVersion: string;
  rulesVersion: string;
  provenance: "illustrative-fixed";
}>;

export const acceptedExposureSnapshot: AcceptedExposureSnapshot = {
  snapshotId: "EXP-TX-20260821-1645",
  version: "exposure-snapshot@1.0",
  scenarioId: "exposure-ai-recommendation",
  organisationId: "fuelcap-global",
  market: "US-TX",
  asOf: "2026-08-21T16:45:00.000Z",
  acceptedQuantity4dp: 684_000_000,
  texasConcentrationBps: 3700,
  valueAtBoundaryMinor: 2_394_000,
  expectedClaimsMinor: 1_408_800,
  reserveAvailableMinor: 2_394_960,
  poolCoverageBefore100dp: 170,
  positionIds: ["POS-TX-FLEET-001", "POS-TX-FLEET-002", "POS-TX-CONSUMER-041"],
  pricingDecisionId: "PRICE-DEC-TX-0842",
  spreadDecisionVersion: "spread-calm-2.30-v1",
  rulesVersion: "customer-rules-demo-1",
  provenance: "illustrative-fixed",
};

export type StressProjection = Readonly<{
  stressId: string;
  kind: StressKind;
  label: string;
  volatilityBps: number;
  basisShockBps: number;
  expectedClaimsMinor: number;
  simulatedPayoffMinor: number;
  reserveUseMinor: number;
  residualExposureMinor: number;
  poolCoverageAfter100dp: number;
  outcome: "CONTROLLED" | "WATCH" | "CRITICAL";
}>;

export const stressProjections: readonly StressProjection[] = [
  { stressId: "STRESS-CALM", kind: "CALM", label: "Calm state", volatilityBps: 1800, basisShockBps: 0, expectedClaimsMinor: 1_408_800, simulatedPayoffMinor: 0, reserveUseMinor: 1_408_800, residualExposureMinor: 0, poolCoverageAfter100dp: 170, outcome: "CONTROLLED" },
  { stressId: "STRESS-RISE", kind: "WITHIN_BOUNDARY_RISE", label: "Within-boundary rise", volatilityBps: 2200, basisShockBps: 0, expectedClaimsMinor: 1_710_000, simulatedPayoffMinor: 412_500, reserveUseMinor: 1_297_500, residualExposureMinor: 0, poolCoverageAfter100dp: 184, outcome: "CONTROLLED" },
  { stressId: "STRESS-BREACH", kind: "BOUNDARY_BREACH", label: "Maximum-boundary breach", volatilityBps: 2800, basisShockBps: 0, expectedClaimsMinor: 2_394_000, simulatedPayoffMinor: 737_500, reserveUseMinor: 1_656_500, residualExposureMinor: 0, poolCoverageAfter100dp: 145, outcome: "WATCH" },
  { stressId: "STRESS-VOL", kind: "VOLATILITY_SHOCK", label: "Volatility shock", volatilityBps: 4200, basisShockBps: 0, expectedClaimsMinor: 2_257_200, simulatedPayoffMinor: 650_000, reserveUseMinor: 1_607_200, residualExposureMinor: 0, poolCoverageAfter100dp: 149, outcome: "WATCH" },
  { stressId: "STRESS-BASIS", kind: "BASIS_DIVERGENCE", label: "Retail / wholesale basis divergence", volatilityBps: 2600, basisShockBps: 175, expectedClaimsMinor: 2_052_000, simulatedPayoffMinor: 487_500, reserveUseMinor: 1_564_500, residualExposureMinor: 171_000, poolCoverageAfter100dp: 142, outcome: "WATCH" },
  { stressId: "STRESS-CORR", kind: "CORRELATION_BREAKDOWN", label: "Correlation breakdown", volatilityBps: 3300, basisShockBps: 240, expectedClaimsMinor: 2_188_800, simulatedPayoffMinor: 310_000, reserveUseMinor: 1_878_800, residualExposureMinor: 342_000, poolCoverageAfter100dp: 127, outcome: "CRITICAL" },
  { stressId: "STRESS-CP", kind: "COUNTERPARTY_FAILURE", label: "Simulated counterparty failure", volatilityBps: 2800, basisShockBps: 0, expectedClaimsMinor: 2_394_000, simulatedPayoffMinor: 0, reserveUseMinor: 2_394_000, residualExposureMinor: 737_500, poolCoverageAfter100dp: 100, outcome: "CRITICAL" },
];

export type HedgeRecommendation = Readonly<{
  recommendationId: string;
  version: "hedge-recommendation@1.0";
  exposureSnapshotId: string;
  modelVersion: "black-76-demo@1.0";
  proposedInstrument: "SIMULATED_CALL_SPREAD";
  quantity4dp: number;
  strikeBpsAboveReference: number;
  expiry: string;
  estimatedPremiumMinor: number;
  simulatedCounterparty: string;
  expectedPayoffMinor: number;
  poolCoverageBefore100dp: number;
  poolCoverageAfter100dp: number;
  residualExposureMinor: number;
  confidenceBps: number;
  evidenceIds: readonly string[];
  executionBoundary: "SIMULATION_ONLY";
}>;

export const texasHedgeRecommendation: HedgeRecommendation = {
  recommendationId: "HEDGE-REC-TX-25000",
  version: "hedge-recommendation@1.0",
  exposureSnapshotId: acceptedExposureSnapshot.snapshotId,
  modelVersion: "black-76-demo@1.0",
  proposedInstrument: "SIMULATED_CALL_SPREAD",
  quantity4dp: 250_000_000,
  strikeBpsAboveReference: 500,
  expiry: "2026-08-28T23:59:59.000Z",
  estimatedPremiumMinor: 325_000,
  simulatedCounterparty: "Demo Energy Markets Ltd · simulated",
  expectedPayoffMinor: 737_500,
  poolCoverageBefore100dp: 170,
  poolCoverageAfter100dp: 230,
  residualExposureMinor: 171_000,
  confidenceBps: 9100,
  evidenceIds: [acceptedExposureSnapshot.snapshotId, "STRESS-BREACH", "MODEL-B76-INPUTS-0821"],
  executionBoundary: "SIMULATION_ONLY",
};

export type SimulatedHedgeExecution = Readonly<{
  executionId: string;
  executionType: "SIMULATED";
  recommendationId: string;
  initiatedBy: string;
  approvedBy: string;
  createdAt: string;
  quantity4dp: number;
  auditId: string;
}>;

export function createSimulatedHedgeExecution(recommendation: HedgeRecommendation, initiatedBy: string, approvedBy: string): SimulatedHedgeExecution {
  if (initiatedBy === approvedBy) throw new Error("Self-approval is prohibited for simulated hedge execution.");
  if (recommendation.executionBoundary !== "SIMULATION_ONLY") throw new Error("Live hedge execution is outside the Phase 1 boundary.");
  return { executionId: "HEDGE-SIM-TX-25000", executionType: "SIMULATED", recommendationId: recommendation.recommendationId, initiatedBy, approvedBy, createdAt: "2026-08-21T16:48:00.000Z", quantity4dp: recommendation.quantity4dp, auditId: "AUD-HEDGE-TX-25000" };
}

export function exposureSnapshotIsAcceptedOnly(snapshot: AcceptedExposureSnapshot) {
  return snapshot.positionIds.length > 0 && snapshot.positionIds.every((id) => id.startsWith("POS-"));
}
