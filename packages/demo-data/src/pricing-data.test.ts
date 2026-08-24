import { describe, expect, it } from "vitest";
import { canonicalPricingDecision, observationSupports, pricingDecisionIsInternallyValid, selectedPricingObservation } from "./pricing-data";

describe("canonical pricing decision", () => {
  it("selects an actual pump observation for quote and settlement", () => {
    const selected = selectedPricingObservation(canonicalPricingDecision);
    expect(selected?.observationType).toBe("ACTUAL_PUMP");
    expect(observationSupports(selected!, "QUOTE")).toBe(true);
    expect(observationSupports(selected!, "SETTLE")).toBe(true);
    expect(pricingDecisionIsInternallyValid(canonicalPricingDecision)).toBe(true);
  });

  it("never treats benchmark-only evidence as settlement eligible", () => {
    const benchmark = canonicalPricingDecision.observations.find(({ observationType }) => observationType === "REFERENCE")!;
    expect(observationSupports(benchmark, "SETTLE")).toBe(false);
    expect(benchmark.decision).toBe("CORROBORATING");
  });

  it("restricts simulated observations to simulation", () => {
    const simulated = canonicalPricingDecision.observations.find(({ observationType }) => observationType === "SIMULATED_PUMP")!;
    expect(simulated.permittedUses).toEqual(["SIMULATE"]);
    expect(simulated.decision).toBe("EXCLUDED");
  });

  it("preserves conflicting candidates and their rejection reasons", () => {
    const rejected = canonicalPricingDecision.observations.filter(({ decision }) => decision === "REJECTED");
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toContain("tolerance");
  });
});
