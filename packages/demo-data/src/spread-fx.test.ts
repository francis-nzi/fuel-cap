import { describe, expect, it } from "vitest";
import {
  activeSpreadDecision,
  directCanonicalFxRate,
  fxObservationValidity,
  fxReferenceObservations,
  pinnedMultiMarketQuote,
  proposeSpreadComponents,
  spreadComponentTotal,
  triangulatedCanonicalFxRate,
  validateSpreadDraft,
} from "./spread-fx";

describe("governed spread decisions", () => {
  it("reconciles the initial editable components to the agreed gross spread", () => {
    expect(spreadComponentTotal(activeSpreadDecision.components)).toBe(230);
    expect(activeSpreadDecision.grossSpreadBps).toBe(230);
  });

  it("accepts a reasoned component reallocation that preserves 2.30%", () => {
    const draft = proposeSpreadComponents(
      activeSpreadDecision,
      { protectionCostBps: 140, fuelCapMarginBps: 60, reserveBufferBps: 30 },
      "Reflect higher modelled protection cost while preserving the governed gross spread.",
      "principal-rt-maker",
    );
    expect(validateSpreadDraft(draft)).toEqual({ valid: true, componentTotalBps: 230, errors: [] });
    expect(activeSpreadDecision.components).toEqual({ protectionCostBps: 130, fuelCapMarginBps: 70, reserveBufferBps: 30 });
  });

  it("blocks a draft whose editable components do not reconcile", () => {
    const draft = proposeSpreadComponents(
      activeSpreadDecision,
      { protectionCostBps: 140, fuelCapMarginBps: 70, reserveBufferBps: 30 },
      "Test invalid allocation.",
      "principal-rt-maker",
    );
    const result = validateSpreadDraft(draft);
    expect(result.valid).toBe(false);
    expect(result.componentTotalBps).toBe(240);
    expect(result.errors[0]).toContain("must equal governed gross spread 230 bps");
  });

  it("does not permit editing the published decision in place", () => {
    const result = validateSpreadDraft(activeSpreadDecision);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Only a draft decision may be edited.");
  });
});

describe("canonical FX evidence", () => {
  it("preserves explicit direction for a direct fixed Scenario 11 rate", () => {
    const rate = directCanonicalFxRate("USD/CAD");
    expect(rate).toMatchObject({ pair: "USD/CAD", baseCurrency: "USD", quoteCurrency: "CAD", rate6dp: 1371200, method: "DIRECT" });
  });

  it("triangulates GBP/CAD through the approved USD pivot and records both legs", () => {
    const rate = triangulatedCanonicalFxRate("GBP/USD", "USD/CAD", "GBP/CAD", "USD");
    expect(rate).toMatchObject({ pair: "GBP/CAD", rate6dp: 1763912, method: "TRIANGULATED", pivotCurrency: "USD" });
    expect(rate?.observationIds).toEqual(["FX-OBS-GBPUSD-1400", "FX-OBS-USDCAD-1400"]);
  });

  it("refuses an invalid or silently inverted triangulation path", () => {
    expect(triangulatedCanonicalFxRate("USD/CAD", "GBP/USD", "CAD/GBP", "USD")).toBeNull();
  });

  it("marks fixed evidence stale outside its governed freshness window", () => {
    const source = fxReferenceObservations[0];
    expect(fxObservationValidity(source, "2026-08-22T14:04:59.000Z")).toBe("VALID");
    expect(fxObservationValidity(source, "2026-08-22T14:05:01.000Z")).toBe("STALE");
  });

  it("pins the quote to immutable spread, FX and rules versions", () => {
    expect(pinnedMultiMarketQuote).toMatchObject({
      spreadDecisionVersion: "spread-calm-2.30-v1",
      canonicalFxRateId: "FX-RATE-GBPCAD-TRIANGULATED",
      fxAdjustmentDecisionVersion: "fx-adjustment-global@1.0",
      rulesVersion: "customer-rules-demo-1",
    });
  });
});
