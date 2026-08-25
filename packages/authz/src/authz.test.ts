import { describe, expect, it } from "vitest";
import { authorize, authorizeTenantResource, demoPrincipals, evaluateBreakGlass, evaluateGovernedAction, visibleWorkspaces, type Principal } from "./index";

const operations = demoPrincipals.find(({ principalId }) => principalId === "principal-operations")!;
const presenter = demoPrincipals.find(({ principalId }) => principalId === "principal-presenter")!;
const auditor = demoPrincipals.find(({ principalId }) => principalId === "principal-auditor")!;

describe("admin authorization policy", () => {
  it("allows an operator to view an assigned organisation", () => {
    expect(authorize({ principal: operations, environment: "demo", activeOrganisationId: "org-fleet-northstar", workspace: "customers", verb: "view" }).reasonCode).toBe("ALLOW");
  });

  it("denies a guessed organisation without membership", () => {
    expect(authorize({ principal: auditor, environment: "demo", activeOrganisationId: "org-fleet-northstar", workspace: "customers", verb: "view" }).reasonCode).toBe("DENY_NO_MEMBERSHIP");
  });

  it("denies self approval even when the role can approve", () => {
    const finance = demoPrincipals.find(({ principalId }) => principalId === "principal-finance")!;
    expect(authorize({ principal: finance, environment: "demo", activeOrganisationId: "org-fuelcap-global", workspace: "billing-reconciliation", verb: "approve", actionOwnerPrincipalId: finance.principalId }).reasonCode).toBe("DENY_SELF_APPROVAL");
  });

  it("prohibits Demonstrator Presenter in production", () => {
    expect(authorize({ principal: presenter, environment: "production", activeOrganisationId: "org-fuelcap-global", workspace: "control-room", verb: "view" }).reasonCode).toBe("DENY_DP_PRODUCTION");
  });

  it("keeps auditors read-only", () => {
    expect(authorize({ principal: auditor, environment: "demo", activeOrganisationId: "org-fuelcap-global", workspace: "transactions-ledger", verb: "initiate" }).reasonCode).toBe("DENY_POLICY");
  });

  it("allows scoped audit export but keeps Presenter export denied", () => {
    expect(authorize({ principal: auditor, environment: "demo", activeOrganisationId: "org-fuelcap-global", workspace: "platform-integrations-audit", verb: "export" }).reasonCode).toBe("ALLOW");
    expect(authorize({ principal: presenter, environment: "demo", activeOrganisationId: "org-fuelcap-global", workspace: "platform-integrations-audit", verb: "export" }).reasonCode).toBe("DENY_POLICY");
  });

  it("allows different DI or PA step-up approval for platform configuration", () => {
    const data = demoPrincipals.find(({ principalId }) => principalId === "principal-data")!;
    const platform = demoPrincipals.find(({ principalId }) => principalId === "principal-platform")!;
    const request = { environment: "demo" as const, activeOrganisationId: "org-fuelcap-global", workspace: "platform-integrations-audit" as const, verb: "approve" as const, actionOwnerPrincipalId: "di-maker", reconciled: true, priceValid: true, requiresStepUp: true, assurance: "step-up" as const };
    expect(evaluateGovernedAction({ ...request, principal: data }).reasonCode).toBe("ALLOW");
    expect(evaluateGovernedAction({ ...request, principal: platform }).reasonCode).toBe("ALLOW");
  });

  it("denies Presenter approval and stale assurance for platform configuration", () => {
    const data = demoPrincipals.find(({ principalId }) => principalId === "principal-data")!;
    const request = { environment: "demo" as const, activeOrganisationId: "org-fuelcap-global", workspace: "platform-integrations-audit" as const, verb: "approve" as const, actionOwnerPrincipalId: "di-maker", reconciled: true, priceValid: true, requiresStepUp: true };
    expect(evaluateGovernedAction({ ...request, principal: presenter, assurance: "step-up" }).reasonCode).toBe("DENY_POLICY");
    expect(evaluateGovernedAction({ ...request, principal: data, assurance: "standard" }).reasonCode).toBe("REQUIRE_STEP_UP");
  });

  it("allows scoped case initiation while keeping Presenter case actions denied", () => {
    const data = demoPrincipals.find(({ principalId }) => principalId === "principal-data")!;
    expect(authorize({ principal: operations, environment: "demo", activeOrganisationId: "org-fuelcap-global", workspace: "fraud-cases", verb: "initiate" }).reasonCode).toBe("ALLOW");
    expect(authorize({ principal: data, environment: "demo", activeOrganisationId: "org-fuelcap-global", workspace: "platform-integrations-audit", verb: "initiate" }).reasonCode).toBe("ALLOW");
    expect(authorize({ principal: presenter, environment: "demo", activeOrganisationId: "org-fuelcap-global", workspace: "fraud-cases", verb: "initiate" }).reasonCode).toBe("DENY_POLICY");
  });

  it("rejects structurally conflicting role assignments", () => {
    const conflicting: Principal = { ...auditor, roles: ["AU", "FR"] };
    expect(authorize({ principal: conflicting, environment: "demo", activeOrganisationId: "org-fuelcap-global", workspace: "transactions-ledger", verb: "view" }).reasonCode).toBe("DENY_ASSIGNMENT_CONFLICT");
  });

  it("filters navigation using the same server policy", () => {
    expect(visibleWorkspaces(auditor, "demo", "org-fuelcap-global", ["control-room", "billing-reconciliation"])).toEqual(["control-room", "billing-reconciliation"]);
    expect(visibleWorkspaces(auditor, "demo", "org-fleet-northstar", ["control-room", "billing-reconciliation"])).toEqual([]);
  });

  it("requires fresh step-up assurance for governed approval", () => {
    const finance = demoPrincipals.find(({ principalId }) => principalId === "principal-finance")!;
    const request = { principal: finance, environment: "demo" as const, activeOrganisationId: "org-fuelcap-global", workspace: "billing-reconciliation" as const, verb: "approve" as const, actionOwnerPrincipalId: "another-principal", reconciled: true, priceValid: true, requiresStepUp: true };
    expect(evaluateGovernedAction({ ...request, assurance: "standard" }).reasonCode).toBe("REQUIRE_STEP_UP");
    expect(evaluateGovernedAction({ ...request, assurance: "step-up" }).reasonCode).toBe("ALLOW");
  });

  it("blocks governed actions when integrity state is invalid", () => {
    const risk = demoPrincipals.find(({ principalId }) => principalId === "principal-risk")!;
    expect(evaluateGovernedAction({ principal: risk, environment: "demo", activeOrganisationId: "org-fuelcap-global", workspace: "spread-fx", verb: "approve", actionOwnerPrincipalId: "another-principal", reconciled: true, priceValid: false, requiresStepUp: true, assurance: "step-up" }).reasonCode).toBe("DENY_INVALID_STATE");
  });

  it("never lets break-glass override protected invariants", () => {
    const platformAdmin: Principal = { principalId: "principal-platform", name: "Priya Adams", email: "priya.adams@fuelcap.example", roles: ["PA"], organisationIds: ["org-fuelcap-global"] };
    expect(evaluateBreakGlass({ principal: platformAdmin, environment: "demo", assurance: "step-up", requestedCapability: "validate-price" })).toEqual({ allowed: false, reasonCode: "DENY_PROTECTED_INVARIANT", incidentRequired: true });
    expect(evaluateBreakGlass({ principal: platformAdmin, environment: "demo", assurance: "step-up", requestedCapability: "temporary-support-access" }).reasonCode).toBe("ALLOW_INCIDENT_OPENED");
  });

  it("denies guessed and cross-organisation resource identifiers", () => {
    expect(authorizeTenantResource({ principal: operations, environment: "demo", activeOrganisationId: "org-fleet-northstar", resourceOrganisationId: "guessed-org-id", workspace: "customers" }).reasonCode).toBe("DENY_TENANT_CONTEXT");
    expect(authorizeTenantResource({ principal: operations, environment: "demo", activeOrganisationId: "org-personal-a", resourceOrganisationId: "org-fleet-northstar", workspace: "customers" }).reasonCode).toBe("DENY_TENANT_CONTEXT");
    expect(authorizeTenantResource({ principal: operations, environment: "demo", activeOrganisationId: "org-fleet-northstar", resourceOrganisationId: "org-fleet-northstar", workspace: "customers" }).reasonCode).toBe("ALLOW");
  });

  it("routes seeded domain case initiation through central workspace policy", () => {
    const compliance = demoPrincipals.find(({ principalId }) => principalId === "principal-compliance")!;
    const data = demoPrincipals.find(({ principalId }) => principalId === "principal-data")!;
    const presenter = demoPrincipals.find(({ principalId }) => principalId === "principal-presenter")!;
    expect(authorize({ principal: operations, environment: "demo", activeOrganisationId: "org-fuelcap-global", workspace: "billing-reconciliation", verb: "initiate" }).allowed).toBe(true);
    expect(authorize({ principal: compliance, environment: "demo", activeOrganisationId: "org-fuelcap-global", workspace: "fraud-cases", verb: "initiate" }).allowed).toBe(true);
    expect(authorize({ principal: data, environment: "demo", activeOrganisationId: "org-fuelcap-global", workspace: "pricing-data", verb: "initiate" }).allowed).toBe(true);
    expect(authorize({ principal: presenter, environment: "demo", activeOrganisationId: "org-fuelcap-global", workspace: "fraud-cases", verb: "initiate" }).allowed).toBe(false);
  });
});
