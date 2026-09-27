import { describe, expect, it } from "vitest";
import { median, normalizeOptions, shiftOptions, stationsByPrice, type PriceOption } from "./price-options";

const station = (id: string, provider: string, unitPrice: number): PriceOption => ({
  scopeType: "station", scopeId: id, label: `${provider} ${id} - Somewhere`, providerName: provider,
  unitPrice, currency: "GBP", unit: "L", stationCount: 1, observedAt: "2026-09-27T10:00:00Z",
});

describe("price options", () => {
  it("takes the median, not the maximum", () => {
    expect(median([1.7, 1.72, 3.0])).toBe(1.72);
    expect(median([1.7, 1.74])).toBe(1.72);
    expect(median([])).toBe(0);
  });

  it("prices 'anywhere' and brands from the station list so one outlier cannot set the price", () => {
    const options = normalizeOptions([
      station("a", "Shell", 1.7), station("b", "Shell", 1.74), station("c", "Gulf", 3.0),
      { ...station("x", "Shell", 9), scopeType: "provider", scopeId: "fuel-finder-brand-shell", label: "Shell", stationCount: 2 },
      { ...station("y", "", 3.0), scopeType: "country", scopeId: null, label: "Any", stationCount: 3 },
    ], "United Kingdom");
    expect(options.find((o) => o.scopeType === "country")).toMatchObject({ unitPrice: 1.74, stationCount: 3, label: "Any eligible United Kingdom station" });
    expect(options.find((o) => o.scopeType === "provider" && o.providerName === "Shell")).toMatchObject({ unitPrice: 1.72, stationCount: 2, scopeId: "fuel-finder-brand-shell" });
    expect(options.filter((o) => o.scopeType === "station")).toHaveLength(3);
  });

  it("shifts every price by a published market move and sorts stations cheapest first", () => {
    const shifted = shiftOptions([station("a", "Shell", 3.42), station("b", "BP", 3.39)], 0.25);
    expect(shifted.map((o) => o.unitPrice)).toEqual([3.67, 3.64]);
    expect(stationsByPrice(shifted).map((o) => o.scopeId)).toEqual(["b", "a"]);
  });
});
