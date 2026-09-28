import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { audit, requestMeta } from "@/lib/auth/audit";
import { decodeIssuedToken } from "@/lib/auth/claims";
import { authConfig } from "@/lib/auth/config";
import { touchIdleClock } from "@/lib/auth/cookies";
import { getStaffRecordAsService } from "@/lib/auth/store";
import { createRouteClient } from "@/lib/auth/supabase";

export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "no-store" };

/** Email + password sign-in (step 1 of 2). Staff only; the session must still pass MFA before any page opens. */
export async function POST(request: NextRequest) {
  const config = authConfig();
  if (!config) return NextResponse.json({ error: "AUTH_NOT_CONFIGURED" }, { status: 503, headers: noStore });
  const meta = requestMeta(request.headers);
  let body: { email?: unknown; password?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "INVALID_JSON" }, { status: 400, headers: noStore }); }
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || !password) return NextResponse.json({ error: "INVALID_CREDENTIALS" }, { status: 400, headers: noStore });

  const supabase = await createRouteClient(config);
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.session || !data.user) {
    await audit(config, "SIGN_IN_FAILED", "failure", { email }, meta, { reason: error?.code ?? error?.message ?? "no_session" });
    return NextResponse.json({ error: "INVALID_CREDENTIALS" }, { status: 401, headers: noStore });
  }

  const staff = await getStaffRecordAsService(config, data.user.id).catch(() => null);
  if (!staff?.active) {
    await supabase.auth.signOut({ scope: "local" });
    await audit(config, "SIGN_IN_DENIED_NOT_STAFF", "denied", { userId: data.user.id, email }, meta);
    return NextResponse.json({ error: "INVALID_CREDENTIALS" }, { status: 401, headers: noStore });
  }

  const sessionId = decodeIssuedToken(data.session.access_token).session_id;
  if (sessionId) touchIdleClock(await cookies(), config, sessionId);
  const hasAuthenticator = (data.user.factors ?? []).some((factor) => factor.factor_type === "totp" && factor.status === "verified");
  await audit(config, "SIGN_IN_SUCCEEDED", "success", { userId: data.user.id, email }, meta, { next: hasAuthenticator ? "mfa_verify" : "mfa_enroll" });
  return NextResponse.json({ next: "/mfa" }, { headers: noStore });
}
