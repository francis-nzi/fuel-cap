import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PageHero from "@/components/site/PageHero";
import CTASection from "@/components/site/CTASection";
import { getMarket, MARKET_LIST } from "@/lib/markets";
import { getDictionary } from "@/lib/i18n";
import { getSiteChrome } from "@/lib/site-nav";
import { pricing } from "@/lib/site-content";

export function generateStaticParams() {
  return MARKET_LIST.map((m) => ({ market: m.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ market: string }>;
}): Promise<Metadata> {
  const { market: marketSlug } = await params;
  const market = getMarket(marketSlug);
  if (!market) return {};
  return {
    title: `Pricing — FuelCap ${market.name}`,
    description: "Using FuelCap costs drivers nothing. FuelCap+ is an optional upgrade for heavy drivers.",
  };
}

function Check({ on }: { on: boolean }) {
  return on ? (
    <span className="text-brand-emerald" aria-hidden>
      ✓
    </span>
  ) : (
    <span className="text-brand-midnight/25" aria-hidden>
      —
    </span>
  );
}

export default async function PricingPage({ params }: { params: Promise<{ market: string }> }) {
  const { market: marketSlug } = await params;
  const market = getMarket(marketSlug);
  if (!market) notFound();

  const dict = getDictionary(market.language);
  const chrome = getSiteChrome(market.language);
  const content = pricing(market);

  return (
    <main className="flex-1">
      <PageHero eyebrow={chrome.nav.pricing} title="Free to use. Always." subtitle={content.intro} />

      <section className="px-5 py-16">
        <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-2">
          {content.plans.map((plan) => (
            <div
              key={plan.name}
              className={`rounded-3xl border p-8 ${
                plan.highlighted
                  ? "border-brand-emerald bg-white shadow-lg shadow-brand-emerald/10"
                  : "border-black/10 bg-white shadow-sm"
              }`}
            >
              {plan.highlighted && (
                <span className="inline-block rounded-full bg-brand-emerald px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">
                  Most popular
                </span>
              )}
              <h3 className="font-display mt-3 text-xl font-bold text-brand-midnight">{plan.name}</h3>
              <p className="mt-1 text-sm text-brand-midnight/60">{plan.tagline}</p>
              <p className="mt-5 flex items-baseline gap-1">
                <span className="font-display text-4xl font-bold text-brand-midnight">
                  {plan.price}
                </span>
                <span className="text-sm text-brand-midnight/60">/ {plan.cadence}</span>
              </p>
              <ul className="mt-6 flex flex-col gap-3 text-sm">
                {plan.features.map((f) => (
                  <li key={f.label} className="flex items-start gap-3">
                    <Check on={f.included} />
                    <span className={f.included ? "text-brand-midnight/80" : "text-brand-midnight/40"}>
                      {f.label}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="mx-auto mt-8 max-w-2xl text-center text-xs leading-relaxed text-brand-midnight/50">
          {content.note}
        </p>
      </section>

      <CTASection dict={dict} />
    </main>
  );
}
