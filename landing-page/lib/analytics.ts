import type { PageView, Submission } from "./types";
import { FUNNEL_STEPS, type FunnelStep } from "./types";
import { getMarket } from "./markets";

export function computeFunnelCounts(submissions: Submission[]): Record<FunnelStep, number> {
  const order = FUNNEL_STEPS;
  const idx = (s: FunnelStep) => order.indexOf(s);

  const counts = Object.fromEntries(order.map((s) => [s, 0])) as Record<FunnelStep, number>;

  for (const sub of submissions) {
    const reached = sub.completed ? "email" : sub.furthestStep;
    const reachedIdx = idx(reached as FunnelStep);
    for (let i = 0; i <= reachedIdx; i++) {
      counts[order[i]] += 1;
    }
  }

  return counts;
}

export function computeUtmBreakdown(submissions: Submission[]) {
  const map = new Map<string, { starts: number; completions: number }>();

  for (const sub of submissions) {
    const key = sub.utm.utm_source?.trim() || "(direct / no utm)";
    const entry = map.get(key) ?? { starts: 0, completions: 0 };
    entry.starts += 1;
    if (sub.completed) entry.completions += 1;
    map.set(key, entry);
  }

  return Array.from(map.entries())
    .map(([source, v]) => ({ source, ...v }))
    .sort((a, b) => b.starts - a.starts);
}

export function computeMarketBreakdown(submissions: Submission[]) {
  const map = new Map<string, { starts: number; completions: number }>();

  for (const sub of submissions) {
    const countryId = sub.answers.country ?? sub.landingMarket;
    const market = countryId ? getMarket(countryId) : undefined;
    const key = market ? `${market.flag} ${market.name}` : "(unknown)";
    const entry = map.get(key) ?? { starts: 0, completions: 0 };
    entry.starts += 1;
    if (sub.completed) entry.completions += 1;
    map.set(key, entry);
  }

  return Array.from(map.entries())
    .map(([market, v]) => ({ market, ...v }))
    .sort((a, b) => b.starts - a.starts);
}

export function computeSummary(pageViews: PageView[], submissions: Submission[]) {
  const totalPageViews = pageViews.length;
  const totalStarts = submissions.length;
  const totalCompleted = submissions.filter((s) => s.completed).length;

  const pct = (n: number, d: number) => (d === 0 ? 0 : Math.round((n / d) * 1000) / 10);

  return {
    totalPageViews,
    totalStarts,
    totalCompleted,
    viewToStartRate: pct(totalStarts, totalPageViews),
    startToCompleteRate: pct(totalCompleted, totalStarts),
    viewToCompleteRate: pct(totalCompleted, totalPageViews),
  };
}
