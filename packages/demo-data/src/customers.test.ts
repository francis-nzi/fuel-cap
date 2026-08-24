import { describe, expect, it } from "vitest";
import { customerDirectoryTotals, customerForOrganisation, customerOwedMinor, customerRecords, customersForOrganisation } from "./customers";

describe("customer demonstrator records", () => {
  it("returns only the active organisation's customers", () => {
    expect(customersForOrganisation("org-personal-canada").map(({ customerId }) => customerId)).toEqual(["customer-mina-laurent"]);
    expect(customersForOrganisation("guessed-org-id")).toEqual([]);
  });

  it("keeps available, reserved and refund-payable value in customer owed", () => {
    const alex = customerRecords.find(({ customerId }) => customerId === "customer-alex-morgan")!;
    expect(customerOwedMinor(alex)).toBe(25775);
  });

  it("never returns customer evidence across an organisation boundary", () => {
    expect(customerForOrganisation("org-personal-canada", "customer-alex-morgan")).toBeNull();
    expect(customerForOrganisation("guessed-org-id", "customer-mina-laurent")).toBeNull();
    expect(customerForOrganisation("org-personal-canada", "customer-mina-laurent")?.evidence.auditRecordId).toBe("AUD-CUSTOMER-MINA-0088");
  });

  it("separates eligibility, protection and action lineage", () => {
    const mina = customerForOrganisation("org-personal-canada", "customer-mina-laurent")!;
    expect(mina.evidence.reasonCodes).toEqual(["IDENTITY_SIGNAL_CONFLICT", "HUMAN_REVIEW_REQUIRED"]);
    expect(mina.evidence.protectionId).toBeNull();
    expect(mina.evidence.caseId).toBe("CASE-ELG-CA-0088");
    expect(mina.evidence.auditTrail).toHaveLength(3);
  });

  it("summarises eligibility, cases and protected volume deterministically", () => {
    expect(customerDirectoryTotals(customersForOrganisation("org-fleet-northstar"))).toEqual({ customerCount: 2, eligibleCount: 1, attentionCount: 1, customerOwedMinor: 0, protectedVolumeGallons: 67, openCases: 1 });
  });
});
