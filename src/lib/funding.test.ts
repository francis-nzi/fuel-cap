import { describe, expect, it } from "vitest";
import { servicePlans } from "@fuelcap/demo-data/customer-lifecycle";
import { balanceOf, maxDeposit, monthlyFuelLimit, payFromBalance, planFor, planProtection, roundVolumeDown, withRunningBalance } from "./funding";
import { cents, quoteProtection, round4, settleFill } from "./protection";

const basic = planFor("BASIC");

describe("REQ-003 worked example (UK, Basic, reference £1.58/L, usual 40 L/week)", () => {
  it("prices 40 L for 7 days at 350 bps", () => {
    const quote = quoteProtection(1.58, 40, undefined, 0.035);
    expect(quote.strike).toBe(1.659);
    expect(quote.chargePerUnit).toBe(0.0553);
    expect(cents(quote.held)).toBe(66.36);
    expect(cents(quote.charge)).toBe(2.21);
  });

  it("runs deposit → charge → fill with a running balance that matches", () => {
    const quote = quoteProtection(1.58, 40, undefined, 0.035);
    const deposit = 100;
    const afterCharge = cents(deposit - cents(quote.charge));
    expect(afterCharge).toBe(97.79);
    expect(cents(afterCharge - cents(quote.held))).toBe(31.43);

    const fill = settleFill(20, 1.7, quote.strike, quote.boundary);
    expect(fill.outcome).toBe("rise");
    expect(fill.coveredByFuelCap).toBe(0.82);
    const paid = payFromBalance(fill, 31.43);
    expect(paid.fromBalance).toBe(33.18);
    expect(paid.byCard).toBe(0);
    expect(cents(round4(quote.held - fill.heldReleased))).toBe(33.18);

    const rows = withRunningBalance([
      { id: "a", amount: 100, createdAt: "2026-10-30T09:00:00Z", seq: 1 },
      { id: "b", amount: 0, createdAt: "2026-10-30T09:00:00Z", seq: 2 },
      { id: "c", amount: -2.21, createdAt: "2026-10-30T09:00:00Z", seq: 3 },
      { id: "d", amount: -paid.fromBalance, createdAt: "2026-10-30T10:00:00Z", seq: 4 },
    ]);
    expect(rows.map((row) => [row.id, row.balanceAfter])).toEqual([["d", 64.61], ["c", 97.79], ["b", 100], ["a", 100]]);
    expect(rows[0].balanceAfter).toBe(balanceOf(rows));
  });

  it("caps the automatic amount at Basic's monthly fuel limit pro-rated to the window (150 L × 7/30 = 35 L)", () => {
    const plan = planProtection({ reference: 1.58, usualWeekly: 40, plan: basic, unit: "L", free: 100 });
    expect(plan.wanted).toBe(35);
    expect(plan.volume).toBe(35);
    expect(plan.limitedBy).toBe("plan");
  });
});

describe("automatic protection", () => {
  it("protects the usual window when the plan and balance allow it", () => {
    const standard = planFor("STANDARD");
    const plan = planProtection({ reference: 1.58, usualWeekly: 40, plan: standard, unit: "L", free: 200 });
    expect(plan.wanted).toBe(80); // 40 × 14/7, under 400 × 14/30
    expect(plan.limitedBy).toBe("usual");
    expect(plan.quote?.chargePerUnit).toBe(round4(1.58 * 0.0225));
  });

  it("is limited by the free balance, rounding volume down", () => {
    const plan = planProtection({ reference: 1.58, usualWeekly: 40, plan: basic, unit: "L", free: 30 });
    expect(plan.limitedBy).toBe("balance");
    expect(plan.volume).toBe(17);
    expect(plan.quote!.total).toBeLessThanOrEqual(30);
  });

  it("protects nothing below the minimum (5 L / 1 gal)", () => {
    expect(planProtection({ reference: 1.58, usualWeekly: 40, plan: basic, unit: "L", free: 7 }).reason).toBe("below_minimum");
    expect(planProtection({ reference: 3.5, usualWeekly: 10, plan: basic, unit: "gal", free: 3 }).volume).toBe(0);
  });

  it("works in gallons to 0.1 gal", () => {
    expect(roundVolumeDown(9.26, "gal")).toBe(9.2);
    expect(monthlyFuelLimit(basic, "gal")).toBeCloseTo(39.63, 2);
    const plan = planProtection({ reference: 3.5, usualWeekly: 10, plan: basic, unit: "gal", free: 100 });
    expect(plan.volume).toBe(9.2); // 39.63 × 7/30 = 9.25
  });
});

describe("deposits and fills", () => {
  it("never lets a deposit take the balance over the plan's wallet limit", () => {
    expect(servicePlans.map((plan) => plan.walletLimitMinor / 100)).toEqual([500, 1500, 3000]);
    expect(maxDeposit(basic, 450)).toBe(50);
    expect(maxDeposit(basic, 500)).toBe(0);
  });

  it("pays above-the-limit fuel from free balance, then the card, never overdrawing", () => {
    const quote = quoteProtection(3.5, 25);
    const spike = settleFill(20, 4.2, quote.strike, quote.boundary);
    expect(payFromBalance(spike, 10)).toEqual({ protectedPart: 73.5, fromBalance: 77, byCard: 0 });
    expect(payFromBalance(spike, 1)).toEqual({ protectedPart: 73.5, fromBalance: 74.5, byCard: 2.5 });
    const fall = settleFill(20, 3.4, quote.strike, quote.boundary);
    expect(payFromBalance(fall, 0).fromBalance).toBe(68);
  });
});
