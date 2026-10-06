import "server-only";
import type { createRouteClient } from "./supabase";

type Client = Awaited<ReturnType<typeof createRouteClient>>;
export const isSixDigitCode = (value: unknown): value is string => typeof value === "string" && /^\d{6}$/.test(value);

/** The user's authenticator-app factors, split into verified and not-yet-verified. */
export async function totpFactors(supabase: Client) {
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) throw error;
  const all = (data?.all ?? []).filter((factor) => factor.factor_type === "totp");
  return { verified: all.filter((factor) => factor.status === "verified"), unverified: all.filter((factor) => factor.status !== "verified") };
}

/**
 * Why a code check failed, in terms the person can act on. Only WRONG_CODE means the code itself was wrong; the
 * others used to be shown as "That code didn't match" too, which hid the real problem.
 */
export type VerifyFailure = "WRONG_CODE" | "SETUP_EXPIRED" | "TOO_MANY_ATTEMPTS" | "SESSION_EXPIRED" | "VERIFY_UNAVAILABLE";
export type SupabaseError = { code?: string | null; status?: number | null; message?: string | null };

/** Maps a Supabase Auth error from challenge/verify to a VerifyFailure. Unknown errors are never shown as a wrong code. */
export function classifyVerifyError(error: SupabaseError): VerifyFailure {
  const code = error.code ?? "";
  if (code === "mfa_verification_failed" || (!code && /invalid totp/i.test(error.message ?? ""))) return "WRONG_CODE";
  if (["mfa_challenge_expired", "mfa_factor_not_found", "mfa_verification_rejected"].includes(code)) return "SETUP_EXPIRED";
  if (code.startsWith("over_") || error.status === 429) return "TOO_MANY_ATTEMPTS";
  if (["session_not_found", "session_expired", "bad_jwt", "no_authorization", "user_not_found", "refresh_token_not_found"].includes(code)) return "SESSION_EXPIRED";
  return "VERIFY_UNAVAILABLE";
}

/** When several factors were tried (sign-in, step-up), report the most useful reason: anything beats WRONG_CODE. */
export function mostUsefulFailure<T extends { reason: VerifyFailure }>(failures: T[]): T {
  return failures.find((failure) => failure.reason !== "WRONG_CODE") ?? failures[0];
}

/** HTTP status and API error code for each failure. WRONG_CODE keeps the existing INVALID_CODE error. */
export const failureResponse: Record<VerifyFailure, { status: number; error: string }> = {
  WRONG_CODE: { status: 401, error: "INVALID_CODE" },
  SETUP_EXPIRED: { status: 409, error: "SETUP_EXPIRED" },
  TOO_MANY_ATTEMPTS: { status: 429, error: "TOO_MANY_ATTEMPTS" },
  SESSION_EXPIRED: { status: 401, error: "SESSION_EXPIRED" },
  VERIFY_UNAVAILABLE: { status: 502, error: "VERIFY_UNAVAILABLE" },
};

/**
 * Checks a code against one factor. Supabase raises the session to aal2 on success. If Supabase reports that the
 * challenge and the verify came from different IP addresses (possible behind a host with several outbound
 * addresses), it tries once more with a new challenge; the same code is still valid.
 */
export async function verifyCode(supabase: Client, factorId: string, code: string) {
  const first = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
  if (first.error?.code !== "mfa_ip_address_mismatch") return first;
  return supabase.auth.mfa.challengeAndVerify({ factorId, code });
}

/**
 * Server log line for a failed check: Supabase's error code and status, and the first 8 characters of the factor
 * id. Never the 6-digit code, the secret or tokens.
 */
export function logVerifyFailure(stage: string, factorId: string | null, error: SupabaseError) {
  console.warn(`[mfa] ${stage} verify failed: factor=${factorId?.slice(0, 8) ?? "none"} supabase_code=${error.code ?? "none"} supabase_status=${error.status ?? "none"}`);
}
