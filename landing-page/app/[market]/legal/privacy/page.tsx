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
    title: `Privacy Policy — FuelCap ${market.name}`,
    description: "How FuelCap collects, uses and protects your information.",
  };
}

const sections: { h: string; p: string[] }[] = [
  {
    h: "1. Who we are",
    p: [
      "FuelCap (“FuelCap”, “we”, “us”) operates www.fuelcap.tech and the FuelCap early-access waitlist. You can contact us at info@fuelcap.tech.",
    ],
  },
  {
    h: "2. What we collect",
    p: [
      "When you join the waitlist we collect the information you provide — typically your email address, country/region, postcode area, and a few optional profile answers (such as how often you drive). We also collect limited technical and marketing-attribution data automatically, including page views, referrer, approximate campaign source (UTM parameters), and browser/user-agent information.",
    ],
  },
  {
    h: "3. How we use it",
    p: [
      "We use this information to operate the waitlist, decide where to launch first, let you know when FuelCap opens in your area, understand how people find us, and improve the product and our marketing. We do not sell your personal information.",
    ],
  },
  {
    h: "4. Legal basis",
    p: [
      "Where the GDPR or UK GDPR applies, we rely on your consent (which you can withdraw at any time) and on our legitimate interests in building and marketing the product. Where other laws apply, we process your data in line with those laws.",
    ],
  },
  {
    h: "5. Sharing",
    p: [
      "We share data with service providers who help us run the site and store waitlist data (for example, hosting and database providers) under appropriate contractual protections. We may disclose information if required by law.",
    ],
  },
  {
    h: "6. Retention",
    p: [
      "We keep waitlist information until FuelCap launches in your market and for a reasonable period afterwards, or until you ask us to delete it.",
    ],
  },
  {
    h: "7. Your rights",
    p: [
      "Depending on where you live, you may have the right to access, correct, delete or export your data, and to object to or restrict certain processing. To exercise any of these rights, email info@fuelcap.tech and we will respond as required by law.",
    ],
  },
  {
    h: "8. Changes",
    p: [
      "We may update this policy as the product develops. Material changes will be reflected on this page with a new effective date.",
    ],
  },
];

export default async function PrivacyPage({ params }: { params: Promise<{ market: string }> }) {
  const { market: marketSlug } = await params;
  const market = getMarket(marketSlug);
  if (!market) notFound();
  const chrome = getSiteChrome(market.language);

  return (
    <main className="flex-1">
      <PageHero eyebrow={chrome.footer.legalHeading} title="Privacy Policy" />
      <section className="px-5 py-16">
        <div className="mx-auto max-w-3xl">
          <p className="rounded-xl border border-brand-amber/40 bg-brand-amber/10 px-4 py-3 text-xs leading-relaxed text-brand-midnight/70">
            Early-access draft. This policy describes our current practices for the FuelCap
            waitlist and marketing site. It will be reviewed and finalised with legal counsel before
            the product handles payments or launches.
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
