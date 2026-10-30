"use client";

import { X } from "lucide-react";
import { money, type Market } from "@/lib/markets";
import { quoteProtection, round4 } from "@/lib/protection";

// Pump moves for the acceptance cases, relative to the station's price today. At the $3.50 US demo station they give
// the brief's $3.40 / $3.50 / $3.90 / $4.20 (Cost of Protection §5.3, cases C, A and B).
export const PRESENTER_SCENARIOS = [
  { ratio: 3.4 / 3.5, label: "Price falls", note: "−3%" },
  { ratio: 1, label: "Same as today", note: "No change" },
  { ratio: 3.9 / 3.5, label: "Price rises", note: "+11%, inside the cover" },
  { ratio: 4.2 / 3.5, label: "Spike past limit", note: "+20%, above +15%" },
] as const;

export type RunOfShow = { protected: boolean; moved: boolean; paid: boolean; fell: boolean; shared: boolean };

export function PresenterPanel({ market, reference, ratio, setRatio, stationName, steps, reset, chargeRate, planName, endWindow, close }: {
  market: Market; reference: number | null; ratio: number; setRatio: (ratio: number) => void; stationName: string; steps: RunOfShow; reset: () => void;
  chargeRate: number; planName: string; endWindow?: () => void; close?: () => void;
}) {
  const quote = reference === null ? null : quoteProtection(reference, 1, undefined, chargeRate);
  const checklist: [string, boolean][] = [
    ["Add money. We protect the usual week's fuel automatically.", steps.protected],
    ["Move the pump price.", steps.moved],
    ["Pay at the pump.", steps.paid],
    ["Show a price fall, the “tails you win” moment.", steps.fell],
    ["Share the win.", steps.shared],
  ];
  return (
    <aside aria-label="Presenter controls" className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-bold tracking-[0.08em] text-[#0b7a4b]">PRESENTER CONTROLS · NOT PART OF THE APP</span>
          <h2 className="m-0 font-display text-2xl font-bold leading-tight lg:text-3xl">Move the market, then pay at the pump</h2>
          <p className="m-0 max-w-[560px] text-sm leading-normal text-[#33443d]">One tap moves every pump price in {market.name} by the same step, measured from {stationName}, so you can show a rise, a spike and a fall without leaving the screen.</p>
        </div>
        {close && <button type="button" onClick={close} aria-label="Close presenter controls" className="grid size-11 shrink-0 place-items-center rounded-xl border border-[#d3ded8] bg-white"><X size={18} /></button>}
      </div>
      {reference !== null ? <div className="flex flex-col gap-2.5">
        <span className="text-[13px] font-bold text-[#33443d]" id="presenter-pump">Pump price at {stationName}</span>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4" role="radiogroup" aria-labelledby="presenter-pump">
          {PRESENTER_SCENARIOS.map((scenario) => {
            const on = Math.abs(scenario.ratio - ratio) < 1e-9;
            const price = round4(reference * scenario.ratio);
            return <button key={scenario.label} type="button" role="radio" aria-checked={on} aria-label={`${scenario.label}: ${money(price, market)}`} onClick={() => setRatio(scenario.ratio)} className={`flex min-h-24 flex-col items-start gap-1 rounded-2xl p-3.5 text-left ${on ? "border-2 border-[#0b7a4b] bg-[#dff5e9]" : "border border-[#d3ded8] bg-white"}`}>
              <span className="text-xs font-bold text-[#52625c]">{scenario.label}</span>
              <span className="font-display text-2xl font-bold">{money(price, market)}</span>
              <span className="text-xs text-[#52625c]">{scenario.note}</span>
            </button>;
          })}
        </div>
      </div> : <p className="m-0 rounded-xl border border-[#d3ded8] bg-white p-3.5 text-sm text-[#33443d]">Loading prices…</p>}
      <section className="flex flex-col gap-3 rounded-[18px] border border-[#d3ded8] bg-white p-5">
        <h3 className="m-0 text-[13px] font-bold text-[#33443d]">Run of show</h3>
        <ol className="m-0 flex list-none flex-col gap-3 p-0">
          {checklist.map(([label, done], index) => <li key={label} className="flex items-center gap-3">
            <span aria-hidden="true" className={`grid size-7 shrink-0 place-items-center rounded-full text-[13px] font-bold ${done ? "bg-[#0b7a4b] text-white" : "bg-[#eef2f0] text-[#33443d]"}`}>{done ? "✓" : index + 1}</span>
            <span className={`text-[15px] ${done ? "text-[#52625c] line-through" : ""}`}>{label}<span className="sr-only">{done ? " (done)" : ""}</span></span>
          </li>)}
        </ol>
      </section>
      {quote && <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {[["Today's price", money(quote.reference, market)], ["Cap (+5%)", money(quote.strike, market)], ["Limit (+15%)", money(quote.boundary, market)], [`Charge (${planName}, ${(chargeRate * 100).toFixed(2)}%)`, `${money(quote.chargePerUnit, market, 4)}/${market.unit}`]].map(([label, value]) => (
          <div key={label} className="flex flex-col gap-0.5 rounded-[14px] border border-[#d3ded8] bg-[#f4f8f6] p-3"><span className="text-xs text-[#52625c]">{label}</span><span className="text-[17px] font-bold">{value}</span></div>
        ))}
      </div>}
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={reset} className="min-h-[46px] rounded-xl border border-[#0b1b2b] bg-white px-5 text-[15px] font-bold">Reset demo</button>
        <button type="button" onClick={endWindow} disabled={!endWindow} className="min-h-[46px] rounded-xl border border-[#0b1b2b] bg-white px-5 text-[15px] font-bold disabled:opacity-40">End this window (auto-renew)</button>
        <span className="text-[13px] text-[#52625c]">Cap +5%, limit +15%, charge at the customer&apos;s plan spread (DEC-065). Simulated money only.</span>
      </div>
    </aside>
  );
}
