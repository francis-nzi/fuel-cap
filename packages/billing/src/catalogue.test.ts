import { describe, expect, it } from "vitest";
import { createCatalogueLine, createProtectionChargeLines, selectCatalogueItem, type CatalogueItem } from "./catalogue";
const item: CatalogueItem = { itemId: "PLUS-US", version: 1, concept: "PLUS_SUBSCRIPTION", name: "FuelCap+ monthly", currency: "USD", amountMinor: 999, billingPeriod: "MONTHLY", effectiveFrom: "2026-01-01T00:00:00.000Z", effectiveTo: null, active: true };
const charge = { sourceReference: "PROTECT-1", currency: "USD" as const, referencePrice4dp: 35_000, quantity4dp: 250_000, rates: [{ component: "MODELLED_PROTECTION_COST" as const, rateBps: 130 }, { component: "MARGIN" as const, rateBps: 70 }, { component: "BUFFER" as const, rateBps: 30 }] };
describe("billing catalogue", () => {
  it("selects the highest effective active version", () => expect(selectCatalogueItem([item, { ...item, version: 2, amountMinor: 1099, effectiveFrom: "2026-08-01T00:00:00.000Z" }], "PLUS-US", "2026-08-27T00:00:00.000Z").version).toBe(2));
  it("rejects absent or expired catalogue items", () => expect(() => selectCatalogueItem([{ ...item, effectiveTo: "2026-02-01T00:00:00.000Z" }], "PLUS-US", "2026-08-27T00:00:00.000Z")).toThrow(/No effective/i));
  it("creates typed subscription lines with tax kept distinct", () => expect(createCatalogueLine(item, 2, "INV-1", 200)).toMatchObject({ concept: "PLUS_SUBSCRIPTION", subtotalMinor: 1998, taxMinor: 200, totalMinor: 2198 }));
  it("retains all three protection-charge components", () => expect(createProtectionChargeLines({ ...charge, fuelCapPlus: false }).map((l) => l.component)).toEqual(["MODELLED_PROTECTION_COST", "MARGIN", "BUFFER"]));
  it("reproduces the default $2.01 rounded protection charge", () => expect(createProtectionChargeLines({ ...charge, fuelCapPlus: false }).reduce((n, l) => n + l.totalMinor, 0)).toBe(201));
  it("FuelCap+ removes margin only", () => { const lines = createProtectionChargeLines({ ...charge, fuelCapPlus: true }); expect(lines.find((l) => l.component === "MARGIN")).toMatchObject({ discountMinor: 61, totalMinor: 0 }); expect(lines.find((l) => l.component === "MODELLED_PROTECTION_COST")?.totalMinor).toBe(114); expect(lines.find((l) => l.component === "BUFFER")?.totalMinor).toBe(26); });
  it("does not silently waive modelled cost when margin is zero", () => expect(createProtectionChargeLines({ ...charge, fuelCapPlus: true }).reduce((n, l) => n + l.totalMinor, 0)).toBe(140));
  it("rejects duplicate component definitions", () => expect(() => createProtectionChargeLines({ ...charge, rates: [charge.rates[0], charge.rates[0]], fuelCapPlus: false })).toThrow(/unique/i));
});
