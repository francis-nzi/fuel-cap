import { NextRequest, NextResponse } from "next/server";
import { addPageView } from "@/lib/store";
import type { UtmParams } from "@/lib/types";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const utm: UtmParams = body.utm ?? {};
  const path: string = typeof body.path === "string" ? body.path : "/";

  await addPageView({
    utm,
    path,
    market: typeof body.market === "string" ? body.market : undefined,
    referrer: request.headers.get("referer") ?? undefined,
    userAgent: request.headers.get("user-agent") ?? undefined,
  });

  return NextResponse.json({ ok: true });
}
