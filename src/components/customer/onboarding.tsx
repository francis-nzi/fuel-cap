"use client";

import { BadgeCheck } from "lucide-react";
import { useState } from "react";
import { servicePlans, type LifecycleCommand, type LifecycleCustomer, type PlanId } from "@fuelcap/demo-data/customer-lifecycle";
import { coverageLabel, planFee, usualChoices, walletLimit, type Unit } from "@/lib/funding";
import { money } from "@/lib/markets";
import { chip, primaryButton, secondaryButton } from "./ui";
import type { MarketProps } from "./types";

export const DEMO_CUSTOMER_ID = "FC-DEMO-1042";

export function OnboardingView({ market, initialUsual, send, complete, cancel }: MarketProps & { initialUsual: number; send: (command: LifecycleCommand) => Promise<LifecycleCustomer | null>; complete: (customer: LifecycleCustomer, usualWeekly: number) => void; cancel: () => void }) {
  const [step, setStep] = useState<"profile" | "licence" | "checking" | "pin">("profile");
  const [planId, setPlanId] = useState<PlanId>("BASIC");
  const [usual, setUsual] = useState(initialUsual);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [licenceName, setLicenceName] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [customer, setCustomer] = useState<LifecycleCustomer | null>(null);
  async function register() { setBusy(true); const record = await send({ type: "REGISTER_CUSTOMER", customer: { customerId: DEMO_CUSTOMER_ID, name, email, phone, planId } }); setCustomer(record); setStep("licence"); setBusy(false); }
  async function verify() { setBusy(true); await send({ type: "START_KYC", customerId: DEMO_CUSTOMER_ID, licenceLast4: "2048" }); setStep("checking"); setBusy(false); window.setTimeout(async () => { const record = await send({ type: "VERIFY_KYC", customerId: DEMO_CUSTOMER_ID }); setCustomer(record); setStep("pin"); }, process.env.NEXT_PUBLIC_FUELCAP_E2E === "true" ? 150 : 3000); }
  async function finish() { if (pin.length !== 4) return; setBusy(true); const record = await send({ type: "SET_PIN", customerId: DEMO_CUSTOMER_ID }); if (record) complete(record, usual); setBusy(false); }
  const stepNumber = step === "profile" ? 1 : step === "licence" ? 2 : step === "checking" ? 3 : 4;
  const title = step === "profile" ? "Choose how you use FuelCap" : step === "licence" ? "Verify your identity" : step === "checking" ? "We are checking your licence" : "Your FuelCap card is ready";
  const field = "mt-2 h-11 w-full rounded-xl border border-[#cdd9d1] bg-white px-3 font-normal";
  const fill = () => { setName("Francis Doherty"); setEmail("francis.doherty@example.test"); setPhone("+44 7700 900042"); };
  return <div className="view-enter flex flex-col gap-4">
    <div><p className="text-sm text-[#52625c]">Set up your account · {stepNumber} of 4</p><h1 className="font-display text-[26px] font-bold leading-tight">{title}</h1></div>
    {step === "profile" && <section className="rounded-2xl border border-[#e1e8e4] bg-white p-4">
      <div className="grid gap-2">{servicePlans.map((plan) => <button type="button" key={plan.id} onClick={() => setPlanId(plan.id)} aria-pressed={planId === plan.id} className={`rounded-xl border p-3 text-left ${planId === plan.id ? "border-2 border-[#0b7a4b] bg-[#f1faf5]" : "border-[#d3ded8]"}`}><span className="text-xs font-bold uppercase text-[#0b7a4b]">{plan.name}</span><strong className="ml-2 text-base">{planFee(plan) ? money(planFee(plan), market) : "Free"}<small className="text-xs font-normal text-[#52625c]"> / month</small></strong><span className="mt-1 block text-xs text-[#52625c]">{plan.lockPeriodDays}-day cap · holds up to {money(walletLimit(plan), market, 0)} · covers {coverageLabel(plan)}</span></button>)}</div>
      <div className="mt-4 flex flex-col gap-2"><span className="text-sm font-semibold" id="onboarding-usual">How much fuel do you use in a typical week?</span>
        <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-labelledby="onboarding-usual">{usualChoices(market.unit as Unit).map((option) => <button type="button" role="radio" aria-checked={option === usual} key={option} onClick={() => setUsual(option)} className={chip(option === usual)}>{option} {market.unit}</button>)}</div>
        <span className="text-xs text-[#52625c]">We protect about this much for you each week. You can change it later.</span>
      </div>
      <div className="mt-4 grid gap-3"><label className="text-sm font-semibold">Full name<input aria-label="Full name" value={name} onChange={(e) => setName(e.target.value)} className={field} autoComplete="name" /></label><label className="text-sm font-semibold">Mobile number<input aria-label="Mobile number" value={phone} onChange={(e) => setPhone(e.target.value)} className={field} autoComplete="tel" inputMode="tel" /></label><label className="text-sm font-semibold">Email address<input aria-label="Email address" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={field} autoComplete="email" /></label></div>
      {!name && !email && !phone && <button type="button" onClick={fill} className="mt-2 text-xs font-semibold text-[#0b7a4b] underline">Fill with demo details</button>}
      <button type="button" disabled={busy || !name || !email || !phone} onClick={() => void register()} className={`${primaryButton} mt-4 w-full`}>{busy ? "Creating account..." : "Continue to identity check"}</button>
    </section>}
    {step === "licence" && <section className="rounded-2xl border border-[#e1e8e4] bg-white p-5 text-center"><div className="mx-auto grid size-14 place-items-center rounded-full bg-[#dff5e9] text-[#0b7a4b]"><BadgeCheck size={28}/></div><h2 className="mt-4 text-xl font-bold">Add your driving licence</h2><p className="mx-auto mt-2 text-sm leading-6 text-[#52625c]">Take a clear photo on your phone. We use it to confirm your identity before activating your wallet and card.</p><label className="mt-5 block rounded-xl border-2 border-dashed border-[#9bc7ad] bg-[#f4fbf7] p-6 font-semibold text-[#0b7a4b]">{licenceName || "Take or choose licence photo"}<input aria-label="Driving licence photo" className="sr-only" type="file" accept="image/*" capture="environment" onChange={(event) => setLicenceName(event.target.files?.[0]?.name ?? "licence.jpg")}/></label><button type="button" disabled={!licenceName || busy} onClick={() => void verify()} className={`${primaryButton} mt-4 w-full`}>Submit for verification</button></section>}
    {step === "checking" && <section role="status" className="rounded-2xl border border-[#efd695] bg-[#fff8e6] p-7 text-center"><div className="mx-auto size-12 animate-spin rounded-full border-4 border-[#eadba9] border-t-[#0b7a4b]"/><h2 className="mt-5 text-xl font-bold">Verification in progress</h2><p className="mt-2 text-sm text-[#735d2c]">Your customer record is already visible to the operations team. This demonstration completes the identity check in a few seconds.</p></section>}
    {step === "pin" && <section className="rounded-2xl border border-[#9bc7ad] bg-white p-5"><div className="flex items-start gap-3 rounded-xl bg-[#edf8f1] p-4 text-[#0b7a4b]"><BadgeCheck size={22}/><div><strong className="block">Identity verified</strong><span className="text-sm">Your virtual card was issued automatically.</span></div></div><div className="mt-4 rounded-xl bg-[#0b1b2b] p-5 text-white"><span className="text-xs uppercase text-[#a9c9ba]">FuelCap virtual card</span><p className="mt-5 text-xl tracking-[.12em]">{customer?.card.maskedPan}</p><p className="mt-3 text-sm text-[#a9c9ba]">Expires {customer?.card.expiry}</p></div><label className="mt-4 block text-sm font-semibold">Choose a 4-digit PIN<input aria-label="Card PIN" inputMode="numeric" maxLength={4} type="password" value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, ""))} className="mt-2 h-12 w-full rounded-xl border border-[#cdd9d1] px-3 text-center text-xl tracking-[.5em]" /></label><button type="button" disabled={pin.length !== 4 || busy} onClick={() => void finish()} className={`${primaryButton} mt-4 w-full`}>Open my wallet</button></section>}
    {step === "profile" && <button type="button" onClick={cancel} className={secondaryButton}>Cancel</button>}
  </div>;
}
