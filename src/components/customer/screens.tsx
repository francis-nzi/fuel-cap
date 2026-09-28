"use client";

import { Check, Search } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";
import { money } from "@/lib/markets";
import type { PriceOption } from "@/lib/price-options";
import { cents, type Quote } from "@/lib/protection";
import { card, chip, primaryButton, Row, secondaryButton } from "./ui";
import { shortLabel, type LockRecord, type MarketProps, type Receipt, type Screen, type TransactionRecord } from "./types";

const perUnit = (value: number, market: MarketProps["market"]) => `${money(value, market)}/${market.unit}`;
const Title = ({ children, sub }: { children: React.ReactNode; sub?: React.ReactNode }) => (
  <div className="flex flex-col gap-1"><h1 className="m-0 font-display text-[26px] font-bold leading-tight">{children}</h1>{sub && <p className="m-0 text-sm leading-snug text-[#52625c]">{sub}</p>}</div>
);

export function pumpStatus(pumpPrice: number, lock: LockRecord, market: MarketProps["market"]) {
  if (pumpPrice < lock.strike) return { label: "Pump is below your cap", value: `You pay ${money(pumpPrice, market)}`, tone: "text-[#ff9a8c]" };
  if (pumpPrice === lock.strike) return { label: "Right at your cap", value: `You pay ${money(lock.strike, market)}`, tone: "text-white" };
  if (pumpPrice <= lock.boundary) return { label: "FuelCap covers", value: perUnit(pumpPrice - lock.strike, market), tone: "text-[#ffc24b]" };
  return { label: "Above your limit", value: `Covered to ${money(lock.boundary, market)}`, tone: "text-[#ffc24b]" };
}

/* ---------- Home ---------- */

export function HomeScreen({ market, firstName, showProfile, startProfile, loading, referencePrice, referenceLabel, previewStrike, days, wallet, lock, pumpPrice, daysLeft, heldValue, savings, go, share, shareLabel }: MarketProps & {
  firstName: string; showProfile: boolean; startProfile: () => void; loading: boolean; referencePrice: number | null; referenceLabel: string; previewStrike: number | null; days: number;
  wallet: number; lock?: LockRecord; pumpPrice: number; daysLeft: number; heldValue: number; savings: number; go: (screen: Screen) => void; share: () => void; shareLabel: string;
}) {
  const greeting = <span className="text-sm text-[#52625c]">Hi {firstName}</span>;
  if (lock) {
    const status = pumpStatus(pumpPrice, lock, market);
    return <div className="view-enter flex flex-col gap-4">
      <div className="flex flex-col gap-1">{greeting}<h1 className="m-0 font-display text-[26px] font-bold leading-tight">Your fuel is capped</h1></div>
      <section className="flex flex-col gap-3.5 rounded-[20px] bg-[#0b1b2b] p-5 text-white">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-0.5"><span className="text-xs font-semibold text-[#a9c9ba]">YOUR MAX PRICE</span><span className="text-[13px] text-[#d5e3dc]">{lock.remainingVolume} {market.unit} at {shortLabel(lock.scopeLabel)}</span></div>
          <span className="rounded-full bg-[#17364a] px-2 py-0.5 text-[11px] text-[#dff5e9]">{daysLeft} {daysLeft === 1 ? "day" : "days"} left</span>
        </div>
        <p className="m-0 font-display text-[44px] font-bold leading-none" data-testid="headline-unit-price">{money(lock.strike, market)}<span className="text-base font-medium text-[#a9c9ba]"> /{market.unit}</span></p>
        <div className="grid grid-cols-2 gap-3 border-t border-[#284052] pt-3.5">
          <div className="flex flex-col gap-0.5"><span className="text-xs text-[#a9c9ba]">Pump now</span><span className="text-xl font-bold" data-testid="pump-now">{money(pumpPrice, market)}</span></div>
          <div className="flex flex-col gap-0.5 border-l border-[#284052] pl-3"><span className="text-xs text-[#a9c9ba]">{status.label}</span><span className={`text-xl font-bold ${status.tone}`}>{status.value}</span></div>
        </div>
        <div className="flex gap-2.5">
          <button type="button" onClick={() => go("pay")} className="min-h-[50px] flex-1 rounded-[14px] bg-[#0ba75e] text-base font-bold text-[#06231a]">Pay at pump</button>
          <button type="button" onClick={() => go("protect")} className="min-h-[50px] rounded-[14px] border border-[#476070] px-4 text-[15px] font-semibold text-white">Protect more</button>
        </div>
      </section>
      <div className="grid grid-cols-2 gap-3">
        <div className={`${card} flex flex-col gap-1 p-3.5`}><span className="text-[13px] text-[#52625c]">Protected fuel</span><span className="text-xl font-bold">{lock.remainingVolume} {market.unit}</span><span className="text-xs text-[#52625c]">{money(heldValue, market)} held for it</span></div>
        <div className={`${card} flex flex-col gap-1 p-3.5`}><span className="text-[13px] text-[#52625c]">Wallet</span><span className="text-xl font-bold" data-testid="wallet-balance">{money(wallet, market)}</span><span className="text-xs text-[#52625c]">Free to use</span></div>
      </div>
      {savings > 0 && <SavedCard market={market} savings={savings} share={share} shareLabel={shareLabel} />}
    </div>;
  }
  return <div className="view-enter flex flex-col gap-4">
    <div className="flex flex-col gap-1">{greeting}<h1 className="m-0 font-display text-[26px] font-bold leading-tight">Cap your fuel price. Never overpay.</h1></div>
    <section className="flex flex-col gap-3.5 rounded-[20px] bg-[#0b1b2b] p-5 text-white">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5"><span className="text-xs font-semibold text-[#a9c9ba]">PUMP PRICE NOW</span><span className="truncate text-[13px] text-[#d5e3dc]">{loading ? `Loading ${market.name} prices` : referenceLabel}</span></div>
        <span className="rounded-full bg-[#17364a] px-2 py-0.5 text-[11px] text-[#dff5e9]">Regular</span>
      </div>
      <p className="m-0 font-display text-[44px] font-bold leading-none" data-testid="headline-unit-price">{referencePrice === null ? "Loading…" : money(referencePrice, market)}{referencePrice !== null && <span className="text-base font-medium text-[#a9c9ba]"> /{market.unit}</span>}</p>
      <p className="m-0 text-sm leading-normal text-[#d5e3dc]">{previewStrike === null ? "Loading today's prices…" : <>Protect today and you&apos;ll never pay more than <strong className="text-[#ffc24b]">{perUnit(previewStrike, market)}</strong> for {days} days. If the price falls, you just pay the lower price.</>}</p>
      <button type="button" onClick={() => go("protect")} className="min-h-[52px] rounded-[14px] bg-[#0ba75e] text-base font-bold text-[#06231a]">Protect my fuel</button>
    </section>
    <section className={`${card} flex flex-col gap-3 p-4`}>
      <h2 className="m-0 text-[15px] font-bold">How it works</h2>
      {["Choose how much fuel to protect. Add funds in the same step.", "Price goes up? We pay the difference above your cap.", "Price goes down? You pay the lower price. Heads you win, tails you win."].map((text, index) => (
        <div key={text} className="flex items-start gap-3"><span className="grid size-[26px] shrink-0 place-items-center rounded-full bg-[#dff5e9] text-[13px] font-bold text-[#0b7a4b]">{index + 1}</span><span className="text-sm leading-snug text-[#33443d]">{text}</span></div>
      ))}
    </section>
    <div className={`${card} flex items-center justify-between gap-3 px-4 py-3.5`}>
      <div className="flex flex-col gap-0.5"><span className="text-[13px] text-[#52625c]">Wallet</span><span className="text-lg font-bold" data-testid="wallet-balance">{money(wallet, market)}</span></div>
      <span className="max-w-[170px] text-right text-[13px] text-[#52625c]">You can add funds when you protect</span>
    </div>
    {savings > 0 && <SavedCard market={market} savings={savings} share={share} shareLabel={shareLabel} />}
    {showProfile && <button type="button" onClick={startProfile} className={secondaryButton}>Create your profile</button>}
  </div>;
}

function SavedCard({ market, savings, share, shareLabel }: MarketProps & { savings: number; share: () => void; shareLabel: string }) {
  return <section className="flex items-center justify-between gap-3 rounded-2xl bg-[#fff3d6] p-4">
    <div className="flex flex-col gap-0.5"><span className="text-[13px] text-[#6b5310]">Saved with FuelCap so far</span><span className="font-display text-[22px] font-bold">{money(savings, market)}</span></div>
    <button type="button" onClick={share} className="min-h-11 rounded-xl bg-[#ffc24b] px-4 text-sm font-bold text-[#0b1b2b]">{shareLabel}</button>
  </section>;
}

/* ---------- Protect ---------- */

export function ProtectScreen({ market, stations, distances, selectedId, select, lock, volumes, volume, setVolume, quote, topUp, wallet, days, loading, paused }: MarketProps & {
  stations: PriceOption[]; distances: Record<string, number>; selectedId: string | null; select: (id: string) => void; lock?: LockRecord;
  volumes: number[]; volume: number; setVolume: (volume: number) => void; quote: Quote | null; topUp: number; wallet: number; days: number; loading: boolean; paused: boolean;
}) {
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(false);
  const hasDistances = stations.some((option) => option.scopeId && distances[option.scopeId] !== undefined);
  const ordered = hasDistances ? [...stations].sort((a, b) => (distances[a.scopeId ?? ""] ?? 1e9) - (distances[b.scopeId ?? ""] ?? 1e9)) : stations;
  const nearestId = hasDistances ? ordered[0]?.scopeId : null;
  const cheapestId = stations[0]?.scopeId;
  const searchable = stations.length > 8;
  const needle = query.trim().toLocaleLowerCase();
  const matching = ordered.filter((option) => !needle || `${option.label} ${option.providerName ?? ""}`.toLocaleLowerCase().includes(needle));
  // Three stations keep the amount and summary on screen; more on request or when searching.
  const shown = matching.slice(0, expanded || needle ? 8 : 3);
  const more = !expanded && !needle && matching.length > 3;
  const selected = ordered.find((option) => option.scopeId === selectedId);
  if (selected && !shown.includes(selected) && matching.includes(selected)) shown.unshift(selected);
  const search = (next: string) => {
    setQuery(next);
    const nextNeedle = next.trim().toLocaleLowerCase();
    const results = ordered.filter((option) => !nextNeedle || `${option.label} ${option.providerName ?? ""}`.toLocaleLowerCase().includes(nextNeedle));
    if (results[0] && !results.some((option) => option.scopeId === selectedId)) select(results[0].scopeId ?? "");
  };
  const typicalTank = market.unit === "gal" ? "about 15 gal" : "about 55 L";
  return <div className="view-enter flex flex-col gap-4">
    <Title sub={`Your price can't go above your cap for ${days} days. If it falls, you pay less.`}>Protect your fuel</Title>
    {paused && <p role="status" className="m-0 rounded-xl border border-[#efb0a8] bg-[#fff0ed] px-3 py-2.5 text-sm text-[#8a3026]">New protections are paused for a moment. Anything you&apos;ve already protected is unaffected.</p>}
    <section className="flex flex-col gap-2" aria-label="Station">
      <h2 className="m-0 text-[13px] font-bold text-[#33443d]">1 · Station</h2>
      {lock ? <p className="m-0 rounded-[14px] border border-[#e1e8e4] bg-white p-3.5 text-sm text-[#33443d]">Adding to your <strong>{shortLabel(lock.scopeLabel)}</strong> protection, same cap.</p> : <>
        {searchable && <label className="relative block"><span className="sr-only">Find a filling station</span><Search aria-hidden="true" size={18} className="absolute left-3 top-3.5 text-[#52625c]" /><input value={query} onChange={(event) => search(event.target.value)} placeholder="Station, postcode, town or city" className="h-12 w-full rounded-xl border border-[#cdd9d1] bg-white pl-10 pr-3 text-sm" /></label>}
        {loading ? <p className="m-0 p-3 text-sm text-[#52625c]">Loading {market.name} prices…</p> :
          <div className="flex flex-col gap-2" role="radiogroup" aria-label="Filling station">
            {shown.map((option) => {
              const on = option.scopeId === selectedId;
              const miles = option.scopeId ? distances[option.scopeId] : undefined;
              const tag = option.scopeId === nearestId ? "Nearest" : option.scopeId === cheapestId ? "Cheapest" : "";
              const address = option.label.split(" - ").slice(1).join(" - ") || option.providerName;
              return <button type="button" role="radio" aria-checked={on} key={option.scopeId} onClick={() => select(option.scopeId ?? "")} className={`flex w-full items-center justify-between gap-3 rounded-[14px] px-3.5 py-3 text-left ${on ? "border-2 border-[#0b7a4b] bg-[#f1faf5]" : "border border-[#d3ded8] bg-white"}`}>
                <span className="flex min-w-0 flex-col gap-0.5"><span className="truncate text-[15px] font-bold">{shortLabel(option.label)}</span><span className="truncate text-xs text-[#52625c]">{address}{miles !== undefined ? ` · ${miles} mi` : ""}</span></span>
                <span className="flex shrink-0 flex-col items-end gap-0.5"><span className="text-base font-bold">{money(option.unitPrice, market)}</span><span className="text-[11px] font-bold text-[#0b7a4b]">{on ? "Selected" : tag}</span></span>
              </button>;
            })}
            {!shown.length && <p className="m-0 p-3 text-sm text-[#52625c]">No matches. Try a shorter station, postcode, town or city.</p>}
          </div>}
        {more && !loading && <button type="button" onClick={() => setExpanded(true)} className="min-h-11 text-sm font-semibold text-[#0b7a4b]">Show more stations ({matching.length.toLocaleString(market.locale)})</button>}
      </>}
    </section>
    <section className="flex flex-col gap-2">
      <h2 className="m-0 text-[13px] font-bold text-[#33443d]" id="volume-label">2 · How much fuel?</h2>
      <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-labelledby="volume-label">
        {volumes.map((option) => <button type="button" role="radio" aria-checked={option === volume} key={option} onClick={() => setVolume(option)} className={chip(option === volume)}>{option} {market.unit}</button>)}
      </div>
      <p className="m-0 text-xs text-[#52625c]">A typical full tank is {typicalTank}.</p>
    </section>
    {quote && !loading && <section className={`${card} flex flex-col gap-3 p-4`} aria-label="Protection summary">
      <div className="flex items-end justify-between gap-3">
        <div className="flex flex-col gap-0.5"><span className="text-[13px] text-[#52625c]">Your max price</span><span className="text-xs text-[#52625c]">{lock ? "Same cap as your protection" : `5% above today's ${money(quote.reference, market)}`}</span></div>
        <span className="font-display text-[30px] font-bold text-[#0b7a4b]">{money(quote.strike, market)}<span className="text-sm text-[#52625c]">/{market.unit}</span></span>
      </div>
      <div className="h-px bg-[#e1e8e4]" />
      <Row label="Held for your fuel" sub={`${volume} ${market.unit} × ${money(quote.strike, market)}. Unused money stays yours.`} value={money(quote.held, market)} />
      <Row label="Protection charge" sub={`${perUnit(quote.chargePerUnit, market)}, one-off, not refundable`} value={money(quote.charge, market)} />
      <div className="h-px bg-[#e1e8e4]" />
      <Row label="Total from wallet" value={money(quote.total, market)} strong />
      {topUp > 0 && <p className="m-0 rounded-xl bg-[#f1f7f3] px-3 py-2.5 text-[13px] leading-snug text-[#33443d]">Your wallet has {money(wallet, market)}. We&apos;ll add <strong>{money(topUp, market)}</strong> from your card ending 4242 in the same step.</p>}
    </section>}
    {quote && !loading && <ul className="m-0 flex list-none flex-col gap-2 p-0 text-[13px] leading-snug text-[#33443d]">
      <li className="flex gap-2.5"><span aria-hidden="true" className="w-[18px] font-bold text-[#0b7a4b]">↑</span><span>Price rises: we pay the difference, up to {perUnit(quote.boundary, market)}.</span></li>
      <li className="flex gap-2.5"><span aria-hidden="true" className="w-[18px] font-bold text-[#c2402f]">↓</span><span>Price falls: you pay the lower pump price.</span></li>
      <li className="flex gap-2.5"><span aria-hidden="true" className="w-[18px] font-bold text-[#52625c]">∞</span><span>Your money never expires. Only the price cap has a clock.</span></li>
    </ul>}
  </div>;
}

/* ---------- Done ---------- */

export function DoneScreen({ market, lock, until, wallet, go }: MarketProps & { lock: LockRecord; until: string; wallet: number; go: (screen: Screen) => void }) {
  return <div className="view-enter flex flex-col gap-4">
    <div className="flex flex-col items-center gap-3 pt-10 text-center">
      <div className="grid size-[88px] place-items-center rounded-full bg-[#dff5e9]"><Check size={44} strokeWidth={2.5} className="text-[#0b7a4b]" aria-hidden="true" /></div>
      <h1 className="m-0 font-display text-[28px] font-bold">{lock.remainingVolume} {market.unit} protected</h1>
      <p className="m-0 text-[15px] leading-normal text-[#33443d]">You&apos;ll never pay more than <strong>{perUnit(lock.strike, market)}</strong> at {shortLabel(lock.scopeLabel)} until {until}.</p>
      <p className="m-0 text-[13px] text-[#52625c]">Wallet remaining: {money(wallet, market)}</p>
    </div>
    <div className="mt-3 flex flex-col gap-2.5">
      <button type="button" onClick={() => go("pay")} className={primaryButton}>Pay at pump now</button>
      <button type="button" onClick={() => go("home")} className={secondaryButton}>Back to home</button>
    </div>
  </div>;
}

/* ---------- Pay ---------- */

export function PayScreen({ market, lock, pumpPrice, fills, fill, setFill, code, go }: MarketProps & { lock?: LockRecord; pumpPrice: number; fills: number[]; fill: number; setFill: (volume: number) => void; code: string; go: (screen: Screen) => void }) {
  if (!lock) return <div className="view-enter flex flex-col gap-4">
    <Title>Pay at the pump</Title>
    <section className={`${card} flex flex-col items-center gap-2.5 p-6 text-center`}>
      <h2 className="m-0 text-[17px] font-bold">Nothing protected yet</h2>
      <p className="m-0 text-sm leading-snug text-[#52625c]">Protect some fuel first, then pay here at the pump.</p>
      <button type="button" onClick={() => go("protect")} className={`${primaryButton} min-h-12 px-5 text-[15px]`}>Protect my fuel</button>
    </section>
  </div>;
  return <div className="view-enter flex flex-col gap-4">
    <Title sub={`${shortLabel(lock.scopeLabel)} · Pump 4`}>Pay at the pump</Title>
    <section className="flex flex-col items-center gap-3 rounded-[20px] border border-[#e1e8e4] bg-white p-5">
      <QRCodeSVG value={`fuelcap-demo:${market.code}:${lock.id}:${code}`} size={180} fgColor="#0b1b2b" title="Pump payment code" />
      <p className="m-0 text-center text-[13px] text-[#52625c]">Scan at the pump, or tell the cashier <strong className="text-[#0b1b2b]">{code}</strong></p>
    </section>
    <section className="flex flex-col gap-2">
      <h2 className="m-0 text-[13px] font-bold text-[#33443d]" id="fill-label">How much are you filling?</h2>
      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-labelledby="fill-label">
        {fills.map((option, index) => <button type="button" role="radio" aria-checked={option === fill} key={option} onClick={() => setFill(option)} className={chip(option === fill)}>{index === fills.length - 1 && fills.length > 1 ? `All ${option}` : `${option} ${market.unit}`}</button>)}
      </div>
    </section>
    <div className="flex items-center justify-between rounded-[14px] bg-[#f1f7f3] px-3.5 py-3 text-sm"><span className="text-[#33443d]">Pump price right now</span><span className="font-bold" data-testid="pay-pump-price">{perUnit(pumpPrice, market)}</span></div>
  </div>;
}

/* ---------- Receipt ---------- */

export function ReceiptScreen({ market, receipt, share, shareLabel, go }: MarketProps & { receipt: Receipt; share: () => void; shareLabel: string; go: (screen: Screen) => void }) {
  const { settlement: fill, station, strike, boundary } = receipt;
  const hero = {
    fall: { style: "bg-[#ff5c48] text-[#0b1b2b]", eyebrow: "PRICE DROPPED · TAILS YOU WIN", headline: `${money(fill.returnedToWallet, market)} back in your wallet`, sub: `The pump fell to ${money(fill.pumpPrice, market)}. You paid the lower price, not your ${money(strike, market)} cap.` },
    rise: { style: "bg-[#0b1b2b] text-white", eyebrow: "PRICE ROSE · HEADS YOU WIN", headline: `FuelCap covered ${money(fill.coveredByFuelCap, market)}`, sub: `The pump hit ${money(fill.pumpPrice, market)}. You paid your cap of ${perUnit(strike, market)}.` },
    spike: { style: "bg-[#0b1b2b] text-white", eyebrow: "PRICE SPIKED PAST YOUR LIMIT", headline: `FuelCap covered ${money(fill.coveredByFuelCap, market)}`, sub: `The pump hit ${money(fill.pumpPrice, market)}. We covered everything up to ${perUnit(boundary, market)}; the ${perUnit(fill.pumpPrice - cents(boundary), market)} above that came from your wallet.` },
    cap: { style: "bg-[#dff5e9] text-[#0b1b2b]", eyebrow: "PAID AT YOUR CAP", headline: `You paid ${perUnit(strike, market)}`, sub: "The pump matched your cap exactly." },
  }[fill.outcome];
  return <div className="view-enter flex flex-col gap-4">
    <section className={`flex flex-col gap-2 rounded-[20px] p-[22px] ${hero.style}`} aria-label="Fill result">
      <span className="text-[13px] font-bold tracking-wide">{hero.eyebrow}</span>
      <h1 className="m-0 font-display text-[34px] font-bold leading-tight">{hero.headline}</h1>
      <p className="m-0 text-sm leading-normal">{hero.sub}</p>
    </section>
    <section className={`${card} flex flex-col gap-2.5 p-4`} aria-label="Fill breakdown">
      <h2 className="m-0 text-[15px] font-bold">{fill.volume} {market.unit} at {station}</h2>
      <Row label={`Pump total (${fill.volume} × ${money(fill.pumpPrice, market)})`} value={money(fill.stationTotal, market)} />
      <Row label="Paid from protected fuel" value={money(fill.fromProtected, market)} />
      {fill.coveredByFuelCap > 0 && <Row label="Paid by FuelCap" value={money(fill.coveredByFuelCap, market)} tone="font-bold text-[#0b7a4b]" />}
      {fill.fromWallet > 0 && <Row label="Above your limit, from wallet" value={money(fill.fromWallet, market)} />}
      {fill.returnedToWallet > 0 && <Row label="Returned to your wallet" value={`+${money(fill.returnedToWallet, market)}`} tone="font-bold text-[#b03222]" />}
    </section>
    <div className="flex flex-col gap-2.5">
      <button type="button" onClick={share} className="min-h-[52px] rounded-[14px] bg-[#ffc24b] text-base font-bold text-[#0b1b2b]">{shareLabel}</button>
      <button type="button" onClick={() => go("home")} className={secondaryButton}>Done</button>
    </div>
  </div>;
}

/* ---------- Activity ---------- */

export function ActivityScreen({ market, transactions }: MarketProps & { transactions: TransactionRecord[] }) {
  const rows = [...transactions].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return <div className="view-enter flex flex-col gap-4">
    <Title>Activity</Title>
    {rows.length === 0 ? <p className={`${card} m-0 p-6 text-center text-sm leading-snug text-[#52625c]`}>No activity yet. Your first protection will show here.</p> :
      <ul className={`${card} m-0 flex list-none flex-col p-0`}>
        {rows.map((row) => <li key={row.id} className="flex items-center justify-between gap-3 border-b border-[#eef2f0] px-4 py-3.5 last:border-0">
          <div className="flex min-w-0 flex-col gap-0.5"><span className="text-sm font-semibold">{row.description}</span><span className="text-xs text-[#52625c]">{row.detail ? `${row.detail} · ` : ""}{new Date(row.createdAt).toLocaleString(market.locale, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</span></div>
          <span className={`whitespace-nowrap text-sm font-bold ${row.amount > 0 ? "text-[#0b7a4b]" : "text-[#0b1b2b]"}`}>{row.amount > 0 ? "+" : ""}{money(row.amount, market)}</span>
        </li>)}
      </ul>}
  </div>;
}

/* ---------- Account ---------- */

export function AccountScreen({ market, planLine, changeMarket, showProfile, startProfile, email, openAuth, signOut }: MarketProps & {
  planLine: string; changeMarket: (code: MarketProps["market"]["code"]) => void; showProfile: boolean; startProfile: () => void; email: string | null; openAuth: () => void; signOut: () => void;
}) {
  const row = "flex items-center justify-between gap-3 border-b border-[#eef2f0] px-4 py-3.5 text-sm last:border-0";
  return <div className="view-enter flex flex-col gap-4">
    <Title>Account</Title>
    <section className={`${card} flex flex-col`}>
      <div className={row}><span>Plan</span><span className="font-semibold">{planLine}</span></div>
      <div className={row}><label htmlFor="country">Country</label><select id="country" value={market.code} onChange={(event) => changeMarket(event.target.value as MarketProps["market"]["code"])} className="min-h-11 rounded-lg border border-[#d3ded8] bg-white px-2 text-sm font-semibold"><option value="US">United States · $ · gallons</option><option value="CA">Canada · $ · litres</option><option value="GB">United Kingdom · £ · litres</option></select></div>
      <div className={row}><span>Card</span><span className="font-semibold">Visa ending 4242</span></div>
      <div className={row}><span>Auto-rollover</span><span className="font-semibold text-[#0b7a4b]">On · 48h notice</span></div>
    </section>
    <p className="m-0 text-xs leading-snug text-[#52625c]">Changing country opens a separate wallet in that currency. Your balance and protections in each country stay where they are.</p>
    {showProfile && <button type="button" onClick={startProfile} className={secondaryButton}>Create your profile</button>}
    {email ? <button type="button" onClick={signOut} className={secondaryButton}>Sign out of {email}</button> : <button type="button" onClick={openAuth} className={secondaryButton}>Create account or sign in</button>}
    <p className="m-0 text-center text-xs text-[#52625c]">Demo only. Simulated money: no payment is taken and no fuel is purchased.</p>
  </div>;
}
