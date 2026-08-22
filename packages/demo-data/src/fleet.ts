export type FuelGrade = "REGULAR" | "PREMIUM";

export type FleetGroup = Readonly<{
  groupId: string;
  organisationId: "org-fleet-northstar";
  name: string;
  costCentre: string;
  fuelGrade: FuelGrade;
  perVehicleLimitGallons: number;
  rolloverPolicy: "DEFAULT_ON_WITH_NOTICE" | "OFF";
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
  provenance: "synthetic-seeded",
  groups: [
    { groupId: "group-field", organisationId: "org-fleet-northstar", name: "Field Operations", costCentre: "CC-410", fuelGrade: "REGULAR", perVehicleLimitGallons: 50, rolloverPolicy: "DEFAULT_ON_WITH_NOTICE" },
    { groupId: "group-executive", organisationId: "org-fleet-northstar", name: "Executive Fleet", costCentre: "CC-220", fuelGrade: "PREMIUM", perVehicleLimitGallons: 50, rolloverPolicy: "OFF" },
  ],
  vehicles: [
    { vehicleId: "vehicle-f150", organisationId: "org-fleet-northstar", groupId: "group-field", registration: "TX-FC-1042", description: "Ford F-150", assignedDriverId: "driver-maya", protectedGallons: 42, status: "PROTECTED" },
    { vehicleId: "vehicle-silverado", organisationId: "org-fleet-northstar", groupId: "group-field", registration: "TX-FC-2088", description: "Chevrolet Silverado", assignedDriverId: "driver-luis", protectedGallons: 38, status: "PROTECTED" },
    { vehicleId: "vehicle-escalade", organisationId: "org-fleet-northstar", groupId: "group-executive", registration: "TX-FC-3017", description: "Cadillac Escalade", assignedDriverId: "driver-aisha", protectedGallons: 25, status: "REVIEW" },
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
