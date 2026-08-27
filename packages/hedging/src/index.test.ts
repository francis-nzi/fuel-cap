import { describe, expect, it } from "vitest";
import { assessExposureLimits, createExposureSnapshot, runApprovedStressSuite, runExposureStress, type AcceptedPosition, type StressAssumption } from "./index";

const position = (overrides: Partial<AcceptedPosition> = {}): AcceptedPosition => ({ positionId: "POS-1", organisationId: "ORG-1", legalEntityId: "LE-US", status: "ACCEPTED", remainingQuantity4dp: 684_000_000, market: "US-TX", grade: "REGULAR", geography: "TX", currency: "USD", strikePrice4dp: 36_750, boundaryPrice4dp: 40_250, expiry: "2026-09-01T00:00:00Z", customerId: "CUS-1", fleetId: "FLEET-TX", basisRiskCategory: "RETAIL_WHOLESALE", expectedClaimMinor: 1_408_800, priceDecisionVersion: "price@1", spreadDecisionVersion: "spread@1", fxDecisionVersion: "fx@1", rulesVersion: "rules@1", ...overrides });
const snapshot = () => createExposureSnapshot({ snapshotId: "EXP-1", organisationId: "ORG-1", legalEntityId: "LE-US", currency: "USD", asOf: "2026-08-27T00:00:00Z", reserveAvailableMinor: 2_394_960, reconciliationStatus: "PASS", positions: [position()] });
const kinds = ["CALM", "WITHIN_BOUNDARY_RISE", "BOUNDARY_BREACH", "VOLATILITY_SHOCK", "BASIS_DIVERGENCE", "CORRELATION_BREAKDOWN", "COUNTERPARTY_FAILURE"] as const;
const assumptions: readonly StressAssumption[] = kinds.map((kind, index) => ({ stressId: `STRESS-${index}`, kind, modelVersion: "stress-model@1", assumptionVersion: "stress-assumptions@1", claimBpsOfBoundaryValue: kind === "CALM" ? 5885 : 10_000, payoffBpsOfBoundaryValue: kind === "COUNTERPARTY_FAILURE" ? 3081 : 3000, basisResidualBpsOfBoundaryValue: kind === "BASIS_DIVERGENCE" || kind === "CORRELATION_BREAKDOWN" ? 714 : 0 }));

describe("accepted-position exposure snapshots", () => {
  it("reconciles the canonical Texas quantity and boundary value", () => expect(snapshot()).toMatchObject({ acceptedQuantity4dp: 684_000_000, valueAtBoundaryMinor: 2_394_000, expectedClaimsMinor: 1_408_800, simulated: true }));
  it("rejects quote demand and closed positions", () => { expect(() => createExposureSnapshot({ snapshotId: "E", organisationId: "ORG-1", legalEntityId: "LE-US", currency: "USD", asOf: "2026-08-27", reserveAvailableMinor: 0, reconciliationStatus: "PASS", positions: [position({ status: "QUOTED" })] })).toThrow(/only accepted/); expect(() => createExposureSnapshot({ snapshotId: "E", organisationId: "ORG-1", legalEntityId: "LE-US", currency: "USD", asOf: "2026-08-27", reserveAvailableMinor: 0, reconciliationStatus: "PASS", positions: [position({ status: "CLOSED" })] })).toThrow(/only accepted/); });
  it("rejects cross-tenant, legal-entity and currency aggregation", () => { for (const changed of [position({ organisationId: "ORG-2" }), position({ legalEntityId: "LE-CA" }), position({ currency: "CAD" })]) expect(() => createExposureSnapshot({ snapshotId: "E", organisationId: "ORG-1", legalEntityId: "LE-US", currency: "USD", asOf: "2026-08-27", reserveAvailableMinor: 0, reconciliationStatus: "PASS", positions: [changed] })).toThrow(/Cross-tenant/); });
  it("preserves all mandated exposure dimensions and evidence versions", () => expect(snapshot()).toMatchObject({ marketGrade: [{ key: "US-TX:REGULAR", concentrationBps: 10000 }], geography: [{ key: "TX" }], expiryBucket: [{ key: "0-7D" }], customerFleet: [{ key: "FLEET-TX" }], basisRisk: [{ key: "RETAIL_WHOLESALE" }], evidenceVersions: ["price@1", "spread@1", "fx@1", "rules@1"] }));
});

describe("governed exposure limits", () => {
  const limits = { limitVersion: "limits@1", maxQuantity4dp: 1_000_000_000, maxValueAtBoundaryMinor: 3_000_000, maxConcentrationBps: 10_000, minimumReserveCoverageBps: 10_000, warningUtilisationBps: 7500 } as const;
  it("marks approaching boundary value as warning", () => expect(assessExposureLimits(snapshot(), limits)).toMatchObject({ status: "WARNING", blocksDownstream: false, valueUtilisationBps: 7980 }));
  it("blocks breached concentration or reserve limits", () => expect(assessExposureLimits(snapshot(), { ...limits, maxConcentrationBps: 3700 })).toMatchObject({ status: "CRITICAL", blocksDownstream: true, reasonCodes: ["CONCENTRATION_LIMIT_EXCEEDED"] }));
  it("makes reconciliation breaks unconditionally critical", () => expect(assessExposureLimits({ ...snapshot(), reconciliationStatus: "BREAK" }, limits)).toMatchObject({ status: "CRITICAL", reasonCodes: ["RECONCILIATION_BREAK"], blocksDownstream: true }));
});

describe("deterministic exposure stress tests", () => {
  it("requires calm and all six adverse stresses exactly once", () => { expect(runApprovedStressSuite(snapshot(), assumptions)).toHaveLength(7); expect(() => runApprovedStressSuite(snapshot(), assumptions.slice(0, 6))).toThrow(/all six/); });
  it("pins model and assumption versions to every result", () => expect(runApprovedStressSuite(snapshot(), assumptions).every((result) => result.modelVersion === "stress-model@1" && result.assumptionVersion === "stress-assumptions@1")).toBe(true));
  it("models counterparty failure with zero simulated payoff", () => expect(runApprovedStressSuite(snapshot(), assumptions).find(({ kind }) => kind === "COUNTERPARTY_FAILURE")).toMatchObject({ simulatedPayoffMinor: 0, outcome: "CRITICAL", simulated: true }));
  it("surfaces basis divergence as explicit residual exposure", () => expect(runApprovedStressSuite(snapshot(), assumptions).find(({ kind }) => kind === "BASIS_DIVERGENCE")!.residualExposureMinor).toBeGreaterThan(0));
  it("rejects unbounded stress inputs", () => expect(() => runExposureStress(snapshot(), { ...assumptions[0]!, claimBpsOfBoundaryValue: 20_001 })).toThrow(/bounded/));
});
