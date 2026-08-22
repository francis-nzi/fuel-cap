import { describe, expect, it } from "vitest";
import { authorize, demoPrincipals, visibleWorkspaces, type Principal } from "./index";

const operations = demoPrincipals.find(({ principalId }) => principalId === "principal-operations")!;
const presenter = demoPrincipals.find(({ principalId }) => principalId === "principal-presenter")!;
const auditor = demoPrincipals.find(({ principalId }) => principalId === "principal-auditor")!;

describe("admin authorization policy", () => {
  it("allows an operator to view an assigned organisation", () => {
    expect(authorize({ principal: operations, environment: "demo", activeOrganisationId: "org-fleet-northstar", workspace: "customers-fleets", verb: "view" }).reasonCode).toBe("ALLOW");
  });

  it("denies a guessed organisation without membership", () => {
    expect(authorize({ principal: auditor, environment: "demo", activeOrganisationId: "org-fleet-northstar", workspace: "customers-fleets", verb: "view" }).reasonCode).toBe("DENY_NO_MEMBERSHIP");
  });

  it("denies self approval even when the role can approve", () => {
    const finance = demoPrincipals.find(({ principalId }) => principalId === "principal-finance")!;
    expect(authorize({ principal: finance, environment: "demo", activeOrganisationId: "org-fuelcap-global", workspace: "billing-xero", verb: "approve", actionOwnerPrincipalId: finance.principalId }).reasonCode).toBe("DENY_SELF_APPROVAL");
  });

  it("prohibits Demonstrator Presenter in production", () => {
    expect(authorize({ principal: presenter, environment: "production", activeOrganisationId: "org-fuelcap-global", workspace: "control-room", verb: "view" }).reasonCode).toBe("DENY_DP_PRODUCTION");
  });

  it("keeps auditors read-only", () => {
    expect(authorize({ principal: auditor, environment: "demo", activeOrganisationId: "org-fuelcap-global", workspace: "ledger-wallet", verb: "initiate" }).reasonCode).toBe("DENY_POLICY");
  });

  it("rejects structurally conflicting role assignments", () => {
    const conflicting: Principal = { ...auditor, roles: ["AU", "FR"] };
    expect(authorize({ principal: conflicting, environment: "demo", activeOrganisationId: "org-fuelcap-global", workspace: "ledger-wallet", verb: "view" }).reasonCode).toBe("DENY_ASSIGNMENT_CONFLICT");
  });

  it("filters navigation using the same server policy", () => {
    expect(visibleWorkspaces(auditor, "demo", "org-fuelcap-global", ["control-room", "billing-xero"])).toEqual(["control-room", "billing-xero"]);
    expect(visibleWorkspaces(auditor, "demo", "org-fleet-northstar", ["control-room", "billing-xero"])).toEqual([]);
  });
});
