"use client";

import Image from "next/image";
import { Home, List, QrCode, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import type { Screen } from "./types";

// Deep Pine carries white text at AA contrast; Emerald is kept for accents and dark surfaces.
export const primaryButton = "inline-flex min-h-[52px] items-center justify-center gap-2 rounded-[14px] bg-[#0b7a4b] px-5 text-base font-bold text-white transition-colors hover:bg-[#0b1b2b] disabled:cursor-not-allowed disabled:opacity-50";
export const secondaryButton = "inline-flex min-h-[52px] items-center justify-center gap-2 rounded-[14px] border border-[#b8d6c3] bg-white px-5 text-base font-bold text-[#0b7a4b] disabled:cursor-not-allowed disabled:opacity-50";
export const card = "rounded-2xl border border-[#e1e8e4] bg-white";
export const chip = (on: boolean) => `min-h-12 rounded-xl text-[15px] font-bold ${on ? "border-2 border-[#0b7a4b] bg-[#dff5e9] text-[#0b7a4b]" : "border border-[#d3ded8] bg-white text-[#33443d]"}`;

export function Brand() {
  return (
    <div className="flex items-center gap-2">
      <Image src="/fuelcap-mark.svg" alt="" width={28} height={28} style={{ height: "auto" }} />
      <span className="font-display text-[19px] font-bold">FuelCap</span>
    </div>
  );
}

export function Header({ pill, initials, openAccount, accountOpen }: { pill: string; initials: string; openAccount: () => void; accountOpen: boolean }) {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-[#e1e8e4] bg-white px-5">
      <Brand />
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-[#fff3d6] px-2 py-1 text-[11px] font-bold tracking-wide text-[#6b5310]" title="Simulated money only" data-testid="demo-pill">{pill}</span>
        <button type="button" onClick={openAccount} aria-label="Account and settings" aria-pressed={accountOpen} className={`grid size-11 place-items-center rounded-full text-[13px] font-bold ${accountOpen ? "bg-[#0b7a4b] text-white" : "bg-[#dff5e9] text-[#0b7a4b]"}`}>{initials}</button>
      </div>
    </header>
  );
}

const tabs: { label: string; target: Screen; screens: Screen[]; icon: typeof Home }[] = [
  { label: "Home", target: "home", screens: ["home", "onboarding"], icon: Home },
  { label: "Protect", target: "protect", screens: ["protect", "done"], icon: ShieldCheck },
  { label: "Pay", target: "pay", screens: ["pay", "receipt"], icon: QrCode },
  { label: "Activity", target: "activity", screens: ["activity"], icon: List },
];

export function TabBar({ screen, go }: { screen: Screen; go: (screen: Screen) => void }) {
  return (
    <nav className="grid h-[76px] shrink-0 grid-cols-4 border-t border-[#e1e8e4] bg-white pb-[env(safe-area-inset-bottom)]" aria-label="Primary navigation">
      {tabs.map(({ label, target, screens, icon: Icon }) => {
        const active = screens.includes(screen);
        return (
          <button key={label} type="button" onClick={() => go(target)} aria-current={active ? "page" : undefined} className={`flex flex-col items-center justify-center gap-1 text-xs font-semibold ${active ? "text-[#0b7a4b]" : "text-[#52625c]"}`}>
            <Icon size={22} strokeWidth={active ? 2.5 : 2} aria-hidden="true" /><span>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}

/** The screen's main action, pinned above the tab bar so it never scrolls away. */
export function StickyAction({ children }: { children: ReactNode }) {
  return <div className="shrink-0 border-t border-[#e1e8e4] bg-white px-5 py-3">{children}</div>;
}

export function Row({ label, sub, value, strong = false, tone }: { label: ReactNode; sub?: ReactNode; value: ReactNode; strong?: boolean; tone?: string }) {
  return (
    <div className={`flex items-start justify-between gap-3 ${strong ? "text-[15px] font-bold" : "text-sm"}`}>
      <span className={strong ? "" : "text-[#33443d]"}>{label}{sub && <span className="block text-xs font-normal text-[#52625c]">{sub}</span>}</span>
      <span className={`whitespace-nowrap ${strong ? "" : "font-semibold"} ${tone ?? ""}`}>{value}</span>
    </div>
  );
}
