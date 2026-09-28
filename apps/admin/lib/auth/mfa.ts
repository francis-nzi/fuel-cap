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

/** Checks a code against one of the user's verified authenticators. Supabase raises the session to aal2 on success. */
export async function verifyCode(supabase: Client, factorId: string, code: string) {
  return supabase.auth.mfa.challengeAndVerify({ factorId, code });
}
