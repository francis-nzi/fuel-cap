import { NextRequest, NextResponse } from "next/server";
import { addContact } from "@/lib/store";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);

  if (
    !body ||
    typeof body.name !== "string" ||
    typeof body.email !== "string" ||
    typeof body.message !== "string" ||
    !body.name.trim() ||
    !EMAIL_RE.test(body.email) ||
    !body.message.trim()
  ) {
    return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });
  }

  // Basic hardening: cap lengths so a bad actor can't dump huge payloads.
  const contact = await addContact({
    name: body.name.trim().slice(0, 200),
    email: body.email.trim().slice(0, 320),
    message: body.message.trim().slice(0, 5000),
    market: typeof body.market === "string" ? body.market : undefined,
  });

  return NextResponse.json({ ok: true, id: contact.id });
}
