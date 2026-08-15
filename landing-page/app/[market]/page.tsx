import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Hero from "@/components/landing/Hero";
import ViralFeatures from "@/components/landing/ViralFeatures";
import HowItWorks from "@/components/landing/HowItWorks";
import GuaranteeSection from "@/components/landing/GuaranteeSection";
import FinalCTA from "@/components/landing/FinalCTA";
import { getMarket, MARKET_LIST } from "@/lib/markets";
import { getDictionary } from "@/lib/i18n";

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

  const dict = getDictionary(market.language);
  return {
    title: `FuelCap ${market.name} — ${dict.hero.headlineLine1} ${dict.hero.headlineLine2}`,
    description: dict.hero.subhead.replace("{fuelWord}", market.fuelWord),
  };
}

export default async function MarketPage({ params }: { params: Promise<{ market: string }> }) {
  const { market: marketSlug } = await params;
  const market = getMarket(marketSlug);
  if (!market) notFound();

  const dict = getDictionary(market.language);

  return (
    <main className="flex-1">
      <Hero dict={dict} market={market} />
      <ViralFeatures dict={dict} market={market} />
      <HowItWorks dict={dict} />
      <GuaranteeSection dict={dict} />
      <FinalCTA dict={dict} />
    </main>
  );
}
