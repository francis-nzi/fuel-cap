import { describe, expect, it } from "vitest";
import { createGrowthExport, growthContacts, growthForOrganisation, growthFunnel, growthMarkets, growthSources, legacyDashboardRetirement, legacyGrowthFieldMap, validateGrowthProjection } from "./growth-dashboard";

describe("governed growth dashboard projection", () => {
  it("maps legacy fields to classified canonical fields", () => { expect(legacyGrowthFieldMap.length).toBeGreaterThanOrEqual(7); expect(legacyGrowthFieldMap.find(({ legacy }) => legacy.includes("email"))).toMatchObject({ classification: "RESTRICTED" }); });
  it("reconciles summary, funnel, market and acquisition totals", () => { expect(validateGrowthProjection()).toEqual({ valid: true, pageViews: 240, starts: 96, completed: 38 }); expect(growthFunnel.at(-1)?.count).toBe(38); expect(growthMarkets.reduce((sum,row)=>sum+row.starts,0)).toBe(96); expect(growthSources.reduce((sum,row)=>sum+row.completed,0)).toBe(38); });
  it("keeps contacts reference-only and tenant scoped", () => { expect(growthContacts.every(({emailDisplayed})=>!emailDisplayed)).toBe(true); expect(growthForOrganisation("org-fuelcap-global")?.contacts).toHaveLength(3); expect(growthForOrganisation("org-other")).toBeNull(); });
  it("exports only through an authorised simulated path", () => { expect(createGrowthExport("principal-auditor", true)).toMatchObject({ rowCount: 3, watermarked: true, simulated: true }); expect(()=>createGrowthExport("principal-presenter", false)).toThrow("not authorised"); });
  it("documents target access and legacy retirement", () => expect(legacyDashboardRetirement).toMatchObject({ sharedPasswordRemovedFromTarget: true, retirementOwner: "Platform Operations" }));
});
