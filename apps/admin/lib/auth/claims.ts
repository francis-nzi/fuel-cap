import { STEP_UP_WINDOW_SECONDS } from "./config";
import type { StepUpGrant } from "./signed-cookie";

export type AuthClaims = {
  sub: string;
  email?: string;
  aal?: "aal1" | "aal2";
  amr?: { method: string; timestamp: number }[];
  session_id?: string;
  exp?: number;
};

/** Reads a token Supabase has just issued to this server (not for validating incoming tokens: use getClaims). */
export function decodeIssuedToken(accessToken: string): AuthClaims {
  return JSON.parse(Buffer.from(accessToken.split(".")[1] ?? "", "base64url").toString("utf8")) as AuthClaims;
}

/** When this session last passed an authenticator-app check (seconds since epoch), per Supabase's amr claim. */
export function totpVerifiedAt(claims: AuthClaims): number | null {
  const times = (claims.amr ?? []).filter((entry) => entry.method === "totp").map((entry) => entry.timestamp);
  return times.length ? Math.max(...times) : null;
}

/**
 * A step-up is fresh when the server issued a grant for this user and session within the last five minutes
 * AND Supabase's own token shows a TOTP verification at (or after) that moment. The sign-in MFA check alone
 * never counts: the grant is only issued by the step-up endpoint.
 */
export function hasFreshStepUp(claims: AuthClaims, grant: StepUpGrant | null, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (!grant || grant.sub !== claims.sub || grant.sid !== claims.session_id) return false;
  if (nowSeconds > grant.exp || grant.exp - grant.iat > STEP_UP_WINDOW_SECONDS) return false;
  const verifiedAt = totpVerifiedAt(claims);
  return verifiedAt !== null && verifiedAt >= grant.iat - 5 && nowSeconds - verifiedAt <= STEP_UP_WINDOW_SECONDS;
}
