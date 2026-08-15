export default function PageHero({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <section className="bg-gradient-to-b from-brand-emerald to-brand-pine px-5 pb-14 pt-14 text-white">
      <div className="mx-auto max-w-3xl text-center">
        {eyebrow && (
          <span className="inline-block rounded-full bg-white/15 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-brand-amber">
            {eyebrow}
          </span>
        )}
        <h1 className="font-display mt-4 text-3xl font-bold leading-[1.1] sm:text-4xl">{title}</h1>
        {subtitle && <p className="mx-auto mt-4 max-w-2xl text-lg text-white/85">{subtitle}</p>}
      </div>
    </section>
  );
}
