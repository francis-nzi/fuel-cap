"use client";

import { EnrolAuthenticator, VerifyAuthenticator } from "@/components/auth/mfa-forms";
import { hardNavigate } from "@/components/auth/session-timer";

export function MfaStep({ enrol }: { enrol: boolean }) {
  return enrol ? <EnrolAuthenticator onDone={() => hardNavigate("/")} /> : <VerifyAuthenticator />;
}
