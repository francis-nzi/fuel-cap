import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PageHero from "@/components/site/PageHero";
import CTASection from "@/components/site/CTASection";
import { getMarket, MARKET_LIST } from "@/lib/markets";
import { getDictionary } from "@/lib/i18n";
import { getSiteChrome } from "@/lib/site-nav";
import { about } from "@/lib/site-content";

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
    title: `About FuelCap — FuelCap ${market.name}`,
    description: "Why FuelCap exists, and the founder behind it.",
  };
}

export default async function AboutPage({ params }: { params: Promise<{ market: string }> }) {
  const { market: marketSlug } = await params;
  const market = getMarket(marketSlug);
  if (!market) notFound();

  const dict = getDictionary(market.language);
  const chrome = getSiteChrome(market.language);
  const content = about();

  return (
    <main className="flex-1">
      <PageHero eyebrow={chrome.nav.about} title="Certainty, with no downside." subtitle={content.lead} />

      <section className="px-5 py-16">
        <div className="mx-auto flex max-w-3xl flex-col gap-5">
          {content.story.map((p, i) => (
            <p key={i} className="text-base leading-relaxed text-brand-midnight/80">
              {p}
            </p>
          ))}
        </div>
      </section>

      <section className="bg-brand-mint/40 px-5 py-16">
        <div className="mx-auto max-w-3xl">
          <p className="font-display text-xs font-semibold uppercase tracking-wide text-brand-pine">
            The founder
          </p>
          <div className="mt-4 rounded-3xl border border-black/5 bg-white p-8 shadow-sm">
            <div className="flex items-center gap-4">
              <span className="grid h-14 w-14 place-items-center rounded-full bg-brand-emerald text-xl font-bold text-white">
                FD
              </span>
              <div>
                <h2 className="font-display text-xl font-bold text-brand-midnight">
                  {content.founder.name}
                </h2>
                <p className="text-sm text-brand-midnight/60">{content.founder.role}</p>
              </div>
            </div>
            <div className="mt-5 flex flex-col gap-4">
              {content.founder.bio.map((p, i) => (
                <p key={i} className="text-sm leading-relaxed text-brand-midnight/75">
                  {p}
                </p>
              ))}
            </div>
            <a
              href={content.founder.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-brand-emerald hover:text-brand-pine"
            >
              LinkedIn →
            </a>
          </div>
        </div>
      </section>

      <CTASection dict={dict} />
    </main>
  );
}
