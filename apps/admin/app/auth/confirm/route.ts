import type { EmailOtpType } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { decodeIssuedToken } from "@/lib/auth/claims";
import { authConfig } from "@/lib/auth/config";
import { touchIdleClock } from "@/lib/auth/cookies";
import { redirectTo } from "@/lib/auth/redirect";
import { createRouteClient } from "@/lib/auth/supabase";

export const dynamic = "force-dynamic";
const allowedTypes: EmailOtpType[] = ["invite", "recovery"];

/**
 * Target of the invite and password-reset emails (see docs/ADMIN_AUTH.md for the email template). It opens a
 * password-only session that can do nothing except set a password and pass MFA.
 */
export async function GET(request: NextRequest) {
  const config = authConfig();
  if (!config) return NextResponse.json({ error: "AUTH_NOT_CONFIGURED" }, { status: 503 });
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type") as EmailOtpType | null;
  if (!tokenHash || !type || !allowedTypes.includes(type)) return redirectTo(request, "/login?error=LINK_INVALID");
  const supabase = await createRouteClient(config);
  const { data, error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error || !data.session) return redirectTo(request, "/login?error=LINK_INVALID");
  const sessionId = decodeIssuedToken(data.session.access_token).session_id;
  if (sessionId) touchIdleClock(await cookies(), config, sessionId);
  return redirectTo(request, "/auth/set-password");
}
