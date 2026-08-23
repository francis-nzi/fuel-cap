import { describe, expect, it } from "vitest";
import { customerDirectoryTotals, customerOwedMinor, customerRecords, customersForOrganisation } from "./customers";

describe("customer demonstrator records", () => {
  it("returns only the active organisation's customers", () => {
    expect(customersForOrganisation("org-personal-canada").map(({ customerId }) => customerId)).toEqual(["customer-mina-laurent"]);
    expect(customersForOrganisation("guessed-org-id")).toEqual([]);
  });

  it("keeps available, reserved and refund-payable value in customer owed", () => {
    const alex = customerRecords.find(({ customerId }) => customerId === "customer-alex-morgan")!;
    expect(customerOwedMinor(alex)).toBe(25775);
  });

  it("summarises eligibility, cases and protected volume deterministically", () => {
    expect(customerDirectoryTotals(customersForOrganisation("org-fleet-northstar"))).toEqual({ customerCount: 2, eligibleCount: 1, attentionCount: 1, customerOwedMinor: 0, protectedVolumeGallons: 67, openCases: 1 });
  });
});
