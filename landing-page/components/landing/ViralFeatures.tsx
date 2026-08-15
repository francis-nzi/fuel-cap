import Image from "next/image";
import CTAButton from "@/components/signup/CTAButton";
import { interpolate } from "@/lib/i18n";
import type { Dictionary } from "@/lib/i18n";
import type { Market } from "@/lib/markets";

export default function ViralFeatures({ dict, market }: { dict: Dictionary; market: Market }) {
  const vars = {
    fuelWord: market.fuelWord,
    refundAmount: market.sampleRefundAmount,
    highPrice: market.sampleHighPrice,
  };

  const features = [
    {
      image: "/images/refund-moment.png",
      alt: "FuelCap price-drop refund celebration screen",
      eyebrow: dict.viral.feature1Eyebrow,
      headline: interpolate(dict.viral.feature1Headline, vars),
      quote: interpolate(dict.viral.feature1Quote, vars),
      body: dict.viral.feature1Body,
      bg: "bg-brand-mint",
    },
    {
      image: "/images/scorecard.png",
      alt: "FuelCap winning scorecard share card",
      eyebrow: dict.viral.feature2Eyebrow,
      headline: interpolate(dict.viral.feature2Headline, vars),
      quote: interpolate(dict.viral.feature2Quote, vars),
      body: dict.viral.feature2Body,
      bg: "bg-white",
    },
    {
      image: "/images/squad-referrals.png",
      alt: "FuelCap squad referrals screen",
      eyebrow: dict.viral.feature3Eyebrow,
      headline: interpolate(dict.viral.feature3Headline, vars),
      quote: interpolate(dict.viral.feature3Quote, vars),
      body: dict.viral.feature3Body,
      bg: "bg-brand-mint",
    },
  ];

  return (
    <section className="px-5 py-16">
      <div className="mx-auto max-w-5xl">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-xs font-semibold uppercase tracking-wide text-brand-emerald">
            {dict.viral.eyebrow}
          </span>
          <h2 className="font-display mt-2 text-3xl font-bold text-brand-midnight sm:text-4xl">
            {dict.viral.headline}
          </h2>
        </div>

        <div className="mt-12 flex flex-col gap-16">
          {features.map((f, i) => (
            <div
              key={f.headline}
              className={`flex flex-col items-center gap-8 md:flex-row md:gap-12 ${
                i % 2 === 1 ? "md:flex-row-reverse" : ""
              }`}
            >
              <div className="w-full max-w-[240px] shrink-0 sm:max-w-[260px]">
                <div className={`rounded-[2.5rem] p-4 ${f.bg}`}>
                  <Image
                    src={f.image}
                    alt={f.alt}
                    width={1520}
                    height={2688}
                    sizes="(min-width: 768px) 260px, 60vw"
                    className="w-full rounded-[1.75rem] shadow-xl"
                  />
                </div>
              </div>

              <div className="w-full max-w-md text-center md:text-left">
                <span className="text-xs font-semibold uppercase tracking-wide text-brand-coral">
                  {f.eyebrow}
                </span>
                <h3 className="font-display mt-2 text-2xl font-bold text-brand-midnight">
                  {f.headline}
                </h3>
                <p className="font-display mt-3 text-xl font-semibold text-brand-emerald">{f.quote}</p>
                <p className="mt-3 text-brand-midnight/70">{f.body}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-14 text-center">
          <CTAButton className="font-display rounded-full bg-brand-emerald px-8 py-4 text-lg font-bold text-white shadow-lg shadow-brand-emerald/20 transition active:scale-[0.99]">
            {dict.viral.cta}
          </CTAButton>
        </div>
      </div>
    </section>
  );
}
