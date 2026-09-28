"use client";

import { X } from "lucide-react";
import { money, markets } from "@/lib/markets";
import { quoteProtection } from "@/lib/protection";

// Pump moves for the brief's acceptance cases, around the $3.50 demo station (Cost of Protection §5.3).
export const PRESENTER_SCENARIOS = [
  { price: 3.4, label: "Price falls", note: "Case C" },
  { price: 3.5, label: "Same as today", note: "No change" },
  { price: 3.9, label: "Price rises", note: "Case A" },
  { price: 4.2, label: "Spike past limit", note: "Case B" },
] as const;
export const PRESENTER_REFERENCE = 3.5;

export type RunOfShow = { protected: boolean; moved: boolean; paid: boolean; fell: boolean; shared: boolean };

export function PresenterPanel({ pump, setPump, steps, reset, available, close }: { pump: number; setPump: (price: number) => void; steps: RunOfShow; reset: () => void; available: boolean; close?: () => void }) {
  const market = markets.US;
  const reference = quoteProtection(PRESENTER_REFERENCE, 1);
  const checklist: [string, boolean][] = [
    ["Protect 25 gal. Funds are added in the same step.", steps.protected],
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
          <p className="m-0 max-w-[560px] text-sm leading-normal text-[#33443d]">One tap changes the pump price the app sees, so you can show a rise, a spike and a fall without leaving the screen. Works without the control room.</p>
        </div>
        {close && <button type="button" onClick={close} aria-label="Close presenter controls" className="grid size-11 shrink-0 place-items-center rounded-xl border border-[#d3ded8] bg-white"><X size={18} /></button>}
      </div>
      {available ? <div className="flex flex-col gap-2.5">
        <span className="text-[13px] font-bold text-[#33443d]" id="presenter-pump">Pump price at Shell Downtown</span>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4" role="radiogroup" aria-labelledby="presenter-pump">
          {PRESENTER_SCENARIOS.map((scenario) => {
            const on = Math.abs(scenario.price - pump) < 1e-9;
            return <button key={scenario.price} type="button" role="radio" aria-checked={on} aria-label={`${scenario.label}: ${money(scenario.price, market)}`} onClick={() => setPump(scenario.price)} className={`flex min-h-24 flex-col items-start gap-1 rounded-2xl p-3.5 text-left ${on ? "border-2 border-[#0b7a4b] bg-[#dff5e9]" : "border border-[#d3ded8] bg-white"}`}>
              <span className="text-xs font-bold text-[#52625c]">{scenario.label}</span>
              <span className="font-display text-2xl font-bold">{money(scenario.price, market)}</span>
              <span className="text-xs text-[#52625c]">{scenario.note}</span>
            </button>;
          })}
        </div>
      </div> : <p className="m-0 rounded-xl border border-[#d3ded8] bg-white p-3.5 text-sm text-[#33443d]">Pump controls work in the US market. Switch country in Account to use them.</p>}
      <section className="flex flex-col gap-3 rounded-[18px] border border-[#d3ded8] bg-white p-5">
        <h3 className="m-0 text-[13px] font-bold text-[#33443d]">Run of show</h3>
        <ol className="m-0 flex list-none flex-col gap-3 p-0">
          {checklist.map(([label, done], index) => <li key={label} className="flex items-center gap-3">
            <span aria-hidden="true" className={`grid size-7 shrink-0 place-items-center rounded-full text-[13px] font-bold ${done ? "bg-[#0b7a4b] text-white" : "bg-[#eef2f0] text-[#33443d]"}`}>{done ? "✓" : index + 1}</span>
            <span className={`text-[15px] ${done ? "text-[#52625c] line-through" : ""}`}>{label}<span className="sr-only">{done ? " (done)" : ""}</span></span>
          </li>)}
        </ol>
      </section>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {[["Today's price", money(PRESENTER_REFERENCE, market)], ["Cap (+5%)", money(reference.strike, market)], ["Limit (+15%)", money(reference.boundary, market)], ["Charge (2.3%)", `${money(reference.chargePerUnit, market)}/gal`]].map(([label, value]) => (
          <div key={label} className="flex flex-col gap-0.5 rounded-[14px] border border-[#d3ded8] bg-[#f4f8f6] p-3"><span className="text-xs text-[#52625c]">{label}</span><span className="text-[17px] font-bold">{value}</span></div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={reset} className="min-h-[46px] rounded-xl border border-[#0b1b2b] bg-white px-5 text-[15px] font-bold">Reset demo</button>
        <span className="text-[13px] text-[#52625c]">Numbers match Cost of Protection §5.3, cases A, B and C. Simulated money only.</span>
      </div>
    </aside>
  );
}
