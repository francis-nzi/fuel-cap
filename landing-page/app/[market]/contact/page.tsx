import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PageHero from "@/components/site/PageHero";
import ContactForm from "@/components/site/ContactForm";
import { getMarket, MARKET_LIST } from "@/lib/markets";
import { getSiteChrome } from "@/lib/site-nav";

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
    title: `Contact — FuelCap ${market.name}`,
    description: "Get in touch with the FuelCap team.",
  };
}

export default async function ContactPage({ params }: { params: Promise<{ market: string }> }) {
  const { market: marketSlug } = await params;
  const market = getMarket(marketSlug);
  if (!market) notFound();

  const chrome = getSiteChrome(market.language);

  return (
    <main className="flex-1">
      <PageHero
        eyebrow={chrome.footer.linkContact}
        title="Get in touch"
        subtitle="Questions, partnerships, press, or investment — we'd love to hear from you."
      />

      <section className="px-5 py-16">
        <div className="mx-auto grid max-w-4xl gap-10 md:grid-cols-[1fr_1.2fr]">
          <div>
            <h2 className="font-display text-xl font-bold text-brand-midnight">Talk to us</h2>
            <p className="mt-3 text-sm leading-relaxed text-brand-midnight/70">
              The fastest way to reach us is email. We read everything and reply personally while
              we're in early access.
            </p>
            <dl className="mt-6 flex flex-col gap-4 text-sm">
              <div>
                <dt className="font-semibold text-brand-midnight">Email</dt>
                <dd>
                  <a className="text-brand-emerald hover:text-brand-pine" href="mailto:info@fuelcap.tech">
                    info@fuelcap.tech
                  </a>
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-brand-midnight">Web</dt>
                <dd className="text-brand-midnight/70">www.fuelcap.tech</dd>
              </div>
            </dl>
          </div>
          <ContactForm market={market.id} />
        </div>
      </section>
    </main>
  );
}
