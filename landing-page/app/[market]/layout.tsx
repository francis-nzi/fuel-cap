import { notFound } from "next/navigation";
import SignupProvider from "@/components/signup/SignupContext";
import PageViewTracker from "@/components/PageViewTracker";
import SiteHeader from "@/components/site/SiteHeader";
import Footer from "@/components/landing/Footer";
import StickyMobileCTA from "@/components/landing/StickyMobileCTA";
import { getMarket } from "@/lib/markets";
import { getDictionary } from "@/lib/i18n";

export default async function MarketLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ market: string }>;
}) {
  const { market: marketSlug } = await params;
  const market = getMarket(marketSlug);
  if (!market) notFound();

  const dict = getDictionary(market.language);

  return (
    <SignupProvider market={market} dict={dict}>
      <PageViewTracker market={market.id} />
      <SiteHeader marketSlug={market.slug} />
      <div className="flex flex-1 flex-col pb-20 md:pb-0">{children}</div>
      <Footer dict={dict} market={market} />
      <StickyMobileCTA dict={dict} />
    </SignupProvider>
  );
}
