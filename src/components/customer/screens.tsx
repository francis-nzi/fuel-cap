"use client";

import { Check, ChevronRight, MapPin, Minus, Plus } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";
import type { ServicePlan } from "@fuelcap/demo-data/customer-lifecycle";
import { coverageLabel, depositChoices, DEPOSIT_STEP, nextPlan, planFee, usualChoices, walletLimit, withRunningBalance, type ProtectionPlan, type Unit } from "@/lib/funding";
import { formatDistance } from "@/lib/geo";
import { money } from "@/lib/markets";
import { cents } from "@/lib/protection";
import { card, chip, primaryButton, Row, secondaryButton } from "./ui";
import { formatVolume, shortLabel, type LockRecord, type MarketProps, type Receipt, type Screen, type TransactionRecord } from "./types";

const perUnit = (value: number, market: MarketProps["market"]) => `${money(value, market)}/${market.unit}`;
const Title = ({ children, sub }: { children: React.ReactNode; sub?: React.ReactNode }) => (
  <div className="flex flex-col gap-1"><h1 className="m-0 font-display text-[26px] font-bold leading-tight">{children}</h1>{sub && <p className="m-0 text-sm leading-snug text-[#52625c]">{sub}</p>}</div>
);

export type StationSummary = { name: string; price: number; miles: number | null } | null;

export function pumpStatus(pumpPrice: number, lock: LockRecord, market: MarketProps["market"]) {
  if (pumpPrice < lock.strike) return { label: "Pump is below your cap", value: `You pay ${money(pumpPrice, market)}`, tone: "text-[#ff9a8c]" };
  if (pumpPrice === lock.strike) return { label: "Right at your cap", value: `You pay ${money(lock.strike, market)}`, tone: "text-white" };
  if (pumpPrice <= lock.boundary) return { label: "FuelCap covers", value: perUnit(pumpPrice - lock.strike, market), tone: "text-[#ffc24b]" };
  return { label: "Above your limit", value: `Covered to ${money(lock.boundary, market)}`, tone: "text-[#ffc24b]" };
}

function StationRow({ market, station, change }: MarketProps & { station: StationSummary; change: () => void }) {
  return <button type="button" onClick={change} className={`${card} flex w-full items-center gap-3 px-4 py-3 text-left`} aria-label={station ? `Your station: ${station.name}. Change station` : "Choose your station"}>
    <MapPin size={18} aria-hidden="true" className="shrink-0 text-[#0b7a4b]" />
    <span className="flex min-w-0 flex-1 flex-col gap-0.5"><span className="text-xs text-[#52625c]">Your station</span><span className="truncate text-sm font-bold" data-testid="your-station">{station ? station.name : "Choose a station"}</span></span>
    {station && station.miles !== null && <span className="text-xs text-[#52625c]">{formatDistance(station.miles, market.code)}</span>}
    <span className="text-sm font-semibold text-[#0b7a4b]">Change</span>
  </button>;
}

/* ---------- Home ---------- */

export function HomeScreen({ market, firstName, showProfile, startProfile, loading, station, plan, balance, setAside, free, lock, pumpPrice, until, daysLeft, nextProtection, savings, notProtectedReason, protectNow, previewStrike, go, share, shareLabel }: MarketProps & {
  firstName: string; showProfile: boolean; startProfile: () => void; loading: boolean; station: StationSummary; plan: ServicePlan;
  balance: number; setAside: number; free: number; lock?: LockRecord; pumpPrice: number; until: string; daysLeft: number; nextProtection: ProtectionPlan | null;
  savings: number; notProtectedReason: string | null; protectNow: () => void; previewStrike: number | null; go: (screen: Screen) => void; share: () => void; shareLabel: string;
}) {
  const greeting = <span className="text-sm text-[#52625c]">Hi {firstName}</span>;
  const balanceCard = <section className={`${card} flex flex-col gap-1.5 p-4`} aria-label="Balance">
    <span className="text-[13px] text-[#52625c]">Balance</span>
    <span className="font-display text-[34px] font-bold leading-none" data-testid="balance">{money(balance, market)}</span>
    {lock ? <span className="text-sm text-[#33443d]" data-testid="protected-line">{formatVolume(lock.remainingVolume, market.unit)} protected at max {perUnit(lock.strike, market)} until {until}</span> : null}
    <span className="text-sm text-[#33443d]" data-testid="free-line"><strong>{money(free, market)}</strong> free to spend{setAside > 0 ? ` · ${money(setAside, market)} set aside for your protected fuel` : ""}</span>
  </section>;

  if (lock) {
    const status = pumpStatus(pumpPrice, lock, market);
    return <div className="view-enter flex flex-col gap-4">
      <div className="flex flex-col gap-1">{greeting}<h1 className="m-0 font-display text-[26px] font-bold leading-tight">Your fuel is capped</h1></div>
      {balanceCard}
      <section className="flex flex-col gap-3.5 rounded-[20px] bg-[#0b1b2b] p-5 text-white">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-0.5"><span className="text-xs font-semibold text-[#a9c9ba]">YOUR MAX PRICE</span><span className="text-[13px] text-[#d5e3dc]">{coverageLabel(plan) === "your station" ? shortLabel(lock.scopeLabel) : `${shortLabel(lock.scopeLabel)} · ${coverageLabel(plan)}`}</span></div>
          <span className="rounded-full bg-[#17364a] px-2 py-0.5 text-[11px] text-[#dff5e9]">{daysLeft} {daysLeft === 1 ? "day" : "days"} left</span>
        </div>
        <p className="m-0 font-display text-[44px] font-bold leading-none" data-testid="headline-unit-price">{money(lock.strike, market)}<span className="text-base font-medium text-[#a9c9ba]"> /{market.unit}</span></p>
        <div className="grid grid-cols-2 gap-3 border-t border-[#284052] pt-3.5">
          <div className="flex flex-col gap-0.5"><span className="text-xs text-[#a9c9ba]">Pump now</span><span className="text-xl font-bold" data-testid="pump-now">{money(pumpPrice, market)}</span></div>
          <div className="flex flex-col gap-0.5 border-l border-[#284052] pl-3"><span className="text-xs text-[#a9c9ba]">{status.label}</span><span className={`text-xl font-bold ${status.tone}`}>{status.value}</span></div>
        </div>
        <div className="flex gap-2.5">
          <button type="button" onClick={() => go("pay")} className="min-h-[50px] flex-1 rounded-[14px] bg-[#0ba75e] text-base font-bold text-[#06231a]">Pay at pump</button>
          <button type="button" onClick={() => go("add")} className="min-h-[50px] rounded-[14px] border border-[#476070] px-4 text-[15px] font-semibold text-white">Add money</button>
        </div>
      </section>
      <StationRow market={market} station={station} change={() => go("station")} />
      {savings > 0 && <SavedCard market={market} savings={savings} share={share} shareLabel={shareLabel} />}
    </div>;
  }

  return <div className="view-enter flex flex-col gap-4">
    <div className="flex flex-col gap-1">{greeting}<h1 className="m-0 font-display text-[26px] font-bold leading-tight">Cap your fuel price. Never overpay.</h1></div>
    <section className="flex flex-col gap-3.5 rounded-[20px] bg-[#0b1b2b] p-5 text-white">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5"><span className="text-xs font-semibold text-[#a9c9ba]">PUMP PRICE NOW</span><span className="truncate text-[13px] text-[#d5e3dc]">{loading ? `Loading ${market.name} prices` : station ? `${station.name}${station.miles !== null ? ` · ${formatDistance(station.miles, market.code)}` : ""}` : "Choose a station"}</span></div>
        <span className="rounded-full bg-[#17364a] px-2 py-0.5 text-[11px] text-[#dff5e9]">Regular</span>
      </div>
      <p className="m-0 font-display text-[44px] font-bold leading-none" data-testid="headline-unit-price">{station ? money(station.price, market) : "Loading…"}{station && <span className="text-base font-medium text-[#a9c9ba]"> /{market.unit}</span>}</p>
      <p className="m-0 text-sm leading-normal text-[#d5e3dc]">{previewStrike === null ? "Loading today's prices…" : <>Add money and we protect your usual fuel at a max of <strong className="text-[#ffc24b]">{perUnit(previewStrike, market)}</strong> for {plan.lockPeriodDays} days. If the price falls, you just pay the lower price.</>}</p>
      <button type="button" onClick={() => go("add")} className="min-h-[52px] rounded-[14px] bg-[#0ba75e] text-base font-bold text-[#06231a]">{balance > 0 ? "Add money" : "Add money to start"}</button>
    </section>
    <StationRow market={market} station={station} change={() => go("station")} />
    {balance > 0 && balanceCard}
    {balance > 0 && notProtectedReason && <p className="m-0 rounded-xl bg-[#fff3d6] px-3 py-2.5 text-[13px] leading-snug text-[#6b5310]">{notProtectedReason}</p>}
    {balance > 0 && nextProtection?.quote && <button type="button" onClick={protectNow} className={secondaryButton}>Protect {formatVolume(nextProtection.volume, market.unit)} now · {money(nextProtection.quote.charge, market)} charge</button>}
    {balance === 0 && <section className={`${card} flex flex-col gap-3 p-4`}>
      <h2 className="m-0 text-[15px] font-bold">How it works</h2>
      {["Add money in round amounts. It stays yours.", "We protect your usual fuel automatically. Price goes up? We pay the difference above your cap.", "Price goes down? You pay the lower price. Heads you win, tails you win."].map((text, index) => (
        <div key={text} className="flex items-start gap-3"><span className="grid size-[26px] shrink-0 place-items-center rounded-full bg-[#dff5e9] text-[13px] font-bold text-[#0b7a4b]">{index + 1}</span><span className="text-sm leading-snug text-[#33443d]">{text}</span></div>
      ))}
    </section>}
    {savings > 0 && <SavedCard market={market} savings={savings} share={share} shareLabel={shareLabel} />}
    {showProfile && <button type="button" onClick={startProfile} className={secondaryButton}>Create your profile</button>}
  </div>;
}

function SavedCard({ market, savings, share, shareLabel }: MarketProps & { savings: number; share: () => void; shareLabel: string }) {
  return <section className="flex items-center justify-between gap-3 rounded-2xl bg-[#fff3d6] p-4">
    <div className="flex flex-col gap-0.5"><span className="text-[13px] text-[#6b5310]">Saved with FuelCap so far</span><span className="font-display text-[22px] font-bold" data-testid="savings-total">{money(savings, market)}</span></div>
    <button type="button" onClick={share} className="min-h-11 rounded-xl bg-[#ffc24b] px-4 text-sm font-bold text-[#0b1b2b]">{shareLabel}</button>
  </section>;
}

/* ---------- Add money ---------- */

export function ExplainPrice({ market, plan, quote }: MarketProps & { plan: ServicePlan; quote: NonNullable<ProtectionPlan["quote"]> }) {
  const [open, setOpen] = useState(false);
  return <div className="flex flex-col gap-2">
    <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="self-start text-sm font-semibold text-[#0b7a4b] underline underline-offset-2">{open ? "Hide price details" : "Explain my price"}</button>
    {open && <div className={`${card} flex flex-col gap-2.5 p-4`} aria-label="Price details">
      <Row label="Today's price" value={perUnit(quote.reference, market)} />
      <Row label="Your max price (cap)" sub="5% above today's price" value={perUnit(quote.strike, market)} />
      <Row label="We cover up to" sub="15% above today's price. Above that, you pay the difference." value={perUnit(quote.boundary, market)} />
      <Row label="Protection charge" value={`${money(quote.chargePerUnit, market, 4)}/${market.unit}`} sub={`${(plan.spreadBps / 100).toFixed(2)}% of today's price on your ${plan.name} plan. Charged once per window, not refundable.`} />
      <Row label="Set aside for your fuel" sub={`${formatVolume(quote.volume, market.unit)} × ${money(quote.strike, market)}. Still your money: it stays in your balance.`} value={money(quote.held, market)} />
    </div>}
  </div>;
}

export function AddMoneyScreen({ market, plan, balance, amount, setAmount, max, monthly, setMonthly, lock, until, preview, upgrade, paused }: MarketProps & {
  plan: ServicePlan; balance: number; amount: number; setAmount: (amount: number) => void; max: number; monthly: boolean; setMonthly: (on: boolean) => void;
  lock?: LockRecord; until: string; preview: ProtectionPlan | null; upgrade: () => void; paused: boolean;
}) {
  const [custom, setCustom] = useState(!depositChoices.includes(amount as typeof depositChoices[number]));
  const limit = walletLimit(plan);
  const higher = nextPlan(plan);
  const step = (delta: number) => setAmount(Math.min(Math.max(amount + delta, DEPOSIT_STEP), Math.max(Math.floor(max / DEPOSIT_STEP) * DEPOSIT_STEP, DEPOSIT_STEP)));
  return <div className="view-enter flex flex-col gap-4">
    <Title sub="We protect your usual fuel automatically. The rest stays free to spend, and it's always yours.">Add money</Title>
    {paused && <p role="status" className="m-0 rounded-xl border border-[#efb0a8] bg-[#fff0ed] px-3 py-2.5 text-sm text-[#8a3026]">New protections are paused for a moment. You can still add money; anything already protected is unaffected.</p>}
    {max < DEPOSIT_STEP ? <section className={`${card} flex flex-col gap-3 p-4`}>
      <p className="m-0 text-sm leading-snug text-[#33443d]">Your balance is at your {plan.name} plan&apos;s limit of {money(limit, market)}.</p>
      {higher && <button type="button" onClick={upgrade} className={secondaryButton}>Move to {higher.name}: hold up to {money(walletLimit(higher), market)}</button>}
    </section> : <>
      <section className="flex flex-col gap-2">
        <div className="grid grid-cols-5 gap-2" role="radiogroup" aria-label="Amount to add">
          {depositChoices.map((choice) => <button type="button" role="radio" aria-checked={!custom && amount === choice} key={choice} disabled={choice > max} onClick={() => { setCustom(false); setAmount(choice); }} className={`${chip(!custom && amount === choice)} disabled:opacity-40`}>{money(choice, market, 0)}</button>)}
          <button type="button" role="radio" aria-checked={custom} onClick={() => setCustom(true)} className={chip(custom)}>Custom</button>
        </div>
        {custom && <div className="flex items-center justify-between rounded-xl border border-[#d3ded8] bg-white p-2">
          <button type="button" aria-label={`${DEPOSIT_STEP} less`} onClick={() => step(-DEPOSIT_STEP)} className="grid size-11 place-items-center rounded-lg bg-[#eef2f0]"><Minus size={18} /></button>
          <span className="font-display text-2xl font-bold" data-testid="custom-amount">{money(amount, market, 0)}</span>
          <button type="button" aria-label={`${DEPOSIT_STEP} more`} disabled={amount + DEPOSIT_STEP > max} onClick={() => step(DEPOSIT_STEP)} className="grid size-11 place-items-center rounded-lg bg-[#eef2f0] disabled:opacity-40"><Plus size={18} /></button>
        </div>}
        <p className="m-0 text-xs text-[#52625c]">Your {plan.name} plan holds up to {money(limit, market)}. You can add up to {money(max, market)} now.{higher && max < 200 ? <> <button type="button" onClick={upgrade} className="font-semibold text-[#0b7a4b] underline">Move to {higher.name}</button> for up to {money(walletLimit(higher), market)}.</> : null}</p>
      </section>
      <label className={`${card} flex items-center justify-between gap-3 px-4 py-3.5 text-sm`}>
        <span className="flex flex-col gap-0.5"><span className="font-semibold">Top up {money(amount, market, 0)} every month</span><span className="text-xs text-[#52625c]">From your card ending 4242. Turn off any time.</span></span>
        <input type="checkbox" role="switch" checked={monthly} onChange={(event) => setMonthly(event.target.checked)} className="size-6 accent-[#0b7a4b]" />
      </label>
      <section className={`${card} flex flex-col gap-2.5 p-4`} aria-label="What happens">
        <Row label="Balance after" value={money(cents(balance + amount), market)} strong />
        {lock ? <p className="m-0 text-[13px] leading-snug text-[#33443d]">You already have {formatVolume(lock.remainingVolume, market.unit)} protected at max {perUnit(lock.strike, market)} until {until}. The new money stays free to spend, and is used when your protection renews.</p>
          : preview?.quote ? <p className="m-0 text-[13px] leading-snug text-[#33443d]" data-testid="protect-preview">We&apos;ll protect <strong>{formatVolume(preview.volume, market.unit)}</strong> at max <strong>{perUnit(preview.quote.strike, market)}</strong> for {plan.lockPeriodDays} days. Protection charge {money(preview.quote.charge, market)}; {money(preview.quote.held, market)} is set aside for the fuel and stays in your balance.{preview.limitedBy === "plan" ? ` That's your ${plan.name} plan's limit for ${plan.lockPeriodDays} days.` : preview.limitedBy === "balance" ? " That's what this amount can cover." : ""}</p>
          : preview?.reason === "below_minimum" ? <p className="m-0 text-[13px] leading-snug text-[#33443d]">This isn&apos;t enough to protect the minimum of {market.unit === "gal" ? "1 gal" : "5 L"} after the charge. It will stay free to spend.</p> : null}
        {!lock && preview?.quote && <ExplainPrice market={market} plan={plan} quote={preview.quote} />}
      </section>
    </>}
  </div>;
}

/* ---------- Done ---------- */

export function DoneScreen({ market, added, lock, until, balance, free, go }: MarketProps & { added: number; lock?: LockRecord; until: string; balance: number; free: number; go: (screen: Screen) => void }) {
  return <div className="view-enter flex flex-col gap-4">
    <div className="flex flex-col items-center gap-3 pt-10 text-center">
      <div className="grid size-[88px] place-items-center rounded-full bg-[#dff5e9]"><Check size={44} strokeWidth={2.5} className="text-[#0b7a4b]" aria-hidden="true" /></div>
      <h1 className="m-0 font-display text-[28px] font-bold">{added > 0 ? `${money(added, market)} added` : "Protection started"}</h1>
      {lock && <p className="m-0 text-[15px] leading-normal text-[#33443d]">{formatVolume(lock.remainingVolume, market.unit)} protected. You&apos;ll never pay more than <strong>{perUnit(lock.strike, market)}</strong> at {shortLabel(lock.scopeLabel)} until {until}.</p>}
      <p className="m-0 text-[13px] text-[#52625c]">Balance {money(balance, market)} · {money(free, market)} free to spend</p>
    </div>
    <div className="mt-3 flex flex-col gap-2.5">
      {lock && <button type="button" onClick={() => go("pay")} className={primaryButton}>Pay at pump now</button>}
      <button type="button" onClick={() => go("home")} className={lock ? secondaryButton : primaryButton}>Back to home</button>
    </div>
  </div>;
}

/* ---------- Pay ---------- */

export function PayScreen({ market, lock, pumpPrice, fills, fill, setFill, code, go }: MarketProps & { lock?: LockRecord; pumpPrice: number; fills: number[]; fill: number; setFill: (volume: number) => void; code: string; go: (screen: Screen) => void }) {
  if (!lock) return <div className="view-enter flex flex-col gap-4">
    <Title>Pay at the pump</Title>
    <section className={`${card} flex flex-col items-center gap-2.5 p-6 text-center`}>
      <h2 className="m-0 text-[17px] font-bold">Nothing protected yet</h2>
      <p className="m-0 text-sm leading-snug text-[#52625c]">Add money and we&apos;ll protect your usual fuel. Then pay here at the pump.</p>
      <button type="button" onClick={() => go("add")} className={`${primaryButton} min-h-12 px-5 text-[15px]`}>Add money</button>
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
        {fills.map((option, index) => <button type="button" role="radio" aria-checked={option === fill} key={option} onClick={() => setFill(option)} className={chip(option === fill)}>{index === fills.length - 1 && fills.length > 1 ? `All ${formatVolume(option, market.unit)}` : formatVolume(option, market.unit)}</button>)}
      </div>
    </section>
    <div className="flex items-center justify-between rounded-[14px] bg-[#f1f7f3] px-3.5 py-3 text-sm"><span className="text-[#33443d]">Pump price right now</span><span className="font-bold" data-testid="pay-pump-price">{perUnit(pumpPrice, market)}</span></div>
  </div>;
}

/* ---------- Receipt ---------- */

export function ReceiptScreen({ market, receipt, share, shareLabel, go }: MarketProps & { receipt: Receipt; share: () => void; shareLabel: string; go: (screen: Screen) => void }) {
  const { settlement: fill, station, strike, boundary, reference, savedVsToday, fromBalance, byCard } = receipt;
  const hero = {
    fall: { style: "bg-[#ff5c48] text-[#0b1b2b]", eyebrow: "PRICE DROPPED · TAILS YOU WIN", headline: `You paid ${money(fill.returnedToWallet, market)} less than your cap`, extra: savedVsToday > 0 ? ` · ${money(savedVsToday, market)} less than today's price` : "", sub: `The pump fell to ${money(fill.pumpPrice, market)}. You paid the lower price, not your ${money(strike, market)} cap, and the difference stays in your balance.` },
    rise: { style: "bg-[#0b1b2b] text-white", eyebrow: "PRICE ROSE · HEADS YOU WIN", headline: `FuelCap covered ${money(fill.coveredByFuelCap, market)}`, sub: `The pump hit ${money(fill.pumpPrice, market)}. You paid your cap of ${perUnit(strike, market)}.` },
    spike: { style: "bg-[#0b1b2b] text-white", eyebrow: "PRICE SPIKED PAST YOUR LIMIT", headline: `FuelCap covered ${money(fill.coveredByFuelCap, market)}`, sub: `The pump hit ${money(fill.pumpPrice, market)}. We covered everything up to ${perUnit(boundary, market)}; you paid the ${perUnit(fill.pumpPrice - cents(boundary), market)} above that.` },
    cap: { style: "bg-[#dff5e9] text-[#0b1b2b]", eyebrow: "PAID AT YOUR CAP", headline: `You paid ${perUnit(strike, market)}`, sub: "The pump matched your cap exactly." },
    below: { style: "bg-[#dff5e9] text-[#0b1b2b]", eyebrow: "BELOW YOUR CAP", headline: `You paid ${perUnit(fill.pumpPrice, market)}`, sub: `The pump price was under your ${money(strike, market)} cap, so you paid the pump price. Your cap was there if it had risen.` },
  }[fill.outcome === "fall" && fill.pumpPrice >= reference ? "below" : fill.outcome];
  return <div className="view-enter flex flex-col gap-4">
    <section className={`flex flex-col gap-2 rounded-[20px] p-[22px] ${hero.style}`} aria-label="Fill result">
      <span className="text-[13px] font-bold tracking-wide">{hero.eyebrow}</span>
      <h1 className="m-0 font-display text-[34px] font-bold leading-tight">{hero.headline}{"extra" in hero && hero.extra && <span className="block text-xl leading-snug">{hero.extra}</span>}</h1>
      <p className="m-0 text-sm leading-normal">{hero.sub}</p>
    </section>
    <section className={`${card} flex flex-col gap-2.5 p-4`} aria-label="Fill breakdown">
      <h2 className="m-0 text-[15px] font-bold">{formatVolume(fill.volume, market.unit)} at {station}</h2>
      <Row label={`Pump total (${fill.volume} × ${money(fill.pumpPrice, market)})`} value={money(fill.stationTotal, market)} />
      <Row label="Paid from your balance" value={money(fromBalance, market)} />
      {fill.coveredByFuelCap > 0 && <Row label="Paid by FuelCap" value={money(fill.coveredByFuelCap, market)} tone="font-bold text-[#0b7a4b]" />}
      {byCard > 0 && <Row label="Above your limit, paid by card" value={money(byCard, market)} />}
      {fill.returnedToWallet > 0 && <Row label="Less than your cap" value={money(fill.returnedToWallet, market)} tone={fill.pumpPrice < reference ? "font-bold text-[#b03222]" : "font-semibold"} />}
      {savedVsToday > 0 && <Row label={`Saved vs today's ${money(reference, market)}`} value={money(savedVsToday, market)} tone="font-bold text-[#0b7a4b]" />}
    </section>
    <div className="flex flex-col gap-2.5">
      <button type="button" onClick={share} className="min-h-[52px] rounded-[14px] bg-[#ffc24b] text-base font-bold text-[#0b1b2b]">{shareLabel}</button>
      <button type="button" onClick={() => go("home")} className={secondaryButton}>Done</button>
    </div>
  </div>;
}

/* ---------- Activity ---------- */

export function ActivityScreen({ market, transactions }: MarketProps & { transactions: TransactionRecord[] }) {
  const rows = withRunningBalance(transactions);
  return <div className="view-enter flex flex-col gap-4">
    <Title sub="Newest first. The balance column always ends at your Home balance.">Activity</Title>
    {rows.length === 0 ? <p className={`${card} m-0 p-6 text-center text-sm leading-snug text-[#52625c]`}>No activity yet. Money you add will show here.</p> :
      <ul className={`${card} m-0 flex list-none flex-col p-0`} aria-label="Activity with running balance">
        {rows.map((row) => <li key={row.id} data-testid="activity-row" className="flex items-start justify-between gap-3 border-b border-[#eef2f0] px-4 py-3.5 last:border-0">
          <div className="flex min-w-0 flex-col gap-0.5"><span className="text-sm font-semibold">{row.description}</span><span className="text-xs text-[#52625c]">{new Date(row.createdAt).toLocaleString(market.locale, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}{row.detail ? ` · ${row.detail}` : ""}</span></div>
          <div className="flex shrink-0 flex-col items-end gap-0.5">
            <span className={`whitespace-nowrap text-sm font-bold ${row.amount > 0 ? "text-[#0b7a4b]" : row.amount < 0 ? "text-[#0b1b2b]" : "text-[#8a9a93]"}`} data-testid="activity-amount">{row.amount === 0 ? "—" : `${row.amount > 0 ? "+" : "−"}${money(Math.abs(row.amount), market)}`}</span>
            <span className="whitespace-nowrap text-xs text-[#52625c]" data-testid="activity-balance">{money(row.balanceAfter, market)}</span>
          </div>
        </li>)}
      </ul>}
  </div>;
}

/* ---------- Account ---------- */

export function AccountScreen({ market, plan, plans, changePlan, usual, setUsual, station, changeStation, changeMarket, autoRollover, setAutoRollover, monthlyTopUp, stopMonthly, free, cashOut, showProfile, startProfile, email, openAuth, signOut }: MarketProps & {
  plan: ServicePlan; plans: readonly ServicePlan[]; changePlan: (plan: ServicePlan) => void; usual: number; setUsual: (value: number) => void;
  station: StationSummary; changeStation: () => void; changeMarket: (code: MarketProps["market"]["code"]) => void;
  autoRollover: boolean; setAutoRollover: (on: boolean) => void; monthlyTopUp: number | null; stopMonthly: () => void; free: number; cashOut: () => void;
  showProfile: boolean; startProfile: () => void; email: string | null; openAuth: () => void; signOut: () => void;
}) {
  const row = "flex items-center justify-between gap-3 border-b border-[#eef2f0] px-4 py-3.5 text-sm last:border-0";
  return <div className="view-enter flex flex-col gap-4">
    <Title>Account</Title>
    <section className="flex flex-col gap-2" aria-labelledby="plan-label">
      <h2 id="plan-label" className="m-0 text-[13px] font-bold text-[#33443d]">Plan</h2>
      <div className="grid gap-2" role="radiogroup" aria-labelledby="plan-label">
        {plans.map((option) => <button type="button" role="radio" aria-checked={option.id === plan.id} key={option.id} onClick={() => changePlan(option)} className={`rounded-xl border p-3 text-left ${option.id === plan.id ? "border-2 border-[#0b7a4b] bg-[#f1faf5]" : "border-[#d3ded8] bg-white"}`}>
          <span className="text-xs font-bold uppercase text-[#0b7a4b]">{option.name}</span><strong className="ml-2 text-base">{planFee(option) ? money(planFee(option), market) : "Free"}<small className="text-xs font-normal text-[#52625c]"> / month</small></strong>
          <span className="mt-1 block text-xs text-[#52625c]">{option.lockPeriodDays}-day cap · holds up to {money(walletLimit(option), market, 0)} · covers {coverageLabel(option)}</span>
        </button>)}
      </div>
    </section>
    <section className="flex flex-col gap-2">
      <h2 className="m-0 text-[13px] font-bold text-[#33443d]" id="usual-label">Fuel you use in a typical week</h2>
      <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-labelledby="usual-label">
        {usualChoices(market.unit as Unit).map((option) => <button type="button" role="radio" aria-checked={option === usual} key={option} onClick={() => setUsual(option)} className={chip(option === usual)}>{option} {market.unit}</button>)}
      </div>
      <p className="m-0 text-xs text-[#52625c]">We protect this much for each window. Changes apply from your next window.</p>
    </section>
    <section className={`${card} flex flex-col`}>
      <button type="button" onClick={changeStation} className={`${row} text-left`}><span>Station</span><span className="flex items-center gap-1 font-semibold">{station?.name ?? "Choose"}<ChevronRight size={16} aria-hidden="true" /></span></button>
      <div className={row}><label htmlFor="country">Country</label><select id="country" value={market.code} onChange={(event) => changeMarket(event.target.value as MarketProps["market"]["code"])} className="min-h-11 rounded-lg border border-[#d3ded8] bg-white px-2 text-sm font-semibold"><option value="US">United States · $ · gallons</option><option value="CA">Canada · $ · litres</option><option value="GB">United Kingdom · £ · litres</option></select></div>
      <div className={row}><span>Card</span><span className="font-semibold">Visa ending 4242</span></div>
      <label className={row}><span className="flex flex-col"><span>Auto-renew protection</span><span className="text-xs text-[#52625c]">48h notice before each renewal</span></span><input type="checkbox" role="switch" checked={autoRollover} onChange={(event) => setAutoRollover(event.target.checked)} className="size-6 accent-[#0b7a4b]" /></label>
      {monthlyTopUp && <div className={row}><span>Monthly top-up</span><span className="flex items-center gap-2 font-semibold">{money(monthlyTopUp, market, 0)}<button type="button" onClick={stopMonthly} className="text-xs font-semibold text-[#b03222] underline">Stop</button></span></div>}
    </section>
    {free > 0 && <button type="button" onClick={cashOut} className={secondaryButton}>Cash out {money(free, market)} free balance</button>}
    <p className="m-0 text-xs leading-snug text-[#52625c]">Each country has its own balance in its own currency.</p>
    {showProfile && <button type="button" onClick={startProfile} className={secondaryButton}>Create your profile</button>}
    {email ? <button type="button" onClick={signOut} className={secondaryButton}>Sign out of {email}</button> : <button type="button" onClick={openAuth} className={secondaryButton}>Create account or sign in</button>}
    <p className="m-0 text-center text-xs text-[#52625c]">Demo only. Simulated money: no payment is taken and no fuel is purchased.</p>
  </div>;
}
