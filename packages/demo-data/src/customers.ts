export type CustomerEligibility = "ELIGIBLE" | "NEEDS_ATTENTION" | "RESTRICTED";
export type CustomerAccountState = "ACTIVE" | "REVIEW" | "CONTROLLED";

export type CustomerRecord = Readonly<{
  customerId: string;
  organisationId: "org-personal-a" | "org-personal-canada" | "org-fleet-northstar";
  name: string;
  email: string;
  market: "US" | "CA";
  segment: "B2C" | "FLEET_MEMBER";
  membership: string;
  eligibility: CustomerEligibility;
  eligibilityReason: string;
  accountState: CustomerAccountState;
  currency: "USD" | "CAD";
  availableMinor: number;
  reservedMinor: number;
  refundPayableMinor: number;
  inFlightMinor: number;
  protectedVolumeGallons: number;
  openCases: number;
  communicationState: "DELIVERED" | "ACTION_REQUIRED" | "FAILED";
  lastCommunication: string;
  scenarioId: "flat-market-us" | "fleet-multi-vehicle-us" | "eligibility-fraud-canada";
  scenarioVersion: "1.0.0";
  freshness: string;
  provenance: "synthetic-seeded";
}>;

export const customerRecords: readonly CustomerRecord[] = [
  {
    customerId: "customer-alex-morgan", organisationId: "org-personal-a", name: "Alex Morgan", email: "alex.morgan@example.test", market: "US", segment: "B2C", membership: "Personal member",
    eligibility: "ELIGIBLE", eligibilityReason: "Identity and account controls current", accountState: "ACTIVE", currency: "USD", availableMinor: 18425, reservedMinor: 7350, refundPayableMinor: 0, inFlightMinor: 0,
    protectedVolumeGallons: 20, openCases: 0, communicationState: "DELIVERED", lastCommunication: "Protection confirmation delivered", scenarioId: "flat-market-us", scenarioVersion: "1.0.0", freshness: "41 sec", provenance: "synthetic-seeded",
  },
  {
    customerId: "customer-mina-laurent", organisationId: "org-personal-canada", name: "Mina Laurent", email: "mina.laurent@example.test", market: "CA", segment: "B2C", membership: "Personal member",
    eligibility: "NEEDS_ATTENTION", eligibilityReason: "Eligibility evidence requires human review", accountState: "REVIEW", currency: "CAD", availableMinor: 14280, reservedMinor: 0, refundPayableMinor: 0, inFlightMinor: 0,
    protectedVolumeGallons: 0, openCases: 1, communicationState: "ACTION_REQUIRED", lastCommunication: "Account-needs-attention notice delivered", scenarioId: "eligibility-fraud-canada", scenarioVersion: "1.0.0", freshness: "55 sec", provenance: "synthetic-seeded",
  },
  {
    customerId: "customer-maya-brooks", organisationId: "org-fleet-northstar", name: "Maya Brooks", email: "maya.brooks@northstar.example", market: "US", segment: "FLEET_MEMBER", membership: "Field Operations · assigned driver",
    eligibility: "ELIGIBLE", eligibilityReason: "Fleet membership and driver assignment current", accountState: "ACTIVE", currency: "USD", availableMinor: 0, reservedMinor: 0, refundPayableMinor: 0, inFlightMinor: 0,
    protectedVolumeGallons: 42, openCases: 0, communicationState: "DELIVERED", lastCommunication: "Fleet protection notice delivered", scenarioId: "fleet-multi-vehicle-us", scenarioVersion: "1.0.0", freshness: "47 sec", provenance: "synthetic-seeded",
  },
  {
    customerId: "customer-aisha-coleman", organisationId: "org-fleet-northstar", name: "Aisha Coleman", email: "aisha.coleman@northstar.example", market: "US", segment: "FLEET_MEMBER", membership: "Executive Fleet · assigned driver",
    eligibility: "NEEDS_ATTENTION", eligibilityReason: "Premium-grade policy scope requires review", accountState: "REVIEW", currency: "USD", availableMinor: 0, reservedMinor: 0, refundPayableMinor: 0, inFlightMinor: 0,
    protectedVolumeGallons: 25, openCases: 1, communicationState: "ACTION_REQUIRED", lastCommunication: "Policy review notice queued", scenarioId: "fleet-multi-vehicle-us", scenarioVersion: "1.0.0", freshness: "47 sec", provenance: "synthetic-seeded",
  },
];

export function customersForOrganisation(organisationId: string) {
  return customerRecords.filter((customer) => customer.organisationId === organisationId);
}

export function customerOwedMinor(customer: CustomerRecord) {
  return customer.availableMinor + customer.reservedMinor + customer.refundPayableMinor;
}

export function customerDirectoryTotals(customers: readonly CustomerRecord[]) {
  return customers.reduce((totals, customer) => ({
    customerCount: totals.customerCount + 1,
    eligibleCount: totals.eligibleCount + (customer.eligibility === "ELIGIBLE" ? 1 : 0),
    attentionCount: totals.attentionCount + (customer.eligibility === "ELIGIBLE" ? 0 : 1),
    customerOwedMinor: totals.customerOwedMinor + customerOwedMinor(customer),
    protectedVolumeGallons: totals.protectedVolumeGallons + customer.protectedVolumeGallons,
    openCases: totals.openCases + customer.openCases,
  }), { customerCount: 0, eligibleCount: 0, attentionCount: 0, customerOwedMinor: 0, protectedVolumeGallons: 0, openCases: 0 });
}
