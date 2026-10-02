import type { AuthConfig } from "./config";
import { IDLE_COOKIE, IDLE_TIMEOUT_MS, STEP_UP_COOKIE, STEP_UP_WINDOW_SECONDS } from "./config";
import { sign, type IdleClock, type StepUpGrant } from "./signed-cookie";

type CookieJar = { set: (name: string, value: string, options: Record<string, unknown>) => unknown };
const base = (config: AuthConfig) => ({ httpOnly: true, sameSite: "lax" as const, secure: config.secureCookies, path: "/" });

/** Restart the 30-minute inactivity clock for this Supabase session. */
export function touchIdleClock(jar: CookieJar, config: AuthConfig, sessionId: string, now = Date.now()) {
  const clock: IdleClock = { sid: sessionId, last: now };
  jar.set(IDLE_COOKIE, sign(clock, config.sessionSecret), { ...base(config), maxAge: Math.ceil(IDLE_TIMEOUT_MS / 1000) + 60 });
}

export function grantStepUp(jar: CookieJar, config: AuthConfig, sub: string, sessionId: string, nowSeconds = Math.floor(Date.now() / 1000)) {
  const grant: StepUpGrant = { sub, sid: sessionId, iat: nowSeconds, exp: nowSeconds + STEP_UP_WINDOW_SECONDS };
  jar.set(STEP_UP_COOKIE, sign(grant, config.sessionSecret), { ...base(config), maxAge: STEP_UP_WINDOW_SECONDS });
}

export function clearAdminCookies(jar: CookieJar, config: AuthConfig) {
  for (const name of [IDLE_COOKIE, STEP_UP_COOKIE]) jar.set(name, "", { ...base(config), maxAge: 0 });
}
