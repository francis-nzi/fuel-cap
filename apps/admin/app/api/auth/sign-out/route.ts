import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { audit, requestMeta } from "@/lib/auth/audit";
import type { AuthClaims } from "@/lib/auth/claims";
import { authConfig } from "@/lib/auth/config";
import { clearAdminCookies } from "@/lib/auth/cookies";
import { createRouteClient } from "@/lib/auth/supabase";

export const dynamic = "force-dynamic";

/** Ends this session (revoked in Supabase, cookies cleared). reason=timeout when the browser's idle timer fired. */
export async function POST(request: NextRequest) {
  const config = authConfig();
  if (!config) return NextResponse.json({ error: "AUTH_NOT_CONFIGURED" }, { status: 503 });
  const supabase = await createRouteClient(config);
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims as AuthClaims | undefined;
  const reason = request.nextUrl.searchParams.get("reason") === "timeout" ? "timeout" : "user";
  await supabase.auth.signOut({ scope: "local" });
  clearAdminCookies(await cookies(), config);
  if (claims?.sub) await audit(config, reason === "timeout" ? "SESSION_TIMEOUT" : "SIGN_OUT", "info", { userId: claims.sub, email: claims.email }, requestMeta(request.headers), { source: reason === "timeout" ? "browser_idle_timer" : "user" });
  return NextResponse.json({ next: reason === "timeout" ? "/login?reason=timeout" : "/login" }, { headers: { "Cache-Control": "no-store" } });
}
