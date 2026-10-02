import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignOutLink } from "@/components/auth/sign-out-link";
import type { AuthClaims } from "@/lib/auth/claims";
import { authConfig } from "@/lib/auth/config";
import { totpFactors } from "@/lib/auth/mfa";
import { createRouteClient } from "@/lib/auth/supabase";
import { MfaStep } from "./mfa-step";

export const dynamic = "force-dynamic";

/** Sign-in step 2. Without an authenticator yet, enrolment is forced before anything else is reachable. */
export default async function MfaPage() {
  const config = authConfig();
  if (!config) redirect("/login?error=AUTH_NOT_CONFIGURED");
  const supabase = await createRouteClient(config);
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims as AuthClaims | undefined;
  if (!claims?.sub) redirect("/login");
  if (claims.aal === "aal2") redirect("/");
  const { verified } = await totpFactors(supabase);
  const enrol = verified.length === 0;
  return (
    <AuthShell
      title={enrol ? "Set up your authenticator app" : "Enter your authenticator code"}
      lead={enrol ? "Every control-room account needs an authenticator app. It takes about a minute." : "Open your authenticator app and enter the current 6-digit code for FuelCap Control Room."}
    >
      <MfaStep enrol={enrol} />
      <SignOutLink />
    </AuthShell>
  );
}
