import { authorize, evaluateBreakGlass, evaluateGovernedAction } from "@fuelcap/authz";
import { NextResponse, type NextRequest } from "next/server";
import { audit, requestMeta } from "@/lib/auth/audit";
import { authzEnvironment } from "@/lib/auth/config";
import { requireStaffApi } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "no-store" };

const actions = ["initiate-hedge", "approve-hedge", "validate-price", "emergency-access"] as const;
type GovernedAction = (typeof actions)[number];
// The simulated maker of the hedge awaiting approval (maker-checker: a different person must approve).
const HEDGE_MAKER_ID = "principal-risk-maker";

/**
 * Step-up-protected actions. The role check comes from @fuelcap/authz using the signed-in person's server-held
 * roles; "step-up" assurance is only claimed when this session holds a fresh (≤5 min) step-up grant.
 */
export async function POST(request: NextRequest) {
  const context = await requireStaffApi();
  if (context instanceof NextResponse) return context;
  const { config, principal, claims, stepUpFresh } = context;
  const meta = requestMeta(request.headers);
  let body: { action?: unknown; organisationId?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "INVALID_JSON" }, { status: 400, headers: noStore }); }
  const action = body.action as GovernedAction;
  if (!actions.includes(action)) return NextResponse.json({ error: "UNKNOWN_ACTION" }, { status: 400, headers: noStore });
  const activeOrganisationId = typeof body.organisationId === "string" ? body.organisationId : "org-fuelcap-global";
  const environment = authzEnvironment();
  const assurance = stepUpFresh ? "step-up" as const : "standard" as const;
  const who = { userId: claims.sub, email: claims.email };

  let allowed = false;
  let reasonCode: string;
  if (action === "initiate-hedge" || action === "approve-hedge") {
    const verb = action === "initiate-hedge" ? "initiate" as const : "approve" as const;
    // Refuse people who could never do this before asking them for a code.
    const policy = authorize({ principal, environment, activeOrganisationId, workspace: "risk-hedging", verb, actionOwnerPrincipalId: verb === "approve" ? HEDGE_MAKER_ID : undefined });
    if (!policy.allowed) {
      await audit(config, "GOVERNED_ACTION_DENIED", "denied", who, meta, { action, reasonCode: policy.reasonCode });
      return NextResponse.json({ allowed: false, reasonCode: policy.reasonCode }, { status: 403, headers: noStore });
    }
    if (!stepUpFresh) return NextResponse.json({ error: "STEP_UP_REQUIRED" }, { status: 428, headers: noStore });
    const decision = evaluateGovernedAction({ principal, environment, activeOrganisationId, workspace: "risk-hedging", verb, actionOwnerPrincipalId: verb === "approve" ? HEDGE_MAKER_ID : undefined, reconciled: true, priceValid: true, requiresStepUp: true, assurance });
    allowed = decision.allowed;
    reasonCode = decision.reasonCode;
  } else {
    // Break-glass requests are exceptional: the attempt itself needs a fresh step-up before it is evaluated.
    if (!stepUpFresh) return NextResponse.json({ error: "STEP_UP_REQUIRED" }, { status: 428, headers: noStore });
    const decision = evaluateBreakGlass({ principal, environment, assurance, requestedCapability: action === "validate-price" ? "validate-price" : "temporary-support-access" });
    allowed = decision.allowed;
    reasonCode = decision.reasonCode;
  }
  await audit(config, allowed ? "GOVERNED_ACTION_ALLOWED" : "GOVERNED_ACTION_DENIED", allowed ? "success" : "denied", who, meta, { action, reasonCode, assurance, activeOrganisationId });
  return NextResponse.json({ allowed, reasonCode }, { status: allowed ? 200 : 403, headers: noStore });
}
