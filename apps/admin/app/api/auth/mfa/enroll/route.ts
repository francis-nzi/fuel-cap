import { NextResponse, type NextRequest } from "next/server";
import { audit, requestMeta } from "@/lib/auth/audit";
import type { AuthClaims } from "@/lib/auth/claims";
import { authConfig, MFA_ISSUER } from "@/lib/auth/config";
import { totpFactors } from "@/lib/auth/mfa";
import { createRouteClient } from "@/lib/auth/supabase";

export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "no-store" };

/**
 * Starts authenticator-app enrolment. With a password-only session this is only allowed when the account has no
 * authenticator yet (first sign-in). Adding a second (backup) authenticator needs a full aal2 session.
 */
export async function POST(request: NextRequest) {
  const config = authConfig();
  if (!config) return NextResponse.json({ error: "AUTH_NOT_CONFIGURED" }, { status: 503, headers: noStore });
  const supabase = await createRouteClient(config);
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims as AuthClaims | undefined;
  if (!claims?.sub) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401, headers: noStore });

  const factors = await totpFactors(supabase);
  if (factors.verified.length > 0 && claims.aal !== "aal2") return NextResponse.json({ error: "MFA_REQUIRED" }, { status: 403, headers: noStore });
  // Drop abandoned, never-verified enrolments so the new QR code is the only pending one.
  for (const factor of factors.unverified) await supabase.auth.mfa.unenroll({ factorId: factor.id });

  const friendlyName = `Authenticator ${factors.verified.length + 1} · ${new Date().toISOString().slice(0, 10)}`;
  const { data: enrolment, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName, issuer: MFA_ISSUER });
  if (error || !enrolment) return NextResponse.json({ error: "ENROL_FAILED" }, { status: 400, headers: noStore });
  await audit(config, "MFA_ENROLL_STARTED", "info", { userId: claims.sub, email: claims.email }, requestMeta(request.headers), { factorId: enrolment.id, additional: factors.verified.length > 0 });
  return NextResponse.json({ factorId: enrolment.id, qrCode: enrolment.totp.qr_code, secret: enrolment.totp.secret, uri: enrolment.totp.uri }, { headers: noStore });
}
