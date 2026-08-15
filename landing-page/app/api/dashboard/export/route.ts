import { NextResponse } from "next/server";
import { verifyDashboardSession } from "@/lib/session";
import { getSubmissions } from "@/lib/store";

function csvEscape(value: unknown): string {
  const str = value === undefined || value === null ? "" : String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET() {
  const isAuthed = await verifyDashboardSession();
  if (!isAuthed) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const submissions = await getSubmissions();

  const headers = [
    "sessionId",
    "createdAt",
    "updatedAt",
    "completedAt",
    "completed",
    "furthestStep",
    "landingMarket",
    "country",
    "state",
    "gender",
    "ageRange",
    "driverType",
    "fillFrequency",
    "zip",
    "email",
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_content",
    "utm_term",
    "referrer",
    "userAgent",
  ];

  const rows = submissions.map((s) =>
    [
      s.sessionId,
      s.createdAt,
      s.updatedAt,
      s.completedAt ?? "",
      s.completed,
      s.furthestStep,
      s.landingMarket ?? "",
      s.answers.country ?? "",
      s.answers.state ?? "",
      s.answers.gender ?? "",
      s.answers.ageRange ?? "",
      s.answers.driverType ?? "",
      s.answers.fillFrequency ?? "",
      s.answers.zip ?? "",
      s.answers.email ?? "",
      s.utm.utm_source ?? "",
      s.utm.utm_medium ?? "",
      s.utm.utm_campaign ?? "",
      s.utm.utm_content ?? "",
      s.utm.utm_term ?? "",
      s.referrer ?? "",
      s.userAgent ?? "",
    ]
      .map(csvEscape)
      .join(",")
  );

  const csv = [headers.join(","), ...rows].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="fuelcap-signups-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
