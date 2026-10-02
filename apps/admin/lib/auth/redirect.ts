import { NextResponse, type NextRequest } from "next/server";

/**
 * Redirect on the host the browser actually used (Host / X-Forwarded-Proto). Building the URL from request.url
 * can switch host (e.g. 127.0.0.1 → localhost in dev, or an internal host behind a proxy), which would drop the
 * session cookie.
 */
export function redirectTo(request: NextRequest, path: string) {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? request.nextUrl.host;
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ?? request.nextUrl.protocol.replace(":", "");
  return NextResponse.redirect(new URL(path, `${proto}://${host}`), 307);
}
