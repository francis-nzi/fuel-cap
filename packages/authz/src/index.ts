export const AUTHZ_POLICY_VERSION = "admin-authz-demo-1.0.0" as const;

export const roleCodes = ["PA", "OP", "RT", "FR", "CF", "CS", "DI", "AU", "DP"] as const;
export type RoleCode = (typeof roleCodes)[number];
export type Verb = "view" | "recommend" | "initiate" | "approve" | "execute" | "export";
export type Environment = "demo" | "staging" | "production";
export type Workspace =
  | "control-room" | "living-operations" | "customers-fleets" | "pricing-data"
  | "spread-engine" | "fx-engine" | "protection-hedging" | "ledger-wallet"
  | "settlement-recon" | "billing-xero" | "risk-fraud-compliance" | "rules-ai-governance";

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
  "living-operations": V,
  "customers-fleets": V,
  "pricing-data": V,
  "spread-engine": V,
  "fx-engine": V,
  "protection-hedging": V,
  "ledger-wallet": V,
  "settlement-recon": V,
  "billing-xero": V,
  "risk-fraud-compliance": V,
  "rules-ai-governance": V,
};

const baseline: Record<RoleCode, Partial<Record<Workspace, readonly Verb[]>>> = {
  PA: { "control-room": VR, "living-operations": VR, "customers-fleets": ["view", "initiate"], "pricing-data": V, "spread-engine": V, "fx-engine": V, "protection-hedging": V, "ledger-wallet": V, "settlement-recon": V, "billing-xero": V, "risk-fraud-compliance": V, "rules-ai-governance": ["view", "initiate", "approve"] },
  OP: { "control-room": VRI, "living-operations": VRI, "customers-fleets": VRI, "pricing-data": V, "spread-engine": V, "fx-engine": V, "protection-hedging": VR, "ledger-wallet": VRI, "settlement-recon": VRI, "billing-xero": ["view", "initiate"], "risk-fraud-compliance": ["view", "initiate"], "rules-ai-governance": VR },
  RT: { "control-room": VRI, "living-operations": VRI, "customers-fleets": V, "pricing-data": VRIA, "spread-engine": VRIA, "fx-engine": VRIA, "protection-hedging": ALL, "ledger-wallet": V, "settlement-recon": VR, "billing-xero": V, "risk-fraud-compliance": VR, "rules-ai-governance": VRIA },
  FR: { "control-room": VRI, "living-operations": VR, "customers-fleets": V, "pricing-data": V, "spread-engine": VR, "fx-engine": VR, "protection-hedging": VR, "ledger-wallet": VRIA, "settlement-recon": ALL, "billing-xero": ALL, "risk-fraud-compliance": V, "rules-ai-governance": VRI },
  CF: { "control-room": VRI, "living-operations": VR, "customers-fleets": VRIA, "pricing-data": V, "spread-engine": V, "fx-engine": V, "protection-hedging": VR, "ledger-wallet": V, "settlement-recon": V, "billing-xero": V, "risk-fraud-compliance": ALL, "rules-ai-governance": VRIA },
  CS: { "control-room": V, "living-operations": V, "customers-fleets": VRI, "pricing-data": V, "ledger-wallet": V, "settlement-recon": V, "billing-xero": V, "risk-fraud-compliance": ["view", "initiate"], "rules-ai-governance": V },
  DI: { "control-room": VRI, "living-operations": VRI, "customers-fleets": V, "pricing-data": ["view", "recommend", "initiate", "execute"], "spread-engine": V, "fx-engine": V, "protection-hedging": V, "ledger-wallet": V, "settlement-recon": V, "billing-xero": V, "risk-fraud-compliance": V, "rules-ai-governance": VRI },
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
  { principalId: "principal-presenter", name: "Francis Doherty", email: "francis.doherty@fuelcap.example", roles: ["DP"], organisationIds: allOrganisations },
  { principalId: "principal-operations", name: "Olivia Patel", email: "olivia.patel@fuelcap.example", roles: ["OP"], organisationIds: allOrganisations },
  { principalId: "principal-risk", name: "Ravi Singh", email: "ravi.singh@fuelcap.example", roles: ["RT"], organisationIds: allOrganisations },
  { principalId: "principal-finance", name: "Farah Morgan", email: "farah.morgan@fuelcap.example", roles: ["FR"], organisationIds: allOrganisations },
  { principalId: "principal-compliance", name: "Chloe Bennett", email: "chloe.bennett@fuelcap.example", roles: ["CF"], organisationIds: allOrganisations },
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
