import { NextRequest, NextResponse } from "next/server";
import { upsertSubmission } from "@/lib/store";
import { FUNNEL_STEPS, type FunnelStep, type SignupAnswers, type UtmParams } from "@/lib/types";

function isFunnelStep(value: unknown): value is FunnelStep {
  return typeof value === "string" && (FUNNEL_STEPS as readonly string[]).includes(value);
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);

  if (!body || typeof body.sessionId !== "string" || !isFunnelStep(body.step)) {
    return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });
  }

  const answers: SignupAnswers = body.answers ?? {};
  const utm: UtmParams = body.utm ?? {};

  const submission = await upsertSubmission({
    sessionId: body.sessionId,
    step: body.step,
    answers,
    utm,
    completed: !!body.completed,
    landingMarket: typeof body.landingMarket === "string" ? body.landingMarket : undefined,
    referrer: request.headers.get("referer") ?? undefined,
    userAgent: request.headers.get("user-agent") ?? undefined,
  });

  return NextResponse.json({ ok: true, sessionId: submission.sessionId });
}
