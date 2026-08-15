import Link from "next/link";
import type { Dictionary } from "@/lib/i18n";
import type { Market } from "@/lib/markets";
import { getSiteChrome } from "@/lib/site-nav";

export default function Footer({ dict, market }: { dict: Dictionary; market: Market }) {
  const chrome = getSiteChrome(market.language);
  const base = `/${market.slug}`;
  const year = new Date().getFullYear();

  const cols = [
    {
      heading: chrome.footer.product,
      links: [
        { href: base, label: chrome.footer.linkHome },
        { href: `${base}/how-it-works`, label: chrome.footer.linkHowItWorks },
        { href: `${base}/pricing`, label: chrome.footer.linkPricing },
        { href: `${base}/faq`, label: chrome.footer.linkFaq },
      ],
    },
    {
      heading: chrome.footer.company,
      links: [
        { href: `${base}/about`, label: chrome.footer.linkAbout },
        { href: `${base}/contact`, label: chrome.footer.linkContact },
        { href: "/choose-country", label: dict.footer.changeMarket },
      ],
    },
    {
      heading: chrome.footer.legalHeading,
      links: [
        { href: `${base}/legal/privacy`, label: chrome.footer.linkPrivacy },
        { href: `${base}/legal/terms`, label: chrome.footer.linkTerms },
      ],
    },
  ];

  return (
    <footer className="bg-brand-midnight px-5 pb-10 pt-12 text-white/60">
      <div className="mx-auto grid max-w-6xl gap-10 sm:grid-cols-2 md:grid-cols-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-brand-emerald text-white">
              <span className="font-display text-sm font-bold leading-none">+</span>
            </span>
            <span className="font-display text-lg font-bold text-white">FuelCap</span>
          </div>
          <p className="mt-3 max-w-xs text-sm text-white/50">{dict.footer.tagline}</p>
          <p className="mt-3 text-sm">
            <a
              href="mailto:info@fuelcap.tech"
              className="text-white/60 underline underline-offset-2 hover:text-white"
            >
              info@fuelcap.tech
            </a>
          </p>
        </div>

        {cols.map((col) => (
          <div key={col.heading}>
            <p className="font-display text-xs font-semibold uppercase tracking-wide text-white/40">
              {col.heading}
            </p>
            <ul className="mt-3 flex flex-col gap-2 text-sm">
              {col.links.map((l) => (
                <li key={l.href + l.label}>
                  <Link href={l.href} className="text-white/60 transition hover:text-white">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mx-auto mt-10 max-w-6xl border-t border-white/10 pt-6">
        <p className="max-w-3xl text-[11px] leading-relaxed text-white/35">
          {dict.footer.disclaimer}
        </p>
        <p className="mt-4 text-[11px] text-white/35">
          © {year} FuelCap. {chrome.footer.rights} {chrome.footer.trademark} www.fuelcap.tech
        </p>
      </div>
    </footer>
  );
}
