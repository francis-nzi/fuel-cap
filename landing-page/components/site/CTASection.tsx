import CTAButton from "@/components/signup/CTAButton";
import type { Dictionary } from "@/lib/i18n";

export default function CTASection({ dict }: { dict: Dictionary }) {
  return (
    <section className="px-5 py-16">
      <div className="mx-auto max-w-3xl rounded-3xl bg-brand-midnight px-6 py-12 text-center text-white">
        <h2 className="font-display text-2xl font-bold sm:text-3xl">
          {dict.finalCta.headlineLine1}{" "}
          <span className="text-brand-amber">{dict.finalCta.headlineLine2}</span>
        </h2>
        <p className="mx-auto mt-3 max-w-md text-white/70">{dict.finalCta.body}</p>
        <CTAButton className="font-display mt-7 inline-block rounded-full bg-brand-amber px-8 py-4 text-lg font-bold text-brand-midnight shadow-lg transition active:scale-[0.99]">
          {dict.finalCta.cta}
        </CTAButton>
      </div>
    </section>
  );
}
