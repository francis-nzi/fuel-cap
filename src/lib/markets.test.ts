import { describe, expect, it } from "vitest";
import { demoLockedPrice, markets, money } from "./markets";

describe("market configuration", () => {
  it("uses gallons in the US and litres in Canada and the UK", () => {
    expect(markets.US.unit).toBe("gal");
    expect(markets.CA.unit).toBe("L");
    expect(markets.GB.unit).toBe("L");
  });

  it("formats currency for each market", () => {
    expect(money(3.42, markets.US)).toContain("$3.42");
    expect(money(1.42, markets.GB)).toContain("£1.42");
  });

  it("derives server-matched demo lock prices from reference prices", () => {
    expect(demoLockedPrice(markets.US, 3.87)).toBeCloseTo(3.42);
    expect(demoLockedPrice(markets.CA, 1.71)).toBeCloseTo(1.63);
    expect(demoLockedPrice(markets.GB, 1.49)).toBeCloseTo(1.42);
  });
});
