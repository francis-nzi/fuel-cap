import { describe, expect, it } from "vitest";
import { acceptedExposureSnapshot, createSimulatedHedgeExecution, exposureSnapshotIsAcceptedOnly, stressProjections, texasHedgeRecommendation } from "./risk-hedging";

describe("accepted-position exposure", () => {
  it("reconciles the Texas cluster to the approved scenario", () => {
    expect(acceptedExposureSnapshot.acceptedQuantity4dp).toBe(684_000_000);
    expect(acceptedExposureSnapshot.texasConcentrationBps).toBe(3700);
    expect(acceptedExposureSnapshot.valueAtBoundaryMinor).toBe(2_394_000);
    expect(exposureSnapshotIsAcceptedOnly(acceptedExposureSnapshot)).toBe(true);
  });

  it("pins pricing, spread and rules evidence", () => {
    expect(acceptedExposureSnapshot).toMatchObject({ pricingDecisionId: "PRICE-DEC-TX-0842", spreadDecisionVersion: "spread-calm-2.30-v1", rulesVersion: "customer-rules-demo-1" });
  });
});

describe("deterministic risk stresses", () => {
  it("contains the calm state and all six approved adverse stresses", () => {
    expect(stressProjections).toHaveLength(7);
    expect(stressProjections.map(({ kind }) => kind)).toEqual(["CALM", "WITHIN_BOUNDARY_RISE", "BOUNDARY_BREACH", "VOLATILITY_SHOCK", "BASIS_DIVERGENCE", "CORRELATION_BREAKDOWN", "COUNTERPARTY_FAILURE"]);
  });

  it("reconciles claims to payoff, reserve use and residual exposure", () => {
    for (const stress of stressProjections) expect(stress.reserveUseMinor + stress.simulatedPayoffMinor).toBe(stress.expectedClaimsMinor);
  });

  it("keeps counterparty failure explicitly critical with zero payoff", () => {
    expect(stressProjections.find(({ kind }) => kind === "COUNTERPARTY_FAILURE")).toMatchObject({ outcome: "CRITICAL", simulatedPayoffMinor: 0 });
  });
});

describe("simulated hedge governance", () => {
  it("pins the approved 25,000 gallon recommendation to its exposure snapshot", () => {
    expect(texasHedgeRecommendation).toMatchObject({ exposureSnapshotId: acceptedExposureSnapshot.snapshotId, quantity4dp: 250_000_000, executionBoundary: "SIMULATION_ONLY", poolCoverageAfter100dp: 230 });
  });

  it("creates only a labelled simulated execution for different principals", () => {
    expect(createSimulatedHedgeExecution(texasHedgeRecommendation, "principal-rt-maker", "principal-rt-checker")).toMatchObject({ executionType: "SIMULATED", quantity4dp: 250_000_000 });
  });

  it("denies self-approval", () => {
    expect(() => createSimulatedHedgeExecution(texasHedgeRecommendation, "principal-risk", "principal-risk")).toThrow("Self-approval");
  });
});
