import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { audit, requestMeta } from "@/lib/auth/audit";
import { decodeIssuedToken } from "@/lib/auth/claims";
import { STEP_UP_WINDOW_SECONDS } from "@/lib/auth/config";
import { grantStepUp } from "@/lib/auth/cookies";
import { requireStaffApi } from "@/lib/auth/guard";
import { isSixDigitCode, totpFactors, verifyCode } from "@/lib/auth/mfa";

export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "no-store" };

/**
 * Step-up: a fresh authenticator code, checked by Supabase now, grants 5 minutes for step-up-protected actions
 * (hedging, price validation, emergency access, inviting staff). The sign-in MFA check never counts.
 */
export async function POST(request: NextRequest) {
  const context = await requireStaffApi();
  if (context instanceof NextResponse) return context;
  const { config, supabase, claims } = context;
  const meta = requestMeta(request.headers);
  let body: { code?: unknown; action?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "INVALID_JSON" }, { status: 400, headers: noStore }); }
  const action = typeof body.action === "string" ? body.action.slice(0, 60) : "unspecified";
  if (!isSixDigitCode(body.code)) return NextResponse.json({ error: "INVALID_CODE" }, { status: 400, headers: noStore });

  const { verified } = await totpFactors(supabase);
  let verifiedAccessToken: string | null = null;
  for (const factor of verified) {
    const result = await verifyCode(supabase, factor.id, body.code);
    if (!result.error && result.data) { verifiedAccessToken = result.data.access_token; break; }
  }
  if (!verifiedAccessToken) {
    await audit(config, "STEP_UP_FAILED", "failure", { userId: claims.sub, email: claims.email }, meta, { action });
    return NextResponse.json({ error: "INVALID_CODE" }, { status: 401, headers: noStore });
  }
  const sessionId = decodeIssuedToken(verifiedAccessToken).session_id ?? claims.session_id ?? "";
  grantStepUp(await cookies(), config, claims.sub, sessionId);
  await audit(config, "STEP_UP_SUCCEEDED", "success", { userId: claims.sub, email: claims.email }, meta, { action, validForSeconds: STEP_UP_WINDOW_SECONDS });
  return NextResponse.json({ ok: true, validForSeconds: STEP_UP_WINDOW_SECONDS }, { headers: noStore });
}
