import { describe, expect, it } from "vitest";
import { investorDemoSteps, validateInvestorDemoPlan } from "./investor-demo";

describe("investor demonstration plan", () => {
  it("fits a complete six-act story into fifteen minutes", () => expect(validateInvestorDemoPlan()).toEqual({ version: "investor-demo@1.0.0", stepCount: 6, totalMinutes: 13, resetRequired: true, liveActivationAuthorised: false }));
  it("pins every act to a deterministic context and evidence cue", () => expect(investorDemoSteps.every((step) => step.scenarioKey && step.principalId && step.organisationId && step.evidence)).toBe(true));
  it("closes on release assurance and the live activation boundary", () => { expect(investorDemoSteps.at(-1)).toMatchObject({ stepId: "release-assurance", initialSelection: "release" }); expect(investorDemoSteps.at(-1)?.cue).toContain("live partners"); });
});
