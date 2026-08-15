import { redirect } from "next/navigation";
import { verifyDashboardSession } from "@/lib/session";
import { logoutAction } from "@/lib/actions";
import { getPageViews, getSubmissions } from "@/lib/store";
import {
  computeFunnelCounts,
  computeMarketBreakdown,
  computeSummary,
  computeUtmBreakdown,
} from "@/lib/analytics";
import { FUNNEL_STEPS } from "@/lib/types";
import { getMarket } from "@/lib/markets";

export const dynamic = "force-dynamic";

const STEP_LABELS: Record<(typeof FUNNEL_STEPS)[number], string> = {
  started: "Opened signup",
  country: "Answered country",
  gender: "Answered gender",
  ageRange: "Answered age",
  driverType: "Answered driver type",
  fillFrequency: "Answered fill frequency",
  zip: "Answered postcode",
  email: "Completed (email captured)",
};

function StatTile({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-midnight/50">{label}</p>
      <p className="font-display mt-1 text-3xl font-bold text-brand-midnight">{value}</p>
      {sub && <p className="mt-1 text-xs text-brand-midnight/50">{sub}</p>}
    </div>
  );
}

export default async function DashboardPage() {
  const isAuthed = await verifyDashboardSession();
  if (!isAuthed) redirect("/dashboard/login");

  const [pageViews, submissions] = await Promise.all([getPageViews(), getSubmissions()]);
  const summary = computeSummary(pageViews, submissions);
  const funnelCounts = computeFunnelCounts(submissions);
  const utmBreakdown = computeUtmBreakdown(submissions);
  const marketBreakdown = computeMarketBreakdown(submissions);
  const startedCount = funnelCounts.started || 1;

  const sortedSubmissions = [...submissions].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <div className="min-h-screen flex-1 bg-[#f4faf7] px-5 py-8 text-brand-midnight">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-display text-2xl font-bold">FuelCap signups</p>
            <p className="text-sm text-brand-midnight/50">Ad conversion validation dashboard</p>
          </div>
          <div className="flex items-center gap-3">
            {/* File download (Content-Disposition: attachment), not an in-app route — a plain <a> is correct here. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/api/dashboard/export"
              className="rounded-full border border-brand-emerald px-4 py-2 text-sm font-semibold text-brand-emerald transition hover:bg-brand-emerald hover:text-white"
            >
              Export CSV
            </a>
            <form action={logoutAction}>
              <button
                type="submit"
                className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-brand-midnight/60 shadow-sm transition hover:text-brand-midnight"
              >
                Log out
              </button>
            </form>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <StatTile label="Page views" value={summary.totalPageViews} />
          <StatTile label="Signup starts" value={summary.totalStarts} />
          <StatTile label="Completed" value={summary.totalCompleted} />
          <StatTile label="View → Start" value={`${summary.viewToStartRate}%`} />
          <StatTile label="Start → Complete" value={`${summary.startToCompleteRate}%`} />
          <StatTile label="View → Complete" value={`${summary.viewToCompleteRate}%`} sub="Overall ad conversion" />
        </div>

        <div className="mt-8 rounded-2xl border border-black/5 bg-white p-6 shadow-sm">
          <h2 className="font-display text-lg font-bold">Signup funnel</h2>
          <div className="mt-5 flex flex-col gap-3">
            {FUNNEL_STEPS.map((step) => {
              const count = funnelCounts[step];
              const pct = Math.round((count / startedCount) * 100);
              return (
                <div key={step}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium text-brand-midnight/80">{STEP_LABELS[step]}</span>
                    <span className="text-brand-midnight/50">
                      {count} · {pct}%
                    </span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-brand-mint">
                    <div
                      className="h-full rounded-full bg-brand-emerald"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm">
            <h2 className="font-display text-lg font-bold">By country</h2>
            <p className="text-xs text-brand-midnight/50">
              Which markets are showing the most demand — use this to prioritise launch order.
            </p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[360px] text-left text-sm">
                <thead>
                  <tr className="border-b border-black/5 text-brand-midnight/50">
                    <th className="py-2 pr-4 font-medium">Country</th>
                    <th className="py-2 pr-4 font-medium">Starts</th>
                    <th className="py-2 pr-4 font-medium">Completed</th>
                    <th className="py-2 font-medium">Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {marketBreakdown.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-4 text-brand-midnight/40">
                        No traffic yet.
                      </td>
                    </tr>
                  )}
                  {marketBreakdown.map((row) => (
                    <tr key={row.market} className="border-b border-black/5 last:border-0">
                      <td className="py-2 pr-4 font-medium">{row.market}</td>
                      <td className="py-2 pr-4">{row.starts}</td>
                      <td className="py-2 pr-4">{row.completions}</td>
                      <td className="py-2">
                        {row.starts === 0 ? "—" : `${Math.round((row.completions / row.starts) * 100)}%`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm">
            <h2 className="font-display text-lg font-bold">By UTM source</h2>
            <p className="text-xs text-brand-midnight/50">Use this to compare which ad campaigns convert.</p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[360px] text-left text-sm">
                <thead>
                  <tr className="border-b border-black/5 text-brand-midnight/50">
                    <th className="py-2 pr-4 font-medium">Source</th>
                    <th className="py-2 pr-4 font-medium">Starts</th>
                    <th className="py-2 pr-4 font-medium">Completed</th>
                    <th className="py-2 font-medium">Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {utmBreakdown.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-4 text-brand-midnight/40">
                        No traffic yet.
                      </td>
                    </tr>
                  )}
                  {utmBreakdown.map((row) => (
                    <tr key={row.source} className="border-b border-black/5 last:border-0">
                      <td className="py-2 pr-4 font-medium">{row.source}</td>
                      <td className="py-2 pr-4">{row.starts}</td>
                      <td className="py-2 pr-4">{row.completions}</td>
                      <td className="py-2">
                        {row.starts === 0 ? "—" : `${Math.round((row.completions / row.starts) * 100)}%`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="mt-8 rounded-2xl border border-black/5 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold">Full submission data</h2>
            <span className="text-xs text-brand-midnight/50">{sortedSubmissions.length} total</span>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[1300px] text-left text-sm">
              <thead>
                <tr className="border-b border-black/5 text-brand-midnight/50">
                  <th className="py-2 pr-4 font-medium">Created</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 pr-4 font-medium">Country</th>
                  <th className="py-2 pr-4 font-medium">State</th>
                  <th className="py-2 pr-4 font-medium">Landed on</th>
                  <th className="py-2 pr-4 font-medium">Gender</th>
                  <th className="py-2 pr-4 font-medium">Age</th>
                  <th className="py-2 pr-4 font-medium">Driver type</th>
                  <th className="py-2 pr-4 font-medium">Fill freq.</th>
                  <th className="py-2 pr-4 font-medium">Postcode</th>
                  <th className="py-2 pr-4 font-medium">Email</th>
                  <th className="py-2 pr-4 font-medium">UTM source</th>
                  <th className="py-2 pr-4 font-medium">UTM campaign</th>
                  <th className="py-2 font-medium">Session ID</th>
                </tr>
              </thead>
              <tbody>
                {sortedSubmissions.length === 0 && (
                  <tr>
                    <td colSpan={14} className="py-4 text-brand-midnight/40">
                      No submissions yet — test the form on the landing page.
                    </td>
                  </tr>
                )}
                {sortedSubmissions.map((s) => {
                  const countryMarket = s.answers.country ? getMarket(s.answers.country) : undefined;
                  const landedMarket = s.landingMarket ? getMarket(s.landingMarket) : undefined;
                  return (
                    <tr key={s.sessionId} className="border-b border-black/5 last:border-0 align-top">
                      <td className="py-2 pr-4 whitespace-nowrap text-brand-midnight/70">
                        {new Date(s.createdAt).toLocaleString()}
                      </td>
                      <td className="py-2 pr-4">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${
                            s.completed
                              ? "bg-brand-emerald/10 text-brand-emerald"
                              : "bg-brand-amber/15 text-brand-amber"
                          }`}
                        >
                          {s.completed ? "Completed" : `Dropped at ${STEP_LABELS[s.furthestStep]}`}
                        </span>
                      </td>
                      <td className="py-2 pr-4 whitespace-nowrap">
                        {countryMarket ? `${countryMarket.flag} ${countryMarket.name}` : "—"}
                      </td>
                      <td className="py-2 pr-4">{s.answers.state?.toUpperCase() ?? "—"}</td>
                      <td className="py-2 pr-4 whitespace-nowrap">
                        {landedMarket ? `${landedMarket.flag} ${landedMarket.name}` : "—"}
                      </td>
                      <td className="py-2 pr-4">{s.answers.gender ?? "—"}</td>
                      <td className="py-2 pr-4">{s.answers.ageRange ?? "—"}</td>
                      <td className="py-2 pr-4">{s.answers.driverType ?? "—"}</td>
                      <td className="py-2 pr-4">{s.answers.fillFrequency ?? "—"}</td>
                      <td className="py-2 pr-4">{s.answers.zip ?? "—"}</td>
                      <td className="py-2 pr-4">{s.answers.email ?? "—"}</td>
                      <td className="py-2 pr-4">{s.utm.utm_source ?? "—"}</td>
                      <td className="py-2 pr-4">{s.utm.utm_campaign ?? "—"}</td>
                      <td className="py-2 font-mono text-xs text-brand-midnight/40">
                        {s.sessionId.slice(0, 8)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
