import { describe, expect, it } from "vitest";
import { fleetForOrganisation, fleetMultiVehicleScenario, fleetProtectedGallons } from "./fleet";

describe("fleet multi-vehicle scenario", () => {
  it("contains three vehicles, three drivers and two governed groups", () => {
    expect(fleetMultiVehicleScenario.vehicles).toHaveLength(3);
    expect(fleetMultiVehicleScenario.drivers).toHaveLength(3);
    expect(fleetMultiVehicleScenario.groups).toHaveLength(2);
  });

  it("enforces exact group grade and 50 gallon vehicle limits", () => {
    expect(fleetMultiVehicleScenario.groups.map(({ fuelGrade }) => fuelGrade)).toEqual(["REGULAR", "PREMIUM"]);
    expect(fleetMultiVehicleScenario.groups.every(({ perVehicleLimitGallons }) => perVehicleLimitGallons === 50)).toBe(true);
    expect(fleetMultiVehicleScenario.vehicles.every(({ protectedGallons }) => protectedGallons <= 50)).toBe(true);
  });

  it("remains below the organisation aggregate limit", () => {
    expect(fleetProtectedGallons(fleetMultiVehicleScenario)).toBe(105);
    expect(fleetProtectedGallons(fleetMultiVehicleScenario)).toBeLessThanOrEqual(fleetMultiVehicleScenario.aggregateLimitGallons);
  });

  it("does not return fleet data across organisation scope", () => {
    expect(fleetForOrganisation("org-fleet-northstar")).toBe(fleetMultiVehicleScenario);
    expect(fleetForOrganisation("org-personal-a")).toBeNull();
    expect(fleetForOrganisation("guessed-org-id")).toBeNull();
  });
});
