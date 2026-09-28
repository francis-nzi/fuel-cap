import { describe, expect, it } from "vitest";
import { cents, quoteProtection, round4, savedVsReference, savingOnFill, settleFill, topUpFor } from "./protection";

describe("protection pricing (Cost of Protection §5.3)", () => {
  it("rounds half up without floating-point drift", () => {
    expect((3.675).toFixed(2)).toBe("3.67"); // the trap the helper avoids
    expect(cents(3.675)).toBe(3.68);
    expect(cents(91.875)).toBe(91.88);
    expect(cents(2.0125)).toBe(2.01);
    expect(round4(3.5 * 1.05)).toBe(3.675);
  });

  it("quotes 25 gal at a $3.50 reference", () => {
    const quote = quoteProtection(3.5, 25);
    expect(quote).toMatchObject({ strike: 3.675, boundary: 4.025, chargePerUnit: 0.0805, held: 91.875, charge: 2.0125, total: 93.89 });
    expect(cents(quote.strike)).toBe(3.68);
    expect(cents(quote.boundary)).toBe(4.03);
    expect(cents(quote.chargePerUnit)).toBe(0.08);
  });

  it("keeps the existing cap when adding fuel, charging at today's rate", () => {
    const first = quoteProtection(3.5, 25);
    const more = quoteProtection(3.9, 10, first);
    expect(more).toMatchObject({ strike: 3.675, boundary: 4.025, chargePerUnit: 0.0897, held: 36.75 });
    expect(more.total).toBe(cents(36.75 + cents(0.897)));
  });

  it("tops up by at least 100, else the shortfall rounded up to the next 50", () => {
    expect(topUpFor(93.89, 0)).toBe(100);
    expect(topUpFor(93.89, 93.89)).toBe(0);
    expect(topUpFor(160.12, 10)).toBe(200);
    expect(topUpFor(281.44, 250)).toBe(100);
  });
});

describe("pump settlement acceptance cases (20 gal fill after protecting 25 gal)", () => {
  const { strike, boundary } = quoteProtection(3.5, 25);

  it("Case A: rise to $3.90", () => {
    expect(settleFill(20, 3.9, strike, boundary)).toMatchObject({ outcome: "rise", stationTotal: 78, fromProtected: 73.5, fromWallet: 0, coveredByFuelCap: 4.5, returnedToWallet: 0 });
  });

  it("Case B: spike to $4.20", () => {
    const fill = settleFill(20, 4.2, strike, boundary);
    expect(fill).toMatchObject({ outcome: "spike", stationTotal: 84, fromProtected: 73.5, fromWallet: 3.5, coveredByFuelCap: 7, returnedToWallet: 0 });
    expect(cents(fill.fromProtected + fill.fromWallet)).toBe(77);
  });

  it("Case C: fall to $3.40", () => {
    expect(settleFill(20, 3.4, strike, boundary)).toMatchObject({ outcome: "fall", stationTotal: 68, fromProtected: 68, fromWallet: 0, coveredByFuelCap: 0, returnedToWallet: 5.5 });
  });

  it("counts savings as FuelCap payouts plus the drop below today's price", () => {
    expect(savingOnFill(settleFill(20, 3.9, strike, boundary), 3.5)).toBe(4.5);
    expect(savingOnFill(settleFill(20, 4.2, strike, boundary), 3.5)).toBe(7);
    const fall = settleFill(20, 3.4, strike, boundary);
    expect(savedVsReference(fall, 3.5)).toBe(2);
    expect(savingOnFill(fall, 3.5)).toBe(2);
    expect(fall.returnedToWallet).toBe(5.5);
    // Below the cap but above today's price: money comes back, but nothing was saved vs today.
    expect(savingOnFill(settleFill(20, 3.6, strike, boundary), 3.5)).toBe(0);
  });

  it("walks the wallet from $0: $6.11 after protecting, $11.61 after Case C with $18.38 still held", () => {
    const quote = quoteProtection(3.5, 25);
    let wallet = 0;
    wallet = cents(wallet + topUpFor(quote.total, wallet) - quote.total);
    let held = quote.held;
    expect(wallet).toBe(6.11);
    expect(cents(held)).toBe(91.88);
    const fill = settleFill(20, 3.4, quote.strike, quote.boundary);
    wallet = cents(wallet + fill.returnedToWallet - fill.fromWallet);
    held = round4(held - fill.heldReleased);
    expect(wallet).toBe(11.61);
    expect(cents(held)).toBe(18.38);
  });
});
