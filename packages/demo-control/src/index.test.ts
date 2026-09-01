import { describe, expect, it } from "vitest";
import { applyDemoControlCommand, initialDemoControlSnapshot, validateDemoControlSnapshot, type DemoControlSnapshot } from "./index";

const command = (name: "RESET_BASELINE" | "PUBLISH_PRICE_RISE" | "WITHDRAW_NEW_QUOTES", sequence: number) => ({ command: name, actorId: "principal-presenter", role: "DP", idempotencyKey: `EVENT-${sequence}`, occurredAt: `2026-09-01T12:0${sequence}:00.000Z` });

describe("demo control bridge", () => {
  it("publishes an allow-listed price rise with immutable evidence", () => { const next = applyDemoControlCommand(initialDemoControlSnapshot, command("PUBLISH_PRICE_RISE", 1)); expect(next).toMatchObject({ state: "PRICE_RISE_PUBLISHED", displayUnitPrice: 3.67, quoteAvailability: "AVAILABLE", sequence: 1, simulationOnly: true, liveActivationAuthorised: false }); expect(validateDemoControlSnapshot(next)).toBe(next); });
  it("withdraws new quotes while preserving an already accepted quote", () => { const rise = applyDemoControlCommand(initialDemoControlSnapshot, command("PUBLISH_PRICE_RISE", 1)); const withdrawn = applyDemoControlCommand(rise, command("WITHDRAW_NEW_QUOTES", 2)); expect(withdrawn.quoteAvailability).toBe("PAUSED"); expect(withdrawn.acceptedQuote).toEqual(initialDemoControlSnapshot.acceptedQuote); });
  it("is replay safe", () => { const next = applyDemoControlCommand(initialDemoControlSnapshot, command("PUBLISH_PRICE_RISE", 1)); expect(applyDemoControlCommand(next, command("PUBLISH_PRICE_RISE", 1))).toBe(next); });
  it("rejects unauthorised roles and live authority", () => { expect(() => applyDemoControlCommand(initialDemoControlSnapshot, { ...command("PUBLISH_PRICE_RISE", 1), role: "CS" })).toThrow("PRESENTER_OR_RISK"); expect(() => validateDemoControlSnapshot({ ...initialDemoControlSnapshot, liveActivationAuthorised: true } as unknown as DemoControlSnapshot)).toThrow("LIVE_ACTIVATION_PROHIBITED"); });
});
