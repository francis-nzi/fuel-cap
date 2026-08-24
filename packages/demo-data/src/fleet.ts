export type FuelGrade = "REGULAR" | "PREMIUM";

export type FleetGroup = Readonly<{
  groupId: string;
  organisationId: "org-fleet-northstar";
  name: string;
  costCentre: string;
  fuelGrade: FuelGrade;
  perVehicleLimitGallons: number;
  rolloverPolicy: "DEFAULT_ON_WITH_NOTICE" | "OFF";
  policyVersion: string;
}>;

export type FleetVehicle = Readonly<{
  vehicleId: string;
  organisationId: "org-fleet-northstar";
  groupId: string;
  registration: string;
  description: string;
  assignedDriverId: string;
  protectedGallons: number;
  status: "PROTECTED" | "REVIEW" | "UNPROTECTED";
  eligibility: "ELIGIBLE" | "NEEDS_ATTENTION";
  reservedMinor: number;
  expiresAt: string | null;
  caseId: string | null;
  decisionId: string;
}>;

export type FleetDriver = Readonly<{
  driverId: string;
  organisationId: "org-fleet-northstar";
  name: string;
  email: string;
  vehicleId: string;
}>;

export type FleetScenario = Readonly<{
  scenarioId: "fleet-multi-vehicle-us";
  scenarioVersion: "1.0.0";
  organisationId: "org-fleet-northstar";
  organisationName: "Northstar Fleet Services";
  aggregateLimitGallons: number;
  currency: "USD";
  plan: "FLEET_PRO";
  market: "US";
  openCases: number;
  communicationFailures: number;
  groups: readonly FleetGroup[];
  vehicles: readonly FleetVehicle[];
  drivers: readonly FleetDriver[];
  provenance: "synthetic-seeded";
}>;

export const fleetMultiVehicleScenario: FleetScenario = {
  scenarioId: "fleet-multi-vehicle-us",
  scenarioVersion: "1.0.0",
  organisationId: "org-fleet-northstar",
  organisationName: "Northstar Fleet Services",
  aggregateLimitGallons: 120,
  currency: "USD",
  plan: "FLEET_PRO",
  market: "US",
  openCases: 1,
  communicationFailures: 0,
  provenance: "synthetic-seeded",
  groups: [
    { groupId: "group-field", organisationId: "org-fleet-northstar", name: "Field Operations", costCentre: "CC-410", fuelGrade: "REGULAR", perVehicleLimitGallons: 50, rolloverPolicy: "DEFAULT_ON_WITH_NOTICE", policyVersion: "fleet-policy@1.4" },
    { groupId: "group-executive", organisationId: "org-fleet-northstar", name: "Executive Fleet", costCentre: "CC-220", fuelGrade: "PREMIUM", perVehicleLimitGallons: 50, rolloverPolicy: "OFF", policyVersion: "fleet-policy@1.3" },
  ],
  vehicles: [
    { vehicleId: "vehicle-f150", organisationId: "org-fleet-northstar", groupId: "group-field", registration: "TX-FC-1042", description: "Ford F-150", assignedDriverId: "driver-maya", protectedGallons: 42, status: "PROTECTED", eligibility: "ELIGIBLE", reservedMinor: 15435, expiresAt: "2026-08-27T16:45:00Z", caseId: null, decisionId: "FLEET-DEC-1042" },
    { vehicleId: "vehicle-silverado", organisationId: "org-fleet-northstar", groupId: "group-field", registration: "TX-FC-2088", description: "Chevrolet Silverado", assignedDriverId: "driver-luis", protectedGallons: 38, status: "PROTECTED", eligibility: "ELIGIBLE", reservedMinor: 13965, expiresAt: "2026-08-29T16:45:00Z", caseId: null, decisionId: "FLEET-DEC-2088" },
    { vehicleId: "vehicle-escalade", organisationId: "org-fleet-northstar", groupId: "group-executive", registration: "TX-FC-3017", description: "Cadillac Escalade", assignedDriverId: "driver-aisha", protectedGallons: 25, status: "REVIEW", eligibility: "NEEDS_ATTENTION", reservedMinor: 9188, expiresAt: null, caseId: "CASE-FLEET-3017", decisionId: "FLEET-DEC-3017" },
  ],
  drivers: [
    { driverId: "driver-maya", organisationId: "org-fleet-northstar", name: "Maya Brooks", email: "maya.brooks@northstar.example", vehicleId: "vehicle-f150" },
    { driverId: "driver-luis", organisationId: "org-fleet-northstar", name: "Luis Ortega", email: "luis.ortega@northstar.example", vehicleId: "vehicle-silverado" },
    { driverId: "driver-aisha", organisationId: "org-fleet-northstar", name: "Aisha Coleman", email: "aisha.coleman@northstar.example", vehicleId: "vehicle-escalade" },
  ],
};

export function fleetForOrganisation(organisationId: string) {
  return organisationId === fleetMultiVehicleScenario.organisationId ? fleetMultiVehicleScenario : null;
}

export function fleetProtectedGallons(fleet: FleetScenario) {
  return fleet.vehicles.reduce((total, vehicle) => total + vehicle.protectedGallons, 0);
}

export function fleetReservedMinor(fleet: FleetScenario) {
  return fleet.vehicles.reduce((total, vehicle) => total + vehicle.reservedMinor, 0);
}

export function fleetRolloversDue(fleet: FleetScenario) {
  return fleet.vehicles.filter(({ expiresAt }) => expiresAt && expiresAt <= "2026-08-28T16:45:00Z").length;
}
