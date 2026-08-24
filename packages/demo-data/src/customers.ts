export type CustomerEligibility = "ELIGIBLE" | "NEEDS_ATTENTION" | "RESTRICTED";
export type CustomerAccountState = "ACTIVE" | "REVIEW" | "CONTROLLED";

export type CustomerAuditEvent = Readonly<{
  eventId: string;
  event: string;
  actor: string;
  occurredAt: string;
  outcome: string;
}>;

export type CustomerEvidence = Readonly<{
  eligibilityDecisionId: string;
  eligibilityDecisionVersion: string;
  ruleVersion: string;
  reasonCodes: readonly string[];
  observedAt: string;
  controlOwner: string;
  protectionId: string | null;
  referencePriceMinorPerGallon: number | null;
  protectedQuantity4dp: string;
  protectionChargeMinor: number;
  protectionExpiresAt: string | null;
  rolloverState: "ENABLED" | "NOT_APPLICABLE" | "REVIEW_REQUIRED";
  productScope: string;
  caseId: string | null;
  auditRecordId: string;
  auditTrail: readonly CustomerAuditEvent[];
}>;

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
  evidence: CustomerEvidence;
}>;

export const customerRecords: readonly CustomerRecord[] = [
  {
    customerId: "customer-alex-morgan", organisationId: "org-personal-a", name: "Alex Morgan", email: "alex.morgan@example.test", market: "US", segment: "B2C", membership: "Personal member",
    eligibility: "ELIGIBLE", eligibilityReason: "Identity and account controls current", accountState: "ACTIVE", currency: "USD", availableMinor: 18425, reservedMinor: 7350, refundPayableMinor: 0, inFlightMinor: 0,
    protectedVolumeGallons: 20, openCases: 0, communicationState: "DELIVERED", lastCommunication: "Protection confirmation delivered", scenarioId: "flat-market-us", scenarioVersion: "1.0.0", freshness: "41 sec", provenance: "synthetic-seeded",
    evidence: { eligibilityDecisionId: "ELG-ALEX-0042", eligibilityDecisionVersion: "eligibility@1.3", ruleVersion: "RULE-10@1.2", reasonCodes: ["IDENTITY_CURRENT", "ACCOUNT_CONTROLS_CLEAR"], observedAt: "2026-08-21T16:44:21Z", controlOwner: "Customer Operations", protectionId: "PRT-ALEX-0020", referencePriceMinorPerGallon: 350, protectedQuantity4dp: "20.0000", protectionChargeMinor: 161, protectionExpiresAt: "2026-08-28T16:45:00Z", rolloverState: "ENABLED", productScope: "Regular · confirmed fuel gallons only", caseId: null, auditRecordId: "AUD-CUSTOMER-ALEX-0042", auditTrail: [{ eventId: "AE-ALEX-01", event: "Eligibility evaluated", actor: "Rules Engine", occurredAt: "2026-08-21T16:44:21Z", outcome: "Eligible" }, { eventId: "AE-ALEX-02", event: "Protection created", actor: "Customer command", occurredAt: "2026-08-21T16:45:00Z", outcome: "20.0000 gal protected" }] },
  },
  {
    customerId: "customer-mina-laurent", organisationId: "org-personal-canada", name: "Mina Laurent", email: "mina.laurent@example.test", market: "CA", segment: "B2C", membership: "Personal member",
    eligibility: "NEEDS_ATTENTION", eligibilityReason: "Eligibility evidence requires human review", accountState: "REVIEW", currency: "CAD", availableMinor: 14280, reservedMinor: 0, refundPayableMinor: 0, inFlightMinor: 0,
    protectedVolumeGallons: 0, openCases: 1, communicationState: "ACTION_REQUIRED", lastCommunication: "Account-needs-attention notice delivered", scenarioId: "eligibility-fraud-canada", scenarioVersion: "1.0.0", freshness: "55 sec", provenance: "synthetic-seeded",
    evidence: { eligibilityDecisionId: "ELG-MINA-0088", eligibilityDecisionVersion: "eligibility@1.3", ruleVersion: "RULE-10@1.2", reasonCodes: ["IDENTITY_SIGNAL_CONFLICT", "HUMAN_REVIEW_REQUIRED"], observedAt: "2026-08-21T16:44:05Z", controlOwner: "Compliance", protectionId: null, referencePriceMinorPerGallon: null, protectedQuantity4dp: "0.0000", protectionChargeMinor: 0, protectionExpiresAt: null, rolloverState: "REVIEW_REQUIRED", productScope: "No eligible protection while review is open", caseId: "CASE-ELG-CA-0088", auditRecordId: "AUD-CUSTOMER-MINA-0088", auditTrail: [{ eventId: "AE-MINA-01", event: "Eligibility evaluated", actor: "Rules Engine", occurredAt: "2026-08-21T16:44:05Z", outcome: "Needs attention" }, { eventId: "AE-MINA-02", event: "Case opened", actor: "Case Orchestrator", occurredAt: "2026-08-21T16:44:06Z", outcome: "Awaiting independent Compliance review" }, { eventId: "AE-MINA-03", event: "Customer notice delivered", actor: "Communications Service", occurredAt: "2026-08-21T16:44:09Z", outcome: "Account needs attention" }] },
  },
  {
    customerId: "customer-maya-brooks", organisationId: "org-fleet-northstar", name: "Maya Brooks", email: "maya.brooks@northstar.example", market: "US", segment: "FLEET_MEMBER", membership: "Field Operations · assigned driver",
    eligibility: "ELIGIBLE", eligibilityReason: "Fleet membership and driver assignment current", accountState: "ACTIVE", currency: "USD", availableMinor: 0, reservedMinor: 0, refundPayableMinor: 0, inFlightMinor: 0,
    protectedVolumeGallons: 42, openCases: 0, communicationState: "DELIVERED", lastCommunication: "Fleet protection notice delivered", scenarioId: "fleet-multi-vehicle-us", scenarioVersion: "1.0.0", freshness: "47 sec", provenance: "synthetic-seeded",
    evidence: { eligibilityDecisionId: "ELG-MAYA-0112", eligibilityDecisionVersion: "eligibility@1.3", ruleVersion: "RULE-10@1.2", reasonCodes: ["FLEET_MEMBERSHIP_CURRENT", "DRIVER_ASSIGNMENT_CURRENT"], observedAt: "2026-08-21T16:44:13Z", controlOwner: "Fleet Operations", protectionId: "PRT-MAYA-0042", referencePriceMinorPerGallon: 358, protectedQuantity4dp: "42.0000", protectionChargeMinor: 346, protectionExpiresAt: "2026-08-28T16:45:00Z", rolloverState: "ENABLED", productScope: "Regular · assigned fleet vehicles", caseId: null, auditRecordId: "AUD-CUSTOMER-MAYA-0112", auditTrail: [{ eventId: "AE-MAYA-01", event: "Fleet eligibility evaluated", actor: "Rules Engine", occurredAt: "2026-08-21T16:44:13Z", outcome: "Eligible" }, { eventId: "AE-MAYA-02", event: "Protection allocated", actor: "Protection Engine", occurredAt: "2026-08-21T16:45:00Z", outcome: "42.0000 gal protected" }] },
  },
  {
    customerId: "customer-aisha-coleman", organisationId: "org-fleet-northstar", name: "Aisha Coleman", email: "aisha.coleman@northstar.example", market: "US", segment: "FLEET_MEMBER", membership: "Executive Fleet · assigned driver",
    eligibility: "NEEDS_ATTENTION", eligibilityReason: "Premium-grade policy scope requires review", accountState: "REVIEW", currency: "USD", availableMinor: 0, reservedMinor: 0, refundPayableMinor: 0, inFlightMinor: 0,
    protectedVolumeGallons: 25, openCases: 1, communicationState: "ACTION_REQUIRED", lastCommunication: "Policy review notice queued", scenarioId: "fleet-multi-vehicle-us", scenarioVersion: "1.0.0", freshness: "47 sec", provenance: "synthetic-seeded",
    evidence: { eligibilityDecisionId: "ELG-AISHA-0113", eligibilityDecisionVersion: "eligibility@1.3", ruleVersion: "RULE-10@1.2", reasonCodes: ["PRODUCT_SCOPE_MISMATCH", "FLEET_POLICY_REVIEW_REQUIRED"], observedAt: "2026-08-21T16:44:13Z", controlOwner: "Fleet Operations", protectionId: "PRT-AISHA-0025", referencePriceMinorPerGallon: 358, protectedQuantity4dp: "25.0000", protectionChargeMinor: 206, protectionExpiresAt: "2026-08-28T16:45:00Z", rolloverState: "REVIEW_REQUIRED", productScope: "Premium request · regular-only fleet policy", caseId: "CASE-FLEET-0113", auditRecordId: "AUD-CUSTOMER-AISHA-0113", auditTrail: [{ eventId: "AE-AISHA-01", event: "Scope check evaluated", actor: "Rules Engine", occurredAt: "2026-08-21T16:44:13Z", outcome: "Review required" }, { eventId: "AE-AISHA-02", event: "Fleet policy case opened", actor: "Case Orchestrator", occurredAt: "2026-08-21T16:44:14Z", outcome: "Protection unchanged pending review" }] },
  },
];

export function customersForOrganisation(organisationId: string) {
  return customerRecords.filter((customer) => customer.organisationId === organisationId);
}

export function customerForOrganisation(organisationId: string, customerId: string) {
  return customerRecords.find((customer) => customer.organisationId === organisationId && customer.customerId === customerId) ?? null;
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
