import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PageHero from "@/components/site/PageHero";
import CTASection from "@/components/site/CTASection";
import { getMarket, MARKET_LIST } from "@/lib/markets";
import { getDictionary } from "@/lib/i18n";
import { getSiteChrome } from "@/lib/site-nav";
import { faqs } from "@/lib/site-content";

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
    title: `FAQ — FuelCap ${market.name}`,
    description: "Answers about how FuelCap works, where prices come from, fees, and availability.",
  };
}

export default async function FaqPage({ params }: { params: Promise<{ market: string }> }) {
  const { market: marketSlug } = await params;
  const market = getMarket(marketSlug);
  if (!market) notFound();

  const dict = getDictionary(market.language);
  const chrome = getSiteChrome(market.language);
  const items = faqs(market);

  return (
    <main className="flex-1">
      <PageHero
        eyebrow={chrome.nav.faq}
        title="Questions, answered"
        subtitle="The things people ask most before they join early access."
      />

      <section className="px-5 py-16">
        <div className="mx-auto flex max-w-3xl flex-col gap-3">
          {items.map((item) => (
            <details
              key={item.q}
              className="group rounded-2xl border border-black/10 bg-white p-5 [&_summary::-webkit-details-marker]:hidden"
            >
              <summary className="flex cursor-pointer items-center justify-between gap-4 font-display text-base font-semibold text-brand-midnight">
                {item.q}
                <span className="shrink-0 text-brand-emerald transition group-open:rotate-45" aria-hidden>
                  +
                </span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-brand-midnight/70">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <CTASection dict={dict} />
    </main>
  );
}
