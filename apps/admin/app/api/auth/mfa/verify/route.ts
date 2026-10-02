import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { audit, requestMeta } from "@/lib/auth/audit";
import { decodeIssuedToken, type AuthClaims } from "@/lib/auth/claims";
import { authConfig } from "@/lib/auth/config";
import { touchIdleClock } from "@/lib/auth/cookies";
import { isSixDigitCode, totpFactors, verifyCode } from "@/lib/auth/mfa";
import { createRouteClient } from "@/lib/auth/supabase";

export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "no-store" };

/** Checks a 6-digit authenticator code: finishes first-time enrolment, or completes sign-in (aal1 → aal2). */
export async function POST(request: NextRequest) {
  const config = authConfig();
  if (!config) return NextResponse.json({ error: "AUTH_NOT_CONFIGURED" }, { status: 503, headers: noStore });
  const meta = requestMeta(request.headers);
  const supabase = await createRouteClient(config);
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims as AuthClaims | undefined;
  if (!claims?.sub) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401, headers: noStore });

  let body: { factorId?: unknown; code?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "INVALID_JSON" }, { status: 400, headers: noStore }); }
  if (!isSixDigitCode(body.code)) return NextResponse.json({ error: "INVALID_CODE" }, { status: 400, headers: noStore });

  const factors = await totpFactors(supabase);
  const pending = typeof body.factorId === "string" ? factors.unverified.find((factor) => factor.id === body.factorId) : undefined;
  // First-time enrolment only verifies the pending factor; otherwise any of the user's verified authenticators.
  const candidates = pending ? [pending] : factors.verified;
  if (!candidates.length) return NextResponse.json({ error: "NO_AUTHENTICATOR" }, { status: 400, headers: noStore });

  let result: Awaited<ReturnType<typeof verifyCode>> | null = null;
  for (const factor of candidates) {
    result = await verifyCode(supabase, factor.id, body.code);
    if (!result.error) break;
  }
  if (!result || result.error || !result.data) {
    await audit(config, "MFA_VERIFY_FAILED", "failure", { userId: claims.sub, email: claims.email }, meta, { stage: pending ? "enrol" : "sign_in" });
    return NextResponse.json({ error: "INVALID_CODE" }, { status: 401, headers: noStore });
  }
  const sessionId = decodeIssuedToken(result.data.access_token).session_id ?? claims.session_id;
  if (sessionId) touchIdleClock(await cookies(), config, sessionId);
  await audit(config, pending ? "MFA_ENROLLED" : "MFA_VERIFY_SUCCEEDED", "success", { userId: claims.sub, email: claims.email }, meta, pending ? { factorId: pending.id } : {});
  return NextResponse.json({ next: "/" }, { headers: noStore });
}
