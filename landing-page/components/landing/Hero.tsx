import Image from "next/image";
import CTAButton from "@/components/signup/CTAButton";
import { interpolate } from "@/lib/i18n";
import type { Dictionary } from "@/lib/i18n";
import type { Market } from "@/lib/markets";

export default function Hero({ dict, market }: { dict: Dictionary; market: Market }) {
  const vars = { fuelWord: market.fuelWord };

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-brand-emerald to-brand-pine px-5 pb-14 pt-[calc(env(safe-area-inset-top)+2rem)] text-white">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-10 md:flex-row md:gap-14">
        <div className="w-full max-w-md text-center md:text-left">
          <span className="inline-block rounded-full bg-white/15 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-brand-amber">
            {dict.hero.badge}
          </span>

          <h1 className="font-display mt-5 text-4xl font-bold leading-[1.05] sm:text-5xl">
            {dict.hero.headlineLine1}
            <br />
            <span className="text-brand-amber">{dict.hero.headlineLine2}</span>
          </h1>

          <p className="mt-5 text-lg text-white/85">{interpolate(dict.hero.subhead, vars)}</p>

          <div className="mt-6 flex justify-center gap-3 md:justify-start">
            <div className="rounded-xl border border-white/20 bg-white/10 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-amber">
                {dict.hero.priceRisesLabel}
              </p>
              <p className="font-display text-lg font-bold">{dict.hero.youWin}</p>
            </div>
            <div className="rounded-xl border border-white/20 bg-white/10 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-coral">
                {dict.hero.priceFallsLabel}
              </p>
              <p className="font-display text-lg font-bold">{dict.hero.youWin}</p>
            </div>
          </div>

          <p className="mt-4 text-sm font-medium text-white/70">{dict.hero.tagline}</p>

          <CTAButton className="font-display mt-7 w-full rounded-full bg-brand-amber px-8 py-4 text-lg font-bold text-brand-midnight shadow-lg shadow-black/10 transition active:scale-[0.99] md:w-auto">
            {dict.hero.cta}
          </CTAButton>
          <p className="mt-3 text-xs text-white/60">{dict.hero.ctaSub}</p>
        </div>

        <div className="w-full max-w-[280px] shrink-0 sm:max-w-[320px]">
          <Image
            src="/images/hero.png"
            alt="FuelCap app onboarding screen on an iPhone"
            width={1520}
            height={2688}
            priority
            sizes="(min-width: 768px) 320px, 70vw"
            className="w-full rounded-[2.5rem] drop-shadow-2xl"
          />
        </div>
      </div>
    </section>
  );
}
