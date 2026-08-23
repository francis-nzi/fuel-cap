export const AUTHZ_POLICY_VERSION = "admin-authz-demo-1.0.0" as const;

export const roleCodes = ["PA", "OP", "RT", "FR", "CF", "CS", "DI", "AU", "DP"] as const;
export type RoleCode = (typeof roleCodes)[number];
export type Verb = "view" | "recommend" | "initiate" | "approve" | "execute" | "export";
export type Environment = "demo" | "staging" | "production";
export type Workspace =
  | "control-room" | "customers" | "fleets-vehicles" | "pricing-data"
  | "spread-fx" | "risk-hedging" | "transactions-ledger" | "billing-reconciliation"
  | "fraud-cases" | "rules-automation" | "communications" | "platform-integrations-audit";

export type Organisation = Readonly<{
  organisationId: string;
  name: string;
  type: "fuelcap" | "personal" | "fleet";
  market: "GLOBAL" | "US" | "UK" | "CA";
}>;

export type Principal = Readonly<{
  principalId: string;
  name: string;
  email: string;
  roles: readonly RoleCode[];
  organisationIds: readonly string[];
}>;

export type AuthorizationRequest = Readonly<{
  principal: Principal;
  environment: Environment;
  activeOrganisationId: string;
  workspace: Workspace;
  verb: Verb;
  actionOwnerPrincipalId?: string;
  assurance?: "standard" | "step-up";
}>;

export type AuthorizationDecision = Readonly<{
  allowed: boolean;
  reasonCode: "ALLOW" | "DENY_NO_MEMBERSHIP" | "DENY_DP_PRODUCTION" | "DENY_POLICY" | "DENY_SELF_APPROVAL" | "DENY_ASSIGNMENT_CONFLICT";
  policyVersion: typeof AUTHZ_POLICY_VERSION;
}>;

const V = ["view"] as const;
const VR = ["view", "recommend"] as const;
const VRI = ["view", "recommend", "initiate"] as const;
const VRIA = ["view", "recommend", "initiate", "approve"] as const;
const ALL = ["view", "recommend", "initiate", "approve", "execute", "export"] as const;
const viewAll: Record<Workspace, readonly Verb[]> = {
  "control-room": V,
  "customers": V,
  "fleets-vehicles": V,
  "pricing-data": V,
  "spread-fx": V,
  "risk-hedging": V,
  "transactions-ledger": V,
  "billing-reconciliation": V,
  "fraud-cases": V,
  "rules-automation": V,
  "communications": V,
  "platform-integrations-audit": V,
};

const baseline: Record<RoleCode, Partial<Record<Workspace, readonly Verb[]>>> = {
  PA: { "control-room": VR, "customers": ["view", "initiate"], "fleets-vehicles": ["view", "initiate"], "pricing-data": V, "spread-fx": V, "risk-hedging": V, "transactions-ledger": V, "billing-reconciliation": V, "fraud-cases": V, "rules-automation": ["view", "initiate"], "communications": V, "platform-integrations-audit": VRIA },
  OP: { "control-room": VRI, "customers": VRI, "fleets-vehicles": VRI, "pricing-data": V, "spread-fx": V, "risk-hedging": VR, "transactions-ledger": VRI, "billing-reconciliation": ["view", "initiate"], "fraud-cases": ["view", "initiate"], "rules-automation": VR, "communications": VRI, "platform-integrations-audit": V },
  RT: { "control-room": VRI, "customers": V, "fleets-vehicles": V, "pricing-data": VRIA, "spread-fx": VRIA, "risk-hedging": ALL, "transactions-ledger": V, "billing-reconciliation": V, "fraud-cases": VR, "rules-automation": VRIA, "communications": V, "platform-integrations-audit": V },
  FR: { "control-room": VRI, "customers": V, "fleets-vehicles": V, "pricing-data": V, "spread-fx": VR, "risk-hedging": VR, "transactions-ledger": VRIA, "billing-reconciliation": ALL, "fraud-cases": V, "rules-automation": VRI, "communications": V, "platform-integrations-audit": V },
  CF: { "control-room": VRI, "customers": VRIA, "fleets-vehicles": VRIA, "pricing-data": V, "spread-fx": V, "risk-hedging": VR, "transactions-ledger": V, "billing-reconciliation": V, "fraud-cases": ALL, "rules-automation": VRIA, "communications": VRIA, "platform-integrations-audit": V },
  CS: { "control-room": V, "customers": VRI, "fleets-vehicles": VRI, "pricing-data": V, "transactions-ledger": V, "billing-reconciliation": V, "fraud-cases": ["view", "initiate"], "rules-automation": V, "communications": VRI },
  DI: { "control-room": VRI, "customers": V, "fleets-vehicles": V, "pricing-data": ["view", "recommend", "initiate", "execute"], "spread-fx": V, "risk-hedging": V, "transactions-ledger": V, "billing-reconciliation": V, "fraud-cases": V, "rules-automation": VRI, "communications": V, "platform-integrations-audit": ["view", "recommend", "initiate", "approve", "execute"] },
  AU: viewAll,
  DP: viewAll,
};

export const demoOrganisations: readonly Organisation[] = [
  { organisationId: "org-fuelcap-global", name: "FuelCap Global", type: "fuelcap", market: "GLOBAL" },
  { organisationId: "org-personal-a", name: "Alex Morgan · Personal", type: "personal", market: "US" },
  { organisationId: "org-fleet-northstar", name: "Northstar Fleet Services", type: "fleet", market: "US" },
];

const allOrganisations = demoOrganisations.map(({ organisationId }) => organisationId);
export const demoPrincipals: readonly Principal[] = [
  { principalId: "principal-platform", name: "Priya Adams", email: "priya.adams@fuelcap.example", roles: ["PA"], organisationIds: allOrganisations },
  { principalId: "principal-presenter", name: "Francis Doherty", email: "francis.doherty@fuelcap.example", roles: ["DP"], organisationIds: allOrganisations },
  { principalId: "principal-operations", name: "Olivia Patel", email: "olivia.patel@fuelcap.example", roles: ["OP"], organisationIds: allOrganisations },
  { principalId: "principal-risk", name: "Ravi Singh", email: "ravi.singh@fuelcap.example", roles: ["RT"], organisationIds: allOrganisations },
  { principalId: "principal-finance", name: "Farah Morgan", email: "farah.morgan@fuelcap.example", roles: ["FR"], organisationIds: allOrganisations },
  { principalId: "principal-compliance", name: "Chloe Bennett", email: "chloe.bennett@fuelcap.example", roles: ["CF"], organisationIds: allOrganisations },
  { principalId: "principal-support", name: "Sofia Reed", email: "sofia.reed@fuelcap.example", roles: ["CS"], organisationIds: allOrganisations },
  { principalId: "principal-data", name: "Daniel Kim", email: "daniel.kim@fuelcap.example", roles: ["DI"], organisationIds: allOrganisations },
  { principalId: "principal-auditor", name: "Avery Chen", email: "avery.chen@fuelcap.example", roles: ["AU"], organisationIds: ["org-fuelcap-global"] },
];

export function assignmentConflict(principal: Principal, environment: Environment) {
  if (environment === "production" && principal.roles.includes("DP")) return "DENY_DP_PRODUCTION" as const;
  if (principal.roles.includes("AU") && principal.roles.some((role) => role !== "AU")) return "DENY_ASSIGNMENT_CONFLICT" as const;
  if (principal.roles.includes("DP") && principal.roles.some((role) => role !== "DP")) return "DENY_ASSIGNMENT_CONFLICT" as const;
  return null;
}

export function authorize(request: AuthorizationRequest): AuthorizationDecision {
  const conflict = assignmentConflict(request.principal, request.environment);
  if (conflict) return { allowed: false, reasonCode: conflict, policyVersion: AUTHZ_POLICY_VERSION };
  if (!request.principal.organisationIds.includes(request.activeOrganisationId)) return { allowed: false, reasonCode: "DENY_NO_MEMBERSHIP", policyVersion: AUTHZ_POLICY_VERSION };
  if (request.verb === "approve" && request.actionOwnerPrincipalId === request.principal.principalId) return { allowed: false, reasonCode: "DENY_SELF_APPROVAL", policyVersion: AUTHZ_POLICY_VERSION };
  const allowed = request.principal.roles.some((role) => baseline[role][request.workspace]?.includes(request.verb));
  return { allowed, reasonCode: allowed ? "ALLOW" : "DENY_POLICY", policyVersion: AUTHZ_POLICY_VERSION };
}

export function visibleWorkspaces(principal: Principal, environment: Environment, activeOrganisationId: string, workspaces: readonly Workspace[]) {
  return workspaces.filter((workspace) => authorize({ principal, environment, activeOrganisationId, workspace, verb: "view" }).allowed);
}

export type GovernedActionDecision = Readonly<{
  allowed: boolean;
  reasonCode: "ALLOW" | "REQUIRE_STEP_UP" | "DENY_SELF_APPROVAL" | "DENY_INVALID_STATE" | "DENY_POLICY";
}>;

export function evaluateGovernedAction(request: AuthorizationRequest & Readonly<{
  reconciled: boolean;
  priceValid: boolean;
  requiresStepUp: boolean;
}>): GovernedActionDecision {
  if (!request.reconciled || !request.priceValid) return { allowed: false, reasonCode: "DENY_INVALID_STATE" };
  const policy = authorize(request);
  if (!policy.allowed) return { allowed: false, reasonCode: policy.reasonCode === "DENY_SELF_APPROVAL" ? "DENY_SELF_APPROVAL" : "DENY_POLICY" };
  if (request.requiresStepUp && request.assurance !== "step-up") return { allowed: false, reasonCode: "REQUIRE_STEP_UP" };
  return { allowed: true, reasonCode: "ALLOW" };
}

export type BreakGlassDecision = Readonly<{
  allowed: boolean;
  reasonCode: "ALLOW_INCIDENT_OPENED" | "DENY_PROTECTED_INVARIANT" | "DENY_NOT_PLATFORM_ADMIN" | "REQUIRE_STEP_UP";
  incidentRequired: boolean;
}>;

export function evaluateBreakGlass(input: Readonly<{
  principal: Principal;
  environment: Environment;
  assurance: "standard" | "step-up";
  requestedCapability: "temporary-support-access" | "validate-price" | "clear-reconciliation-break" | "self-approve";
}>): BreakGlassDecision {
  if (["validate-price", "clear-reconciliation-break", "self-approve"].includes(input.requestedCapability)) {
    return { allowed: false, reasonCode: "DENY_PROTECTED_INVARIANT", incidentRequired: true };
  }
  if (!input.principal.roles.includes("PA")) return { allowed: false, reasonCode: "DENY_NOT_PLATFORM_ADMIN", incidentRequired: true };
  if (input.assurance !== "step-up") return { allowed: false, reasonCode: "REQUIRE_STEP_UP", incidentRequired: true };
  return { allowed: true, reasonCode: "ALLOW_INCIDENT_OPENED", incidentRequired: true };
}

export function authorizeTenantResource(input: Readonly<{
  principal: Principal;
  environment: Environment;
  activeOrganisationId: string;
  resourceOrganisationId: string;
  workspace: Workspace;
}>) {
  if (input.activeOrganisationId !== input.resourceOrganisationId) {
    return { allowed: false, reasonCode: "DENY_TENANT_CONTEXT" as const };
  }
  const decision = authorize({
    principal: input.principal,
    environment: input.environment,
    activeOrganisationId: input.activeOrganisationId,
    workspace: input.workspace,
    verb: "view",
  });
  return { allowed: decision.allowed, reasonCode: decision.allowed ? "ALLOW" as const : "DENY_TENANT_CONTEXT" as const };
}
