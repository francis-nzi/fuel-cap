import type { Dictionary } from "@/lib/i18n";

export default function GuaranteeSection({ dict }: { dict: Dictionary }) {
  const guarantees = [
    { label: dict.guarantee.item1Label, detail: dict.guarantee.item1Detail },
    { label: dict.guarantee.item2Label, detail: dict.guarantee.item2Detail },
    { label: dict.guarantee.item3Label, detail: dict.guarantee.item3Detail },
  ];
  const audiences = [dict.guarantee.audience1, dict.guarantee.audience2, dict.guarantee.audience3];

  return (
    <section className="px-5 py-16">
      <div className="mx-auto max-w-3xl rounded-3xl bg-brand-mint p-8 sm:p-10">
        <h2 className="font-display text-center text-2xl font-bold text-brand-midnight sm:text-3xl">
          {dict.guarantee.headline}
        </h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {guarantees.map((g) => (
            <div key={g.label} className="rounded-2xl bg-white p-5 text-center shadow-sm">
              <div className="mx-auto grid h-9 w-9 place-items-center rounded-full bg-brand-emerald text-white">
                ✓
              </div>
              <p className="font-display mt-3 font-bold text-brand-midnight">{g.label}</p>
              <p className="mt-1 text-sm text-brand-midnight/70">{g.detail}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-emerald">
            {dict.guarantee.builtFor}
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {audiences.map((a) => (
              <span
                key={a}
                className="rounded-full border border-brand-emerald/30 bg-white px-4 py-1.5 text-sm font-medium text-brand-midnight"
              >
                {a}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
