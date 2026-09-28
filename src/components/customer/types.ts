import type { MarketCode, Market } from "@/lib/markets";
import type { LockScope } from "@/lib/price-options";
import type { Settlement } from "@/lib/protection";

export type Screen = "home" | "protect" | "done" | "pay" | "receipt" | "activity" | "account" | "onboarding";

export type LockRecord = {
  id: string;
  volume: number;
  remainingVolume: number;
  referencePrice: number;
  strike: number;
  boundary: number;
  chargePerUnit: number;
  charge: number;
  held: number;
  status: string;
  scopeType: LockScope;
  scopeId: string | null;
  scopeLabel: string;
  createdAt: string;
  expiresAt: string;
};

export type TransactionRecord = {
  id: string;
  type: string;
  amount: number;
  volume: number | null;
  unitPrice: number | null;
  description: string;
  detail?: string;
  createdAt: string;
  saving?: number;
};

export type Account = { wallet: number; locks: LockRecord[]; transactions: TransactionRecord[] };
export type Accounts = Record<MarketCode, Account>;

export type Receipt = { settlement: Settlement; station: string; strike: number; boundary: number };

export type MarketProps = { market: Market };

export const emptyAccounts = (): Accounts => ({
  US: { wallet: 0, locks: [], transactions: [] },
  CA: { wallet: 0, locks: [], transactions: [] },
  GB: { wallet: 0, locks: [], transactions: [] },
});

export const isActive = (lock: LockRecord) => ["active", "partially_redeemed"].includes(lock.status) && lock.remainingVolume > 0;
export const shortLabel = (label: string) => label.split(" - ")[0];
