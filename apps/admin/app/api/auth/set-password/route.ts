import { NextResponse, type NextRequest } from "next/server";
import { audit, requestMeta } from "@/lib/auth/audit";
import type { AuthClaims } from "@/lib/auth/claims";
import { authConfig } from "@/lib/auth/config";
import { totpFactors } from "@/lib/auth/mfa";
import { createRouteClient } from "@/lib/auth/supabase";

export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "no-store" };
const MIN_PASSWORD_LENGTH = 12;

/** After accepting an invite (or a password-reset link): choose a password, then enrol or pass MFA. */
export async function POST(request: NextRequest) {
  const config = authConfig();
  if (!config) return NextResponse.json({ error: "AUTH_NOT_CONFIGURED" }, { status: 503, headers: noStore });
  const supabase = await createRouteClient(config);
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims as AuthClaims | undefined;
  if (!claims?.sub) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401, headers: noStore });
  // A stolen password alone must not be able to change the password: only a session opened from an email link
  // (invite / reset), an account with no authenticator yet, or a fully MFA-verified session may set one.
  const fromEmailLink = (claims.amr ?? []).some((entry) => ["otp", "invite", "recovery", "magiclink"].includes(entry.method));
  const { verified } = await totpFactors(supabase);
  if (claims.aal !== "aal2" && verified.length > 0 && !fromEmailLink) return NextResponse.json({ error: "MFA_REQUIRED" }, { status: 403, headers: noStore });
  let body: { password?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "INVALID_JSON" }, { status: 400, headers: noStore }); }
  const password = typeof body.password === "string" ? body.password : "";
  if (password.length < MIN_PASSWORD_LENGTH) return NextResponse.json({ error: "PASSWORD_TOO_SHORT", minimum: MIN_PASSWORD_LENGTH }, { status: 400, headers: noStore });
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return NextResponse.json({ error: "PASSWORD_REJECTED", detail: error.message }, { status: 400, headers: noStore });
  await audit(config, "PASSWORD_SET", "success", { userId: claims.sub, email: claims.email }, requestMeta(request.headers));
  return NextResponse.json({ next: "/mfa" }, { headers: noStore });
}
