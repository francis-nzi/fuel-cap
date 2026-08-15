import { NextRequest, NextResponse } from "next/server";
import { decryptSession, DASHBOARD_SESSION_COOKIE } from "@/lib/session";

// Optimistic auth check (cookie only, no DB hit) for the dashboard.
// The real check lives in lib/session.ts#verifyDashboardSession, called
// again inside app/dashboard/page.tsx — this is just a fast redirect layer.
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/dashboard") && pathname !== "/dashboard/login") {
    const token = request.cookies.get(DASHBOARD_SESSION_COOKIE)?.value;
    const session = await decryptSession(token);

    if (!session) {
      const loginUrl = new URL("/dashboard/login", request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
