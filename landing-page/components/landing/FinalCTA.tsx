import CTAButton from "@/components/signup/CTAButton";
import type { Dictionary } from "@/lib/i18n";
import { interpolate } from "@/lib/i18n";
import type { Market } from "@/lib/markets";

export default function FinalCTA({ dict, market }: { dict: Dictionary; market: Market }) {
  const volumeSingular = market.volumeUnit === "gal" ? "gallon" : "litre";
  return (
    <section className="bg-gradient-to-b from-brand-pine to-brand-midnight px-5 py-20 text-center text-white">
      <div className="mx-auto max-w-lg">
        <h2 className="font-display text-3xl font-bold leading-tight sm:text-4xl">
          {dict.finalCta.headlineLine1}
          <br />
          {dict.finalCta.headlineLine2}
        </h2>
        <p className="mt-4 text-white/80">
          {interpolate(dict.finalCta.body, { volumeSingular })}
        </p>
        <CTAButton className="font-display mt-8 w-full rounded-full bg-brand-amber px-8 py-4 text-lg font-bold text-brand-midnight shadow-lg transition active:scale-[0.99] sm:w-auto">
          {dict.finalCta.cta}
        </CTAButton>
      </div>
    </section>
  );
}
