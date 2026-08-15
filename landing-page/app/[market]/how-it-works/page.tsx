import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PageHero from "@/components/site/PageHero";
import CTASection from "@/components/site/CTASection";
import { getMarket, MARKET_LIST } from "@/lib/markets";
import { getDictionary } from "@/lib/i18n";
import { getSiteChrome } from "@/lib/site-nav";
import { howItWorks } from "@/lib/site-content";

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
    title: `How FuelCap works — FuelCap ${market.name}`,
    description: `Lock today's ${market.fuelWord} price. If the pump falls below your lock, FuelCap auto-refunds the difference. Here's how it works.`,
  };
}

const toneStyles: Record<string, string> = {
  rise: "border-brand-emerald/30 bg-brand-mint",
  fall: "border-brand-amber/40 bg-brand-amber/10",
  flat: "border-black/10 bg-white",
};

export default async function HowItWorksPage({
  params,
}: {
  params: Promise<{ market: string }>;
}) {
  const { market: marketSlug } = await params;
  const market = getMarket(marketSlug);
  if (!market) notFound();

  const dict = getDictionary(market.language);
  const chrome = getSiteChrome(market.language);
  const content = howItWorks(market);

  return (
    <main className="flex-1">
      <PageHero eyebrow={chrome.nav.howItWorks} title="Cap your price. Never overpay." subtitle={content.intro} />

      <section className="px-5 py-16">
        <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-3">
          {content.steps.map((step) => (
            <div
              key={step.title}
              className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm"
            >
              <h3 className="font-display text-lg font-bold text-brand-midnight">{step.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-brand-midnight/70">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-brand-mint/40 px-5 py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="font-display text-center text-2xl font-bold text-brand-midnight sm:text-3xl">
            Three outcomes. All of them good.
          </h2>
          <div className="mt-8 grid gap-5 sm:grid-cols-3">
            {content.outcomes.map((o) => (
              <div
                key={o.label}
                className={`rounded-2xl border p-6 text-center ${toneStyles[o.tone]}`}
              >
                <p className="font-display text-sm font-bold uppercase tracking-wide text-brand-midnight">
                  {o.label}
                </p>
                <p className="mt-3 text-sm leading-relaxed text-brand-midnight/75">{o.detail}</p>
              </div>
            ))}
          </div>
          <p className="mx-auto mt-8 max-w-2xl text-center text-xs leading-relaxed text-brand-midnight/50">
            Figures are illustrative, not live prices or an offer. Every lock and refund settles
            against {market.dataSource} ({market.stationCount} stations) at a defined, audit-logged
            snapshot.
          </p>
        </div>
      </section>

      <CTASection dict={dict} />
    </main>
  );
}
