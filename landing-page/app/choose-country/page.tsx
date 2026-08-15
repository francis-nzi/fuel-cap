import Link from "next/link";
import type { Metadata } from "next";
import { MARKET_LIST } from "@/lib/markets";
import { getDictionary } from "@/lib/i18n";

export const metadata: Metadata = { title: "FuelCap — Choose your country" };

export default function ChooseCountryPage() {
  return (
    <main className="flex flex-1 items-center justify-center bg-brand-midnight px-5 py-16 text-white">
      <div className="w-full max-w-sm">
        <p className="font-display text-center text-2xl font-bold">FuelCap</p>
        <h1 className="mt-2 text-center text-white/60">Choose your country</h1>

        <div className="mt-8 flex flex-col gap-3">
          {MARKET_LIST.map((m) => {
            const dict = getDictionary(m.language);
            return (
              <Link
                key={m.id}
                href={`/${m.slug}`}
                className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/5 px-5 py-4 text-lg font-semibold transition hover:border-brand-emerald hover:bg-brand-emerald/10"
              >
                <span className="text-2xl leading-none">{m.flag}</span>
                {dict.signup.country.options[m.id]}
              </Link>
            );
          })}
        </div>
      </div>
    </main>
  );
}
