"use client";

import { useState } from "react";
import Link from "next/link";
import { useSignup } from "@/components/signup/SignupContext";
import { getSiteChrome } from "@/lib/site-nav";

export default function SiteHeader({ marketSlug }: { marketSlug: string }) {
  const { openSignup, market } = useSignup();
  const chrome = getSiteChrome(market.language);
  const [open, setOpen] = useState(false);

  const base = `/${marketSlug}`;
  const links = [
    { href: `${base}/how-it-works`, label: chrome.nav.howItWorks },
    { href: `${base}/pricing`, label: chrome.nav.pricing },
    { href: `${base}/faq`, label: chrome.nav.faq },
    { href: `${base}/about`, label: chrome.nav.about },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-black/5 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
        <Link href={base} className="flex items-center gap-2" aria-label="FuelCap home">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-brand-emerald text-white">
            <span className="font-display text-sm font-bold leading-none">+</span>
          </span>
          <span className="font-display text-lg font-bold tracking-tight text-brand-midnight">
            FuelCap
          </span>
        </Link>

        <nav className="hidden items-center gap-7 md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-sm font-medium text-brand-midnight/70 transition hover:text-brand-midnight"
            >
              {l.label}
            </Link>
          ))}
          <button
            onClick={openSignup}
            className="font-display rounded-full bg-brand-emerald px-5 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-brand-pine active:scale-[0.99]"
          >
            {chrome.nav.cta}
          </button>
        </nav>

        <button
          onClick={() => setOpen((v) => !v)}
          className="grid h-9 w-9 place-items-center rounded-lg text-brand-midnight md:hidden"
          aria-label={open ? chrome.nav.closeMenu : chrome.nav.openMenu}
          aria-expanded={open}
        >
          <span className="relative block h-4 w-5">
            <span
              className={`absolute left-0 block h-0.5 w-5 bg-current transition ${open ? "top-2 rotate-45" : "top-0"}`}
            />
            <span
              className={`absolute left-0 top-2 block h-0.5 w-5 bg-current transition ${open ? "opacity-0" : "opacity-100"}`}
            />
            <span
              className={`absolute left-0 block h-0.5 w-5 bg-current transition ${open ? "top-2 -rotate-45" : "top-4"}`}
            />
          </span>
        </button>
      </div>

      {open && (
        <div className="border-t border-black/5 bg-background md:hidden">
          <nav className="mx-auto flex max-w-6xl flex-col gap-1 px-5 py-3">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-2 py-2.5 text-base font-medium text-brand-midnight/80 transition hover:bg-brand-mint"
              >
                {l.label}
              </Link>
            ))}
            <button
              onClick={() => {
                setOpen(false);
                openSignup();
              }}
              className="font-display mt-2 rounded-full bg-brand-emerald px-5 py-3 text-center text-base font-bold text-white"
            >
              {chrome.nav.cta}
            </button>
          </nav>
        </div>
      )}
    </header>
  );
}
