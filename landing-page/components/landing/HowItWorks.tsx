import type { Dictionary } from "@/lib/i18n";
import { interpolate } from "@/lib/i18n";
import type { Market } from "@/lib/markets";

export default function HowItWorks({ dict, market }: { dict: Dictionary; market: Market }) {
  const vars = {
    volumeSingular: market.volumeUnit === "gal" ? "gallon" : "litre",
    volumePlural: market.volumeUnit === "gal" ? "gallons" : "litres",
  };
  const steps = [
    { n: "1", title: dict.how.step1Title, body: interpolate(dict.how.step1Body, vars) },
    { n: "2", title: dict.how.step2Title, body: dict.how.step2Body },
    { n: "3", title: dict.how.step3Title, body: dict.how.step3Body },
  ];

  return (
    <section className="bg-brand-midnight px-5 py-16 text-white">
      <div className="mx-auto max-w-4xl">
        <div className="mx-auto max-w-xl text-center">
          <span className="text-xs font-semibold uppercase tracking-wide text-brand-amber">
            {dict.how.eyebrow}
          </span>
          <h2 className="font-display mt-2 text-3xl font-bold sm:text-4xl">{dict.how.headline}</h2>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-3">
          {steps.map((s) => (
            <div key={s.n} className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <span className="font-display grid h-10 w-10 place-items-center rounded-full bg-brand-emerald text-lg font-bold">
                {s.n}
              </span>
              <h3 className="font-display mt-4 text-xl font-bold">{s.title}</h3>
              <p className="mt-2 text-sm text-white/70">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
