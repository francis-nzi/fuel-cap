import { describe, expect, it } from "vitest";
import { authorize, authorizeTenantResource, demoPrincipals, evaluateBreakGlass, evaluateGovernedAction, visibleWorkspaces, type Principal } from "./index";

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

  it("requires fresh step-up assurance for governed approval", () => {
    const finance = demoPrincipals.find(({ principalId }) => principalId === "principal-finance")!;
    const request = { principal: finance, environment: "demo" as const, activeOrganisationId: "org-fuelcap-global", workspace: "billing-xero" as const, verb: "approve" as const, actionOwnerPrincipalId: "another-principal", reconciled: true, priceValid: true, requiresStepUp: true };
    expect(evaluateGovernedAction({ ...request, assurance: "standard" }).reasonCode).toBe("REQUIRE_STEP_UP");
    expect(evaluateGovernedAction({ ...request, assurance: "step-up" }).reasonCode).toBe("ALLOW");
  });

  it("blocks governed actions when integrity state is invalid", () => {
    const risk = demoPrincipals.find(({ principalId }) => principalId === "principal-risk")!;
    expect(evaluateGovernedAction({ principal: risk, environment: "demo", activeOrganisationId: "org-fuelcap-global", workspace: "spread-engine", verb: "approve", actionOwnerPrincipalId: "another-principal", reconciled: true, priceValid: false, requiresStepUp: true, assurance: "step-up" }).reasonCode).toBe("DENY_INVALID_STATE");
  });

  it("never lets break-glass override protected invariants", () => {
    const platformAdmin: Principal = { principalId: "principal-platform", name: "Priya Adams", email: "priya.adams@fuelcap.example", roles: ["PA"], organisationIds: ["org-fuelcap-global"] };
    expect(evaluateBreakGlass({ principal: platformAdmin, environment: "demo", assurance: "step-up", requestedCapability: "validate-price" })).toEqual({ allowed: false, reasonCode: "DENY_PROTECTED_INVARIANT", incidentRequired: true });
    expect(evaluateBreakGlass({ principal: platformAdmin, environment: "demo", assurance: "step-up", requestedCapability: "temporary-support-access" }).reasonCode).toBe("ALLOW_INCIDENT_OPENED");
  });

  it("denies guessed and cross-organisation resource identifiers", () => {
    expect(authorizeTenantResource({ principal: operations, environment: "demo", activeOrganisationId: "org-fleet-northstar", resourceOrganisationId: "guessed-org-id", workspace: "customers-fleets" }).reasonCode).toBe("DENY_TENANT_CONTEXT");
    expect(authorizeTenantResource({ principal: operations, environment: "demo", activeOrganisationId: "org-personal-a", resourceOrganisationId: "org-fleet-northstar", workspace: "customers-fleets" }).reasonCode).toBe("DENY_TENANT_CONTEXT");
    expect(authorizeTenantResource({ principal: operations, environment: "demo", activeOrganisationId: "org-fleet-northstar", resourceOrganisationId: "org-fleet-northstar", workspace: "customers-fleets" }).reasonCode).toBe("ALLOW");
  });
});
