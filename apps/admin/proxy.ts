import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { audit, requestMeta } from "@/lib/auth/audit";
import type { AuthClaims } from "@/lib/auth/claims";
import { authConfig, IDLE_COOKIE, IDLE_TIMEOUT_MS, type AuthConfig } from "@/lib/auth/config";
import { clearAdminCookies, touchIdleClock } from "@/lib/auth/cookies";
import { redirectTo } from "@/lib/auth/redirect";
import { verify, type IdleClock } from "@/lib/auth/signed-cookie";

/**
 * Gate for the whole control room: every page and every /api/* route needs a verified Supabase session at
 * aal2 (password + authenticator app). Route handlers and pages re-check this themselves (see lib/auth/guard).
 */

// Reachable without a session. /api/health stays open because Render's health check can't sign in.
const PUBLIC_PATHS = new Set(["/login", "/auth/confirm", "/api/health", "/api/auth/sign-in"]);
// Reachable with a password-only (aal1) session, to finish setting a password and passing MFA.
const PRE_MFA_PATHS = new Set(["/mfa", "/auth/set-password", "/api/auth/set-password", "/api/auth/mfa/enroll", "/api/auth/mfa/verify", "/api/auth/sign-out"]);

type Denial = "AUTH_NOT_CONFIGURED" | "UNAUTHENTICATED" | "SESSION_EXPIRED" | "MFA_REQUIRED";
const pageFor: Record<Denial, string> = { AUTH_NOT_CONFIGURED: "", UNAUTHENTICATED: "/login", SESSION_EXPIRED: "/login?reason=timeout", MFA_REQUIRED: "/mfa" };
const statusFor: Record<Denial, number> = { AUTH_NOT_CONFIGURED: 503, UNAUTHENTICATED: 401, SESSION_EXPIRED: 401, MFA_REQUIRED: 403 };

function deny(request: NextRequest, reason: Denial, carry?: NextResponse) {
  const isApi = request.nextUrl.pathname.startsWith("/api/");
  const response = isApi || reason === "AUTH_NOT_CONFIGURED"
    ? NextResponse.json({ error: reason }, { status: statusFor[reason], headers: { "Cache-Control": "no-store" } })
    : redirectTo(request, pageFor[reason]);
  carry?.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
  return response;
}

/** Page loads, form posts and explicit activity pings count as activity; background polling (GET /api/*) doesn't. */
function isUserActivity(request: NextRequest) {
  if (request.method !== "GET" && request.method !== "HEAD") return true;
  return request.headers.get("sec-fetch-dest") === "document" || !request.nextUrl.pathname.startsWith("/api/");
}

function sessionCookieOptions(config: AuthConfig) {
  return { httpOnly: true, sameSite: "lax" as const, secure: config.secureCookies, path: "/" };
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // State-changing requests must come from this site (cross-site request forgery guard, on top of SameSite cookies).
  const origin = request.headers.get("origin");
  if (request.method !== "GET" && request.method !== "HEAD" && origin && new URL(origin).host !== request.headers.get("host")) {
    return NextResponse.json({ error: "CROSS_SITE_REQUEST" }, { status: 403 });
  }
  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();
  const config = authConfig();
  if (!config) return deny(request, "AUTH_NOT_CONFIGURED");

  let response = NextResponse.next({ request });
  const supabase = createServerClient(config.url, config.anonKey, {
    cookieOptions: sessionCookieOptions(config),
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, { ...options, ...sessionCookieOptions(config) }));
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims as AuthClaims | undefined;
  if (!claims?.sub || !claims.session_id) return deny(request, "UNAUTHENTICATED", response);

  // 30 minutes without user activity ends the session, server-side.
  const now = Date.now();
  const clock = verify<IdleClock>(request.cookies.get(IDLE_COOKIE)?.value, config.sessionSecret);
  if (!clock || clock.sid !== claims.session_id || now - clock.last > IDLE_TIMEOUT_MS) {
    await supabase.auth.signOut({ scope: "local" });
    await audit(config, "SESSION_TIMEOUT", "info", { userId: claims.sub, email: claims.email }, requestMeta(request.headers), {
      reason: !clock ? "no_activity_clock" : clock.sid !== claims.session_id ? "session_mismatch" : "inactive_30_minutes",
      idleMinutes: clock ? Math.round((now - clock.last) / 60_000) : null,
    });
    clearAdminCookies(response.cookies, config);
    return deny(request, "SESSION_EXPIRED", response);
  }

  if (claims.aal !== "aal2" && !PRE_MFA_PATHS.has(pathname)) return deny(request, "MFA_REQUIRED", response);
  if (claims.aal === "aal2" && pathname === "/mfa") {
    const home = redirectTo(request, "/");
    response.cookies.getAll().forEach((cookie) => home.cookies.set(cookie));
    return home;
  }

  if (isUserActivity(request)) touchIdleClock(response.cookies, config, claims.session_id, now);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|fuelcap-mark.svg).*)"],
};
