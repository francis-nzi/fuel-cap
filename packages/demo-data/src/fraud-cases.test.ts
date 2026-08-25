import { describe, expect, it } from "vitest";
import { approveMaterialRestriction, explicitHold, fairnessSnapshot, ontarioCase } from "./fraud-cases";
describe("fraud and cases", () => {
  it("reconciles Scenario 8 customer value", () => expect(ontarioCase).toMatchObject({ reviewCount: 18, heldFromRollover4dp: 48_600_000, retainedCustomerValueMinor: 692_000, status: "HUMAN_REVIEW" }));
  it("keeps eligibility distinct from availability", () => { expect(ontarioCase.reasonClass).toBe("ELIGIBILITY"); expect(ontarioCase.availabilityFailure).toBe(false); });
  it("uses typed versioned signals", () => expect(ontarioCase.signals.every(({ modelVersion, reasonCode }) => modelVersion && reasonCode)).toBe(true));
  it("preserves customer balance with a scoped expiring hold", () => expect(explicitHold).toMatchObject({ capability: "AUTO_ROLLOVER", customerBalanceErased: false, amountMinor: 0 }));
  it("records fairness and prohibits protected attributes", () => expect(fairnessSnapshot).toMatchObject({ protectedAttributesUsed: false, proxyTestStatus: "PASS" }));
  it("requires different CF principals, evidence and proportionality", () => { expect(approveMaterialRestriction("cf-maker", "cf-checker", ["SIG-VELOCITY-018"], true).status).toBe("APPROVED"); expect(() => approveMaterialRestriction("cf", "cf", ["signal"], true)).toThrow("Self-approval"); expect(() => approveMaterialRestriction("maker", "checker", [], true)).toThrow("evidence"); expect(() => approveMaterialRestriction("maker", "checker", ["signal"], false)).toThrow("Disproportionate"); });
});
