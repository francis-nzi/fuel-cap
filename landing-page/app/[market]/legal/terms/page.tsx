import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PageHero from "@/components/site/PageHero";
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
    title: `Terms of Use — FuelCap ${market.name}`,
    description: "The terms that apply to the FuelCap website and early-access waitlist.",
  };
}

const sections: { h: string; p: string[] }[] = [
  {
    h: "1. About these terms",
    p: [
      "These terms govern your use of the FuelCap website at www.fuelcap.tech and the early-access waitlist. By using the site or joining the waitlist, you agree to these terms.",
    ],
  },
  {
    h: "2. Early access, not a product yet",
    p: [
      "FuelCap is in early access. The site describes a product that is still in development. Joining the waitlist does not create an account, a contract to supply fuel or protection, or any obligation on either side. Nothing on this site is an offer to sell a financial product or to guarantee a fuel price today.",
    ],
  },
  {
    h: "3. Illustrative figures",
    p: [
      "All prices, refund amounts, savings and other figures shown on the site are illustrative examples only. They are not live prices, quotes, or offers, and actual amounts will depend on the final product, your market, and prevailing fuel prices at launch.",
    ],
  },
  {
    h: "4. Your information",
    p: [
      "You agree to provide accurate information when joining the waitlist and to receive email from us about FuelCap's launch in your area. Our use of your information is described in the Privacy Policy.",
    ],
  },
  {
    h: "5. Intellectual property",
    p: [
      "The FuelCap name, the FuelCap roundel, the site's content and design are owned by FuelCap and protected by intellectual-property laws. You may not copy, reproduce or reuse them without our prior written consent.",
    ],
  },
  {
    h: "6. No warranties; limitation of liability",
    p: [
      "The site is provided “as is” during early access, without warranties of any kind. To the fullest extent permitted by law, FuelCap is not liable for any loss arising from your use of, or reliance on, the site or the waitlist.",
    ],
  },
  {
    h: "7. Changes",
    p: [
      "We may update the site and these terms as the product develops. Continued use after changes means you accept the updated terms.",
    ],
  },
  {
    h: "8. Governing law",
    p: [
      "The governing law and jurisdiction for these terms will be confirmed when FuelCap's operating entity and launch market are finalised. Questions in the meantime can be sent to info@fuelcap.tech.",
    ],
  },
];

export default async function TermsPage({ params }: { params: Promise<{ market: string }> }) {
  const { market: marketSlug } = await params;
  const market = getMarket(marketSlug);
  if (!market) notFound();
  const chrome = getSiteChrome(market.language);

  return (
    <main className="flex-1">
      <PageHero eyebrow={chrome.footer.legalHeading} title="Terms of Use" />
      <section className="px-5 py-16">
        <div className="mx-auto max-w-3xl">
          <p className="rounded-xl border border-brand-amber/40 bg-brand-amber/10 px-4 py-3 text-xs leading-relaxed text-brand-midnight/70">
            Early-access draft. These terms cover the marketing site and waitlist only. Full product
            terms will be issued, and reviewed with legal counsel, before FuelCap handles payments or
            launches.
          </p>
          <div className="mt-8 flex flex-col gap-8">
            {sections.map((s) => (
              <div key={s.h}>
                <h2 className="font-display text-lg font-bold text-brand-midnight">{s.h}</h2>
                {s.p.map((para, i) => (
                  <p key={i} className="mt-2 text-sm leading-relaxed text-brand-midnight/75">
                    {para}
                  </p>
                ))}
              </div>
            ))}
            <p className="text-xs text-brand-midnight/50">Contact: info@fuelcap.tech</p>
          </div>
        </div>
      </section>
    </main>
  );
}
