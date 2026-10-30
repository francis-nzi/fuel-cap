// Customer funding model (DEC-065, REQ-003): round-sum deposits, protect the usual window's fuel automatically,
// everything else stays as free balance. Money set aside for protected fuel is still the customer's balance.

import { servicePlans, type PlanId, type ServicePlan } from "@fuelcap/demo-data/customer-lifecycle";
import { cents, quoteProtection, round4, STRIKE_MARKUP, type Quote } from "./protection";

export type Unit = "gal" | "L";

export const LITRES_PER_GALLON = 3.78541;
export const DEPOSIT_STEP = 50;
export const depositChoices = [50, 100, 150, 200] as const;
export const usualChoices = (unit: Unit) => (unit === "gal" ? [5, 10, 15, 20] : [20, 40, 60, 80]);
export const defaultUsual = (unit: Unit) => (unit === "gal" ? 10 : 40);
export const volumeStep = (unit: Unit) => (unit === "gal" ? 0.1 : 1);
export const minimumVolume = (unit: Unit) => (unit === "gal" ? 1 : 5);

export const DEFAULT_PLAN_ID: PlanId = "BASIC";
export const planFor = (id?: PlanId | null): ServicePlan => servicePlans.find((plan) => plan.id === id) ?? servicePlans.find((plan) => plan.id === DEFAULT_PLAN_ID)!;
export const nextPlan = (plan: ServicePlan): ServicePlan | null => servicePlans[servicePlans.findIndex((candidate) => candidate.id === plan.id) + 1] ?? null;
/** Wallet limits are the same number in every currency (500 / 1,500 / 3,000). */
export const walletLimit = (plan: ServicePlan) => plan.walletLimitMinor / 100;
export const planFee = (plan: ServicePlan) => plan.monthlyFeeMinor / 100;
export const chargeRate = (plan: ServicePlan) => plan.spreadBps / 10_000;
export const monthlyFuelLimit = (plan: ServicePlan, unit: Unit) => (unit === "gal" ? plan.monthlyFuelLimitLitres / LITRES_PER_GALLON : plan.monthlyFuelLimitLitres);
export const coverageLabel = (plan: ServicePlan) => (plan.stationScope === "STATION" ? "your station" : plan.stationScope === "BRAND" ? "any station of your brand" : "any station");

/** Round a volume down to the unit's precision (1 L, 0.1 gal). */
export function roundVolumeDown(volume: number, unit: Unit) {
  const step = volumeStep(unit);
  const steps = Math.floor(volume / step + 1e-9);
  return Math.round(steps * step * 10) / 10;
}

/** Largest deposit allowed now: the balance may never exceed the plan's wallet limit. */
export const maxDeposit = (plan: ServicePlan, balance: number) => Math.max(cents(walletLimit(plan) - balance), 0);

export type ProtectionPlanReason = "below_minimum" | null;
export type ProtectionPlan = {
  volume: number;
  wanted: number;
  limitedBy: "usual" | "plan" | "balance";
  quote: Quote | null;
  reason: ProtectionPlanReason;
};

/**
 * How much of the usual window's fuel to protect: usual weekly use × (window days / 7), capped by the plan's monthly
 * fuel limit pro-rated to the window (÷30) and by what the free balance can fund (cap price + charge per unit).
 * Volume rounds down; below the minimum (5 L / 1 gal) nothing is protected.
 */
export function planProtection({ reference, usualWeekly, plan, unit, free }: { reference: number; usualWeekly: number; plan: ServicePlan; unit: Unit; free: number }): ProtectionPlan {
  const days = plan.lockPeriodDays;
  const usual = usualWeekly * (days / 7);
  const planLimit = monthlyFuelLimit(plan, unit) * (days / 30);
  const rate = chargeRate(plan);
  const strike = round4(reference * (1 + STRIKE_MARKUP));
  const perUnit = strike + round4(reference * rate);
  let affordable = roundVolumeDown(Math.max(free, 0) / perUnit, unit);
  while (affordable > 0 && quoteProtection(reference, affordable, undefined, rate).total > free + 1e-9) affordable = roundVolumeDown(affordable - volumeStep(unit), unit);
  const wanted = roundVolumeDown(Math.min(usual, planLimit), unit);
  const volume = Math.min(wanted, affordable);
  const limitedBy = volume < wanted ? "balance" : planLimit < usual ? "plan" : "usual";
  if (volume < minimumVolume(unit)) return { volume: 0, wanted, limitedBy, quote: null, reason: "below_minimum" };
  return { volume, wanted, limitedBy, quote: quoteProtection(reference, volume, undefined, rate), reason: null };
}

export type MoneyRow = { id: string; amount: number; createdAt: string; seq: number };

/** Activity rows newest first, each with the balance after it. The top row's balance is the Home balance. */
export function withRunningBalance<T extends MoneyRow>(rows: T[]): (T & { balanceAfter: number })[] {
  const ordered = [...rows].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.seq - b.seq);
  let balance = 0;
  const out = ordered.map((row) => { balance = cents(balance + row.amount); return { ...row, balanceAfter: balance }; });
  return out.reverse();
}

export const balanceOf = (rows: MoneyRow[]) => cents(rows.reduce((sum, row) => sum + row.amount, 0));

/**
 * What a fill takes from the balance. Protected fuel is paid at the cap (or the lower pump price) from the money set
 * aside for it; anything above the +15% limit comes from the free balance, and if that runs out, from the card on file.
 * Nothing is ever overdrawn.
 */
export function payFromBalance(fill: { outcome: string; volume: number; pumpPrice: number; heldReleased: number; fromWallet: number }, free: number) {
  const protectedPart = fill.outcome === "fall" ? cents(fill.volume * fill.pumpPrice) : cents(fill.heldReleased);
  const excessFromBalance = cents(Math.min(fill.fromWallet, Math.max(free, 0)));
  return { protectedPart, fromBalance: cents(protectedPart + excessFromBalance), byCard: cents(fill.fromWallet - excessFromBalance) };
}
