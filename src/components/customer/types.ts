import type { MarketCode, Market } from "@/lib/markets";
import type { LockScope } from "@/lib/price-options";
import type { Settlement } from "@/lib/protection";

export type Screen = "home" | "add" | "done" | "pay" | "receipt" | "activity" | "account" | "onboarding" | "station";

export type LockRecord = {
  id: string;
  volume: number;
  remainingVolume: number;
  referencePrice: number;
  strike: number;
  boundary: number;
  chargePerUnit: number;
  charge: number;
  /** Money set aside for the remaining protected fuel. Still part of the balance. */
  held: number;
  status: "active" | "partially_redeemed" | "redeemed" | "expired";
  scopeType: LockScope;
  scopeId: string | null;
  /** The station the protection was priced from (and, on Basic, the only station it covers). */
  stationId: string | null;
  scopeLabel: string;
  createdAt: string;
  expiresAt: string;
};

/**
 * One Activity row. `amount` is the effect on the balance: deposits, protection charges, fuel paid from the balance and
 * cash-outs. Rows that move no balance money (protection started or ended, plan fee or fuel paid by card) have amount 0.
 */
export type TransactionKind = "deposit" | "charge" | "protection" | "ended" | "fuel" | "price_fall" | "card" | "plan_fee" | "cashout" | "not_renewed";
export type TransactionRecord = {
  id: string;
  seq: number;
  type: TransactionKind;
  amount: number;
  description: string;
  detail?: string;
  createdAt: string;
  saving?: number;
};

export type Account = {
  locks: LockRecord[];
  transactions: TransactionRecord[];
  stationId: string | null;
  usualWeekly: number | null;
  autoRollover: boolean;
  monthlyTopUp: number | null;
};
export type Accounts = Record<MarketCode, Account>;

export type Receipt = { settlement: Settlement; station: string; strike: number; boundary: number; reference: number; savedVsToday: number; fromBalance: number; byCard: number };

export type MarketProps = { market: Market };

const emptyAccount = (): Account => ({ locks: [], transactions: [], stationId: null, usualWeekly: null, autoRollover: true, monthlyTopUp: null });
export const emptyAccounts = (): Accounts => ({ US: emptyAccount(), CA: emptyAccount(), GB: emptyAccount() });

export const isActive = (lock: LockRecord) => ["active", "partially_redeemed"].includes(lock.status) && lock.remainingVolume > 0;
export const shortLabel = (label: string) => label.split(" - ")[0];
export const formatVolume = (volume: number, unit: string) => `${Number.isInteger(volume) ? volume : volume.toFixed(1)} ${unit}`;
