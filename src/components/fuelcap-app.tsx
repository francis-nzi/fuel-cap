"use client";

import Image from "next/image";
import {
  Activity, BadgeCheck, CircleDollarSign, CircleUserRound, Fuel,
  ExternalLink, Gift, Home, LocateFixed, LockKeyhole, LogOut, MapPin, Menu, QrCode,
  Search, Settings, ShieldCheck, WalletCards, X,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { MarketCode, markets, money } from "@/lib/markets";
import { normalizeOptions, shiftOptions, stationsByPrice, type LockScope, type PriceOption } from "@/lib/price-options";
import { cents, quoteProtection, round4, settleFill, topUpFor, type Quote } from "@/lib/protection";
import { createClient } from "@/lib/supabase/client";
import { initialDemoControlSnapshot, type DemoControlSnapshot } from "@fuelcap/demo-control";
import { servicePlans, type LifecycleCommand, type LifecycleCustomer, type PlanId } from "@fuelcap/demo-data/customer-lifecycle";

type View = "home" | "onboarding" | "wallet" | "tank" | "lock" | "activity" | "settings";
type LockOptionRow = {
  scope_type: LockScope;
  scope_id: string | null;
  label: string;
  provider_name: string | null;
  unit_price: number | string;
  currency: string;
  unit: string;
  station_count: number | string;
  observed_at: string;
};
type LockRecord = {
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
};
type TransactionRecord = {
  id: string;
  type: string;
  amount: number;
  volume: number | null;
  unitPrice: number | null;
  description: string;
  createdAt: string;
  saving?: number;
};
type Account = { wallet: number; locks: LockRecord[]; transactions: TransactionRecord[] };
type Accounts = Record<MarketCode, Account>;
type StoredDemo = { market: MarketCode; accounts: Accounts; onboarded: boolean; customer: LifecycleCustomer | null };

const STORAGE_KEY = "fuelcap-demo-v2";
const LEGACY_STORAGE_KEY = "fuelcap-demo";
const emptyAccounts = (): Accounts => ({ US: { wallet: 0, locks: [], transactions: [] }, CA: { wallet: 0, locks: [], transactions: [] }, GB: { wallet: 0, locks: [], transactions: [] } });
const isActive = (lock: LockRecord) => ["active", "partially_redeemed"].includes(lock.status) && lock.remainingVolume > 0;

const demoStations: Record<MarketCode, { id: string; providerId: string; provider: string; label: string; price: number }[]> = {
  US: [
    { id: "11000000-0000-0000-0000-000000000001", providerId: "10000000-0000-0000-0000-000000000001", provider: "Shell", label: "Shell Downtown - 101 Main St, Austin, TX", price: 3.5 },
    { id: "11000000-0000-0000-0000-000000000002", providerId: "10000000-0000-0000-0000-000000000001", provider: "Shell", label: "Shell Riverside - 480 River Rd, Austin, TX", price: 3.49 },
    { id: "11000000-0000-0000-0000-000000000003", providerId: "10000000-0000-0000-0000-000000000002", provider: "BP", label: "BP Central - 220 Congress Ave, Austin, TX", price: 3.39 },
    { id: "11000000-0000-0000-0000-000000000004", providerId: "10000000-0000-0000-0000-000000000002", provider: "BP", label: "BP North - 8150 Burnet Rd, Austin, TX", price: 3.53 },
    { id: "11000000-0000-0000-0000-000000000005", providerId: "10000000-0000-0000-0000-000000000003", provider: "Chevron", label: "Chevron Airport - 2901 Airport Blvd, Austin, TX", price: 3.47 },
    { id: "11000000-0000-0000-0000-000000000006", providerId: "10000000-0000-0000-0000-000000000003", provider: "Chevron", label: "Chevron South - 7300 S Congress Ave, Austin, TX", price: 3.58 },
  ],
  CA: [
    { id: "21000000-0000-0000-0000-000000000001", providerId: "20000000-0000-0000-0000-000000000001", provider: "Shell", label: "Shell King Street - 548 King St W, Toronto, ON", price: 1.589 },
    { id: "21000000-0000-0000-0000-000000000002", providerId: "20000000-0000-0000-0000-000000000001", provider: "Shell", label: "Shell Lakeshore - 1250 Lake Shore Blvd, Toronto, ON", price: 1.629 },
    { id: "21000000-0000-0000-0000-000000000003", providerId: "20000000-0000-0000-0000-000000000002", provider: "Petro-Canada", label: "Petro-Canada Bloor - 55 Bloor St E, Toronto, ON", price: 1.609 },
    { id: "21000000-0000-0000-0000-000000000004", providerId: "20000000-0000-0000-0000-000000000002", provider: "Petro-Canada", label: "Petro-Canada Danforth - 1675 Danforth Ave, Toronto, ON", price: 1.649 },
    { id: "21000000-0000-0000-0000-000000000005", providerId: "20000000-0000-0000-0000-000000000003", provider: "Esso", label: "Esso Front Street - 200 Front St W, Toronto, ON", price: 1.619 },
    { id: "21000000-0000-0000-0000-000000000006", providerId: "20000000-0000-0000-0000-000000000003", provider: "Esso", label: "Esso North York - 5000 Yonge St, Toronto, ON", price: 1.669 },
  ],
  GB: [
    { id: "31000000-0000-0000-0000-000000000001", providerId: "30000000-0000-0000-0000-000000000001", provider: "Shell", label: "Shell Fulham - 147 New Kings Rd, London", price: 1.419 },
    { id: "31000000-0000-0000-0000-000000000002", providerId: "30000000-0000-0000-0000-000000000001", provider: "Shell", label: "Shell Islington - 108 Upper St, London", price: 1.449 },
    { id: "31000000-0000-0000-0000-000000000003", providerId: "30000000-0000-0000-0000-000000000002", provider: "BP", label: "BP Battersea - 9 York Rd, London", price: 1.429 },
    { id: "31000000-0000-0000-0000-000000000004", providerId: "30000000-0000-0000-0000-000000000002", provider: "BP", label: "BP Camden - 102 Camden Rd, London", price: 1.459 },
    { id: "31000000-0000-0000-0000-000000000005", providerId: "30000000-0000-0000-0000-000000000003", provider: "Texaco", label: "Texaco Brixton - 234 Brixton Rd, London", price: 1.439 },
    { id: "31000000-0000-0000-0000-000000000006", providerId: "30000000-0000-0000-0000-000000000003", provider: "Texaco", label: "Texaco Hackney - 88 Mare St, London", price: 1.479 },
  ],
};
// The US demo reference station (Shell Downtown, $3.50 → max $3.68, limit $4.03, as in the brief's cases A–C).
// The presenter's market control moves every US price by the control price's change from its baseline.
const US_REFERENCE_STATION_ID = demoStations.US[0].id;
const US_BASELINE_PRICE = initialDemoControlSnapshot.displayUnitPrice;

const nav: { id: View; label: string; icon: typeof Home }[] = [
  { id: "home", label: "Home", icon: Home },
  { id: "wallet", label: "Wallet", icon: WalletCards },
  { id: "tank", label: "My tank", icon: Fuel },
  { id: "lock", label: "Lock price", icon: LockKeyhole },
  { id: "activity", label: "Activity", icon: Activity },
  { id: "settings", label: "Settings", icon: Settings },
];
// Phones get four labelled tabs; Settings sits behind a header icon and the wallet opens from Home.
const phoneNav: { id: View; label: string; icon: typeof Home; views: View[] }[] = [
  { id: "home", label: "Home", icon: Home, views: ["home", "onboarding", "wallet"] },
  { id: "lock", label: "Protect", icon: ShieldCheck, views: ["lock"] },
  { id: "tank", label: "Pay", icon: QrCode, views: ["tank"] },
  { id: "activity", label: "Activity", icon: Activity, views: ["activity"] },
];

function buildFallbackOptions(marketCode: MarketCode): PriceOption[] {
  const market = markets[marketCode];
  const now = new Date().toISOString();
  return demoStations[marketCode].map((station) => ({
    scopeType: "station", scopeId: station.id, label: station.label,
    providerName: station.provider, unitPrice: station.price,
    currency: market.currency, unit: market.unit, stationCount: 1, observedAt: now,
  }));
}

const buttonBase =
  "inline-flex h-11 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";
const DEMO_CUSTOMER_ID = "FC-DEMO-1042";
const shortLabel = (label: string) => label.split(" - ")[0];

export function FuelCapApp() {
  const [view, setView] = useState<View>("home");
  const [marketCode, setMarketCode] = useState<MarketCode>("US");
  const [volume, setVolume] = useState(markets.US.defaultVolume);
  const [accounts, setAccounts] = useState<Accounts>(emptyAccounts);
  const [hydrated, setHydrated] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showRedeem, setShowRedeem] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [livePrices, setLivePrices] = useState<Partial<Record<MarketCode, number>>>({});
  const [rawOptions, setRawOptions] = useState<PriceOption[]>([]);
  const [optionsMarket, setOptionsMarket] = useState<MarketCode | null>(null);
  const [priceSource, setPriceSource] = useState("Demo price set");
  const [liveSource, setLiveSource] = useState(false);
  const [scopeType, setScopeType] = useState<LockScope>("station");
  const [scopeId, setScopeId] = useState<string | null>(null);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [onboarded, setOnboarded] = useState(false);
  const [demoControl, setDemoControl] = useState<DemoControlSnapshot>(initialDemoControlSnapshot);
  const [lifecycleCustomer, setLifecycleCustomer] = useState<LifecycleCustomer | null>(null);
  const baseMarket = markets[marketCode];
  const market = { ...baseMarket, livePrice: livePrices[marketCode] ?? baseMarket.livePrice };
  const account = accounts[marketCode];
  const lockPeriodDays = servicePlans.find((plan) => plan.id === lifecycleCustomer?.planId)?.lockPeriodDays ?? servicePlans[1].lockPeriodDays;

  const flash = useCallback((message: string, ms = 3600) => {
    setNotice(message);
    window.setTimeout(() => setNotice((current) => (current === message ? null : current)), ms);
  }, []);

  const updateAccount = useCallback((code: MarketCode, update: (current: Account) => Account) => {
    setAccounts((current) => ({ ...current, [code]: update(current[code]) }));
  }, []);

  // Prices: one normalised list per market feeds the home list, headline, lock quote and pump price.
  const usShift = marketCode === "US" ? round4(demoControl.displayUnitPrice - US_BASELINE_PRICE) : 0;
  const options = useMemo(() => {
    if (optionsMarket !== marketCode) return [];
    const normalized = normalizeOptions(rawOptions, markets[marketCode].name);
    return usShift ? shiftOptions(normalized, usShift) : normalized;
  }, [rawOptions, optionsMarket, marketCode, usShift]);
  const stationList = useMemo(() => stationsByPrice(options), [options]);
  const countryOption = options.find((option) => option.scopeType === "country");
  const referenceOption = (marketCode === "US" ? options.find((option) => option.scopeId === US_REFERENCE_STATION_ID) : undefined) ?? countryOption;
  const referencePrice = referenceOption?.unitPrice ?? (marketCode === "US" ? demoControl.displayUnitPrice : null);
  const selectedPriceOption = options.find((option) => option.scopeType === scopeType && (scopeType === "country" || option.scopeId === scopeId));
  const quotesPaused = marketCode === "US" && demoControl.quoteAvailability === "PAUSED";

  const pumpPriceFor = useCallback((lock: LockRecord) => {
    const option = lock.scopeType === "country"
      ? options.find((candidate) => candidate.scopeType === "country")
      : options.find((candidate) => candidate.scopeType === lock.scopeType && candidate.scopeId === lock.scopeId);
    return option?.unitPrice ?? lock.referencePrice;
  }, [options]);

  const loadCloudData = useCallback(async () => {
    setSyncing(true);
    const supabase = createClient();
    const [profileResult, locksResult, transactionsResult, pricesResult] = await Promise.all([
      supabase.from("profiles").select("market").maybeSingle(),
      supabase.from("price_locks").select("id,volume,remaining_volume,locked_unit_price,status,scope_type,reference_label,created_at").order("created_at", { ascending: false }),
      supabase.from("transactions").select("id,type,amount,volume,unit_price,description,created_at").order("created_at", { ascending: false }),
      supabase.from("price_snapshots").select("market,unit_price,observed_at").order("observed_at", { ascending: false }),
    ]);

    const code = profileResult.data?.market && markets[profileResult.data.market as MarketCode] ? profileResult.data.market as MarketCode : "US";
    setMarketCode(code);
    setVolume(markets[code].defaultVolume);
    updateAccount(code, (current) => ({
      ...current,
      locks: locksResult.data ? locksResult.data.map((row) => {
        const strike = Number(row.locked_unit_price);
        return {
          id: row.id, volume: Number(row.volume), remainingVolume: Number(row.remaining_volume),
          referencePrice: strike, strike, boundary: round4(strike * 1.15 / 1.05), chargePerUnit: 0, charge: 0,
          held: round4(Number(row.remaining_volume) * strike), status: row.status,
          scopeType: (row.scope_type ?? "country") as LockScope, scopeId: null,
          scopeLabel: row.reference_label ?? "Any eligible station", createdAt: row.created_at,
        };
      }) : current.locks,
      transactions: transactionsResult.data ? transactionsResult.data.map((row) => ({
        id: row.id, type: row.type, amount: Number(row.amount),
        volume: row.volume === null ? null : Number(row.volume),
        unitPrice: row.unit_price === null ? null : Number(row.unit_price),
        description: row.description, createdAt: row.created_at,
      })) : current.transactions,
    }));
    if (pricesResult.data) {
      const prices: Partial<Record<MarketCode, number>> = {};
      pricesResult.data.forEach((row) => {
        const priceMarket = row.market as MarketCode;
        if (prices[priceMarket] === undefined) prices[priceMarket] = Number(row.unit_price);
      });
      setLivePrices(prices);
    }
    setSyncing(false);
  }, [updateAccount]);

  useEffect(() => {
    let cancelled = false;
    function publish(next: PriceOption[], source: string, live: boolean) {
      if (cancelled) return;
      const normalized = normalizeOptions(next, markets[marketCode].name);
      const preferred = (marketCode === "US" ? normalized.find((option) => option.scopeId === US_REFERENCE_STATION_ID) : undefined) ?? stationsByPrice(normalized)[0];
      setRawOptions(next);
      setOptionsMarket(marketCode);
      setPriceSource(source);
      setLiveSource(live);
      setScopeType("station");
      setScopeId(preferred?.scopeId ?? null);
      setOptionsLoading(false);
    }
    async function loadPriceOptions() {
      if (marketCode === "GB") {
        try {
          const response = await fetch("/api/fuel-finder", { cache: "no-store" });
          if (response.ok) {
            const payload = await response.json() as { source: string; live: boolean; options: PriceOption[] };
            if (payload.options.length) return publish(payload.options, payload.live ? `${payload.source} · E10` : payload.source, payload.live);
          }
        } catch { /* use the verified database or demonstrator fallback below */ }
      }
      const { data } = await createClient().rpc("get_current_lock_options", { p_market: marketCode, p_fuel_grade: "regular" });
      const remoteOptions = ((data ?? []) as LockOptionRow[]).map((row: LockOptionRow) => ({
        scopeType: row.scope_type as LockScope,
        scopeId: row.scope_id,
        label: row.label,
        providerName: row.provider_name,
        unitPrice: Number(row.unit_price),
        currency: row.currency,
        unit: row.unit,
        stationCount: Number(row.station_count),
        observedAt: row.observed_at,
      }));
      if (remoteOptions.some((option) => option.scopeType === "station")) publish(remoteOptions, "Verified FuelCap price feed", true);
      else publish(buildFallbackOptions(marketCode), "Demo price set", false);
    }
    void loadPriceOptions();
    return () => { cancelled = true; };
  }, [marketCode]);

  useEffect(() => {
    let cancelled = false;
    async function refreshDemoControl() {
      try {
        const response = await fetch("/api/demo-control", { cache: "no-store" });
        if (!response.ok || cancelled) return;
        const next = await response.json() as DemoControlSnapshot;
        if (!cancelled) setDemoControl(next);
      } catch { /* keep the last known control price */ }
    }
    void refreshDemoControl();
    const interval = window.setInterval(refreshDemoControl, 1500);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, []);

  // Restore the demo customer (per-market wallets, protections, onboarding) after a refresh.
  useEffect(() => {
    window.setTimeout(() => {
      try {
        localStorage.removeItem(LEGACY_STORAGE_KEY);
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const data = JSON.parse(stored) as Partial<StoredDemo>;
          if (data.market && markets[data.market]) {
            setMarketCode(data.market);
            setVolume(markets[data.market].defaultVolume);
          }
          if (data.accounts) setAccounts({ ...emptyAccounts(), ...data.accounts });
          if (data.onboarded) setOnboarded(true);
          if (data.customer) setLifecycleCustomer(data.customer);
        }
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
      setHydrated(true);
    }, 0);
  }, []);

  useEffect(() => {
    if (!hydrated || userId) return;
    try {
      const data: StoredDemo = { market: marketCode, accounts, onboarded, customer: lifecycleCustomer };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch { /* storage unavailable: the session still works in memory */ }
  }, [hydrated, userId, marketCode, accounts, onboarded, lifecycleCustomer]);

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_FUELCAP_E2E === "true") return;
    const supabase = createClient();
    void supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? null);
      setUserId(data.user?.id ?? null);
      if (data.user) void loadCloudData();
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user.email ?? null);
      setUserId(session?.user.id ?? null);
      if (session?.user) {
        void loadCloudData();
      } else {
        setLivePrices({});
      }
    });
    return () => data.subscription.unsubscribe();
  }, [loadCloudData]);

  const activeLocks = account.locks.filter(isActive);
  const tankVolume = activeLocks.reduce((sum, lock) => sum + lock.remainingVolume, 0);
  const protectedVolume = activeLocks.reduce((sum, lock) => sum + lock.volume, 0);
  const heldValue = cents(activeLocks.reduce((sum, lock) => sum + lock.held, 0));
  // Fills draw on the earliest accepted protection first (Customer Rules, Rule 17).
  const activeLock = [...activeLocks].sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
  const savings = cents(account.transactions.reduce((sum, transaction) => sum + (transaction.saving ?? 0), 0));
  const protectedFills = account.transactions.filter((transaction) => (transaction.saving ?? 0) > 0).length;

  function changeMarket(code: MarketCode) {
    if (code === marketCode) return;
    setOptionsLoading(true);
    setMarketCode(code);
    setVolume(markets[code].defaultVolume);
    flash(`Market changed to ${markets[code].name}. Each country has its own wallet and protections.`, 3200);
    if (userId) void createClient().from("profiles").update({ market: code }).eq("id", userId);
  }

  function changeScope(nextScope: LockScope) {
    setScopeType(nextScope);
    const first = nextScope === "station" ? stationList[0] : options.filter((option) => option.scopeType === nextScope).sort((a, b) => a.unitPrice - b.unitPrice)[0];
    setScopeId(first?.scopeId ?? null);
  }

  async function sendLifecycle(command: LifecycleCommand) {
    const response = await fetch("/api/customer-lifecycle", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(command) });
    if (!response.ok) throw new Error("Customer record could not be synchronized");
    const snapshot = await response.json() as { customers: readonly LifecycleCustomer[] };
    const customer = snapshot.customers.find((entry) => entry.customerId === DEMO_CUSTOMER_ID) ?? null;
    setLifecycleCustomer(customer);
    return customer;
  }

  function recordFunding(amount: number) {
    // Only a registered demo customer has an operations record to update.
    if (!lifecycleCustomer) return;
    sendLifecycle({ type: "FUND_WALLET", customerId: DEMO_CUSTOMER_ID, amountMinor: Math.round(amount * 100) }).catch(() => undefined);
  }

  function addFunds(amount: number) {
    updateAccount(marketCode, (current) => ({
      ...current,
      wallet: cents(current.wallet + amount),
      transactions: [{ id: crypto.randomUUID(), type: "top_up", amount, volume: null, unitPrice: null, description: "Added funds · card ending 4242", createdAt: new Date().toISOString() }, ...current.transactions],
    }));
    recordFunding(amount);
    flash(`${money(amount, market)} added to your FuelCap wallet.`, 3200);
  }

  async function confirmLock() {
    if (quotesPaused) {
      flash("New quotes are paused by the governed demo decision. Your accepted quote remains protected.", 4200);
      return;
    }
    const selectedOption = selectedPriceOption;
    if (!selectedOption) {
      flash("Select an available price option before locking.", 3200);
      return;
    }
    const quote = quoteProtection(selectedOption.unitPrice, volume);
    setActionBusy(true);
    if (userId) {
      const { error } = await createClient().rpc("create_scoped_demo_lock", {
        p_market: marketCode,
        p_fuel_grade: "regular",
        p_volume: volume,
        p_scope_type: scopeType,
        p_scope_id: scopeType === "country" ? null : scopeId,
      });
      setActionBusy(false);
      if (error) {
        flash(error.message, 4200);
        return;
      }
      await loadCloudData();
      setView("tank");
      flash(`${volume} ${market.unit} protected.`, 3200);
      return;
    }
    const topUp = topUpFor(quote.total, account.wallet);
    const now = new Date().getTime();
    const lock: LockRecord = {
      id: crypto.randomUUID(), volume, remainingVolume: volume,
      referencePrice: quote.reference, strike: quote.strike, boundary: quote.boundary,
      chargePerUnit: quote.chargePerUnit, charge: quote.charge, held: quote.held, status: "active",
      scopeType, scopeId: scopeType === "country" ? null : scopeId, scopeLabel: selectedOption.label, createdAt: new Date(now).toISOString(),
    };
    const entries: TransactionRecord[] = [{
      id: crypto.randomUUID(), type: "lock", amount: -quote.total, volume, unitPrice: quote.strike,
      description: `Protected ${volume} ${market.unit} · ${shortLabel(selectedOption.label)} · max ${money(quote.strike, market)}/${market.unit} · charge ${money(quote.charge, market)}`,
      createdAt: new Date(now).toISOString(),
    }];
    if (topUp) entries.push({ id: crypto.randomUUID(), type: "top_up", amount: topUp, volume: null, unitPrice: null, description: "Added funds · card ending 4242", createdAt: new Date(now - 1).toISOString() });
    updateAccount(marketCode, (current) => ({
      wallet: cents(current.wallet + topUp - quote.total),
      locks: [lock, ...current.locks],
      transactions: [...entries, ...current.transactions],
    }));
    if (topUp) recordFunding(topUp);
    setActionBusy(false);
    setView("tank");
    flash(`${volume} ${market.unit} protected. You won't pay more than ${money(quote.strike, market)}/${market.unit} at ${shortLabel(selectedOption.label)} for ${lockPeriodDays} days.`, 5000);
  }

  async function redeemFuel(requested: number) {
    const lock = activeLock;
    if (!lock) {
      flash("Nothing is protected yet. Protect some fuel first.", 3600);
      return;
    }
    const amount = Math.min(requested, lock.remainingVolume);
    setActionBusy(true);
    if (userId) {
      const { error } = await createClient().rpc("redeem_demo_fuel", { p_lock_id: lock.id, p_volume: amount });
      if (error) {
        flash(error.message, 3600);
      } else {
        await loadCloudData();
        setShowRedeem(false);
        flash(`${amount} ${market.unit} redeemed from your virtual tank.`, 3600);
      }
      setActionBusy(false);
      return;
    }
    const pumpPrice = pumpPriceFor(lock);
    const fill = settleFill(amount, pumpPrice, lock.strike, lock.boundary);
    const now = new Date().getTime();
    const unitPrice = `${money(pumpPrice, market)}/${market.unit}`;
    const entries: TransactionRecord[] = [{
      id: crypto.randomUUID(), type: "redemption", amount: -cents(fill.fromProtected + fill.fromWallet), volume: amount, unitPrice: pumpPrice,
      description: fill.coveredByFuelCap > 0 ? `Filled ${amount} ${market.unit} at ${unitPrice} · FuelCap covered ${money(fill.coveredByFuelCap, market)}` : `Filled ${amount} ${market.unit} at ${unitPrice} · paid the pump price`,
      createdAt: new Date(now).toISOString(), saving: fill.coveredByFuelCap,
    }];
    if (fill.returnedToWallet > 0) entries.unshift({
      id: crypto.randomUUID(), type: "refund", amount: fill.returnedToWallet, volume: amount, unitPrice: pumpPrice,
      description: "Pump below your max price · returned to wallet", createdAt: new Date(now + 1).toISOString(),
    });
    updateAccount(marketCode, (current) => ({
      wallet: cents(current.wallet + fill.returnedToWallet - fill.fromWallet),
      locks: current.locks.map((candidate) => candidate.id !== lock.id ? candidate : {
        ...candidate,
        remainingVolume: candidate.remainingVolume - amount,
        held: Math.max(round4(candidate.held - fill.heldReleased), 0),
        status: candidate.remainingVolume === amount ? "redeemed" : "partially_redeemed",
      }),
      transactions: [...entries, ...current.transactions],
    }));
    setShowRedeem(false);
    setActionBusy(false);
    const filled = `${amount} ${market.unit} filled at ${unitPrice}.`;
    if (fill.outcome === "rise") flash(`${filled} FuelCap covered ${money(fill.coveredByFuelCap, market)}.`, 5000);
    else if (fill.outcome === "spike") flash(`${filled} FuelCap covered ${money(fill.coveredByFuelCap, market)}. ${money(fill.fromWallet, market)} above your limit came from your wallet.`, 6000);
    else if (fill.outcome === "fall") flash(`${filled} You paid the pump price, and ${money(fill.returnedToWallet, market)} went back to your wallet.`, 5000);
    else flash(`${filled} You paid your max price.`, 5000);
  }

  async function shareSavings() {
    const text = `I've saved ${money(savings, market)} on fuel with FuelCap.`;
    const url = window.location.origin;
    try {
      if (navigator.share) {
        await navigator.share({ title: "FuelCap", text, url });
        return;
      }
      await navigator.clipboard.writeText(`${text} ${url}`);
      flash("Link copied. Share it anywhere.", 3200);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      flash("Sharing isn't available in this browser.", 3200);
    }
  }

  const showWelcome = hydrated && !onboarded && !userId;

  return (
    <div className="min-h-dvh bg-[#f3f6f4] md:grid md:grid-cols-[224px_1fr]">
      <aside className="hidden min-h-dvh border-r border-[#dce5df] bg-white px-4 py-5 md:flex md:flex-col">
        <Brand />
        <nav className="mt-10 space-y-1" aria-label="Primary navigation">
          {nav.map((item) => <NavButton key={item.id} item={item} active={view === item.id} onClick={() => setView(item.id)} />)}
        </nav>
        <div className="mt-auto rounded-md border border-[#dce5df] bg-[#f7faf8] p-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#0b7a4b]">
            <ShieldCheck size={16} /> {userId ? "Account synced" : "Demo"}
          </div>
          <p className="mt-1 text-xs leading-5 text-[#61716b]">{userId ? "Account data persists securely." : "Simulated money. No real payments or fuel purchases."}</p>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-[#dce5df] bg-white/95 px-4 backdrop-blur md:px-8">
          <div className="md:hidden" data-testid="phone-brand"><Brand compact /></div>
          <div className="hidden md:block">
            <p className="text-xs font-medium text-[#61716b]">{userId ? "Account synced" : "Personal account"}</p>
            <p className="text-sm font-semibold">Good morning{userEmail ? `, ${userEmail.split("@")[0]}` : ", Francis"}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <span className="rounded-full bg-[#fff3d6] px-2 py-1 text-[11px] font-bold tracking-wide text-[#6b5310]" title="Simulated money only" data-testid="demo-pill">DEMO</span>
            <label className="sr-only" htmlFor="market">Market</label>
            <select
              id="market"
              value={marketCode}
              onChange={(event) => changeMarket(event.target.value as MarketCode)}
              className="h-10 w-[68px] rounded-md border border-[#dce5df] bg-white px-2 text-sm font-semibold"
            >
              <option value="US">US</option><option value="CA">CA</option><option value="GB">UK</option>
            </select>
            <button onClick={() => setView("settings")} className={`grid size-10 place-items-center rounded-md border md:hidden ${view === "settings" ? "border-[#0ba75e] bg-[#dff5e9] text-[#0b7a4b]" : "border-[#dce5df] bg-white"}`} aria-label="Settings">
              <Settings size={18} />
            </button>
            <button onClick={() => setShowMenu(true)} className="grid size-10 place-items-center rounded-md bg-[#0b1b2b] text-white" aria-label="Open account menu">
              <Menu size={19} />
            </button>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 pb-28 pt-6 md:px-8 md:pb-10 md:pt-8">
          {view === "home" && <HomeView market={market} tankVolume={tankVolume} protectedVolume={protectedVolume} heldValue={heldValue} walletBalance={account.wallet} showWelcome={showWelcome} startCustomer={() => setView("onboarding")} savings={savings} protectedFills={protectedFills} stations={stationList} pricesLoading={optionsLoading || optionsMarket !== marketCode} referenceOption={referenceOption} referencePrice={referencePrice} activeLock={activeLock} pumpPrice={activeLock ? pumpPriceFor(activeLock) : referencePrice ?? 0} lockPeriodDays={lockPeriodDays} setView={setView} redeem={() => setShowRedeem(true)} share={() => void shareSavings()} />}
          {view === "onboarding" && <OnboardingView send={sendLifecycle} complete={(customer) => { setLifecycleCustomer(customer); setOnboarded(true); setView("wallet"); }} />}
          {view === "wallet" && <WalletView market={market} balance={account.wallet} customer={lifecycleCustomer} addFunds={addFunds} changePlan={(planId) => void sendLifecycle({ type: "CHANGE_PLAN", customerId: DEMO_CUSTOMER_ID, planId }).catch(() => undefined)} setView={setView} />}
          {view === "tank" && <TankView market={market} tankVolume={tankVolume} heldValue={heldValue} locks={account.locks} setView={setView} redeem={() => setShowRedeem(true)} />}
          {view === "lock" && <LockView market={market} volume={volume} setVolume={setVolume} confirm={confirmLock} busy={actionBusy} options={options} stations={stationList} selected={selectedPriceOption} scopeType={scopeType} scopeId={scopeId} changeScope={changeScope} setScopeId={setScopeId} loading={optionsLoading || optionsMarket !== marketCode} quotesPaused={quotesPaused} priceSource={liveSource ? priceSource : "Demo price set"} lockPeriodDays={lockPeriodDays} walletBalance={account.wallet} sandbox={!userId} />}
          {view === "activity" && <ActivityView market={market} transactions={account.transactions} />}
          {view === "settings" && <SettingsView marketCode={marketCode} changeMarket={changeMarket} customerName={lifecycleCustomer?.name ?? null} />}
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid h-[76px] grid-cols-4 border-t border-[#dce5df] bg-white px-1 pb-[env(safe-area-inset-bottom)] md:hidden" aria-label="Primary navigation">
        {phoneNav.map((item) => {
          const Icon = item.icon;
          const active = item.views.includes(view);
          return (
            <button key={item.id} onClick={() => setView(item.id)} aria-current={active ? "page" : undefined} className={`flex min-w-0 flex-col items-center justify-center gap-1 text-xs font-semibold ${active ? "text-[#0b7a4b]" : "text-[#52625c]"}`}>
              <Icon size={22} strokeWidth={active ? 2.5 : 2} /><span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {notice && <div role="status" className="fixed bottom-24 left-1/2 z-50 w-[calc(100%-32px)] max-w-md -translate-x-1/2 rounded-md bg-[#0b1b2b] px-4 py-3 text-center text-sm font-semibold text-white shadow-xl md:bottom-6">{notice}</div>}
      {showRedeem && <RedeemDialog market={market} volume={tankVolume} lock={activeLock} pumpPrice={activeLock ? pumpPriceFor(activeLock) : 0} busy={actionBusy} redeem={redeemFuel} close={() => setShowRedeem(false)} protect={() => { setShowRedeem(false); setView("lock"); }} />}
      {showMenu && <AccountMenu email={userEmail} close={() => setShowMenu(false)} openAuth={() => { setShowMenu(false); setShowAuth(true); }} />}
      {showAuth && <AuthDialog close={() => setShowAuth(false)} />}
      {syncing && <div role="status" className="fixed right-4 top-20 z-40 rounded-md border border-[#dce5df] bg-white px-3 py-2 text-xs font-semibold shadow-sm">Syncing account...</div>}
    </div>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <Image src="/fuelcap-mark.svg" alt="" width={compact ? 27 : 32} height={compact ? 27 : 32} style={{ height: "auto" }} />
      <span className={`font-[family-name:var(--font-space-grotesk)] font-bold ${compact ? "text-lg" : "text-xl"}`}>FuelCap</span>
    </div>
  );
}

function NavButton({ item, active, onClick }: { item: (typeof nav)[number]; active: boolean; onClick: () => void }) {
  const Icon = item.icon;
  return <button onClick={onClick} className={`flex h-11 w-full items-center gap-3 rounded-md px-3 text-sm font-semibold ${active ? "bg-[#dff5e9] text-[#0b7a4b]" : "text-[#61716b] hover:bg-[#f3f6f4]"}`}><Icon size={18} />{item.label}</button>;
}

type MarketProps = { market: (typeof markets)[MarketCode] };

function pumpStatus(pumpPrice: number, lock: LockRecord, market: MarketProps["market"]) {
  const unit = `/${market.unit}`;
  if (pumpPrice < lock.strike) return { label: "Pump is below your max price", value: `You pay ${money(pumpPrice, market)}${unit}`, tone: "text-[#ffb3a8]" };
  if (pumpPrice === lock.strike) return { label: "Pump is at your max price", value: `You pay ${money(lock.strike, market)}${unit}`, tone: "text-white" };
  if (pumpPrice <= lock.boundary) return { label: "FuelCap covers", value: `${money(pumpPrice - lock.strike, market)}${unit}`, tone: "text-[#ffc24b]" };
  return { label: "Above your limit", value: `Covered to ${money(lock.boundary, market)}${unit}`, tone: "text-[#ffc24b]" };
}

function HomeView({ market, tankVolume, protectedVolume, heldValue, walletBalance, showWelcome, startCustomer, savings, protectedFills, stations, pricesLoading, referenceOption, referencePrice, activeLock, pumpPrice, lockPeriodDays, setView, redeem, share }: MarketProps & { tankVolume: number; protectedVolume: number; heldValue: number; walletBalance: number; showWelcome: boolean; startCustomer: () => void; savings: number; protectedFills: number; stations: PriceOption[]; pricesLoading: boolean; referenceOption?: PriceOption; referencePrice: number | null; activeLock?: LockRecord; pumpPrice: number; lockPeriodDays: number; setView: (view: View) => void; redeem: () => void; share: () => void }) {
  const unit = `/${market.unit}`;
  const status = activeLock ? pumpStatus(pumpPrice, activeLock, market) : null;
  const referenceLabel = referenceOption?.scopeType === "station" ? referenceOption.label : `Typical price across ${referenceOption?.stationCount ?? 0} ${market.name} stations`;
  const cheapest = stations[0];
  const gauge = protectedVolume > 0 ? Math.round((tankVolume / protectedVolume) * 100) : 0;
  return (
    <div className="view-enter">
      {showWelcome && <section className="mb-5 grid gap-5 rounded-lg bg-[#0b1b2b] p-6 text-white md:grid-cols-[1fr_auto] md:items-center"><div><p className="text-xs font-bold uppercase tracking-wide text-[#8fb8a6]">Welcome to FuelCap</p><h1 className="mt-2 text-2xl font-bold">Pay less for fuel with a price you can plan around</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#c7d6ce]">Create your profile, add funds, protect the fuel you expect to use and pay from your virtual tank at participating retailers.</p></div><button type="button" onClick={startCustomer} className={`${buttonBase} bg-[#0ba75e] text-white`}><CircleUserRound size={17} />Create your profile</button></section>}
      <div className="mb-6 flex items-end justify-between gap-4">
        <div><p className="text-sm font-medium text-[#61716b]">Your overview</p><h1 className="font-[family-name:var(--font-space-grotesk)] text-2xl font-bold md:text-3xl">{tankVolume > 0 ? "Your fuel is protected" : "Plan your next fill"}</h1></div>
        <button onClick={() => setView("lock")} className={`${buttonBase} whitespace-nowrap bg-[#0ba75e] text-white hover:bg-[#0b7a4b]`}><LockKeyhole size={17} />Lock price</button>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.3fr_.7fr]">
        <section className="rounded-md bg-[#0b1b2b] p-5 text-white md:p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase text-[#8fb8a6]">{activeLock ? "Your max price" : "Pump price now"}</p>
              <p className="mt-2 font-[family-name:var(--font-space-grotesk)] text-4xl font-bold md:text-5xl" data-testid="headline-unit-price">{activeLock ? money(activeLock.strike, market) : referencePrice === null ? "Loading…" : money(referencePrice, market)}{(activeLock || referencePrice !== null) && <span className="ml-1 text-base font-medium text-[#8fb8a6]">{unit}</span>}</p>
              <p className="mt-2 max-w-md text-xs text-[#8fb8a6]">{activeLock ? `${activeLock.remainingVolume} ${market.unit} at ${activeLock.scopeLabel}` : referencePrice === null ? `Loading ${market.name} prices` : referenceLabel}</p>
            </div>
            <span className="rounded-md bg-[#17364a] px-2 py-1 text-xs font-semibold text-[#dff5e9]">Regular</span>
          </div>
          <div className="mt-7 grid grid-cols-2 gap-4 border-t border-[#284052] pt-5">
            {activeLock && status ? <>
              <div><p className="text-xs text-[#8fb8a6]">Pump price now</p><p className="mt-1 text-lg font-semibold">{money(pumpPrice, market)}{unit}</p></div>
              <div className="border-l border-[#284052] pl-4"><p className="text-xs text-[#8fb8a6]">{status.label}</p><p className={`mt-1 text-lg font-semibold ${status.tone}`}>{status.value}</p></div>
            </> : <>
              <div><p className="text-xs text-[#8fb8a6]">Protect today and pay no more than</p><p className="mt-1 text-lg font-semibold text-[#ffc24b]">{referencePrice === null ? "…" : `${money(referencePrice * 1.05, market)}${unit}`}</p></div>
              <div className="border-l border-[#284052] pl-4"><p className="text-xs text-[#8fb8a6]">Price protected for</p><p className="mt-1 text-lg font-semibold">{lockPeriodDays} days</p></div>
            </>}
          </div>
        </section>
        <section className="rounded-md border border-[#dce5df] bg-white p-5">
          <div className="flex items-center justify-between"><p className="font-semibold">Virtual tank</p><Fuel className="text-[#0ba75e]" size={20} /></div>
          <p className="mt-6 font-[family-name:var(--font-space-grotesk)] text-4xl font-bold">{tankVolume}<span className="ml-1 text-base font-medium text-[#61716b]">{market.unit}</span></p>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#edf2ef]" role="progressbar" aria-label="Protected fuel remaining" aria-valuemin={0} aria-valuemax={100} aria-valuenow={gauge}><div className="h-full bg-[#0ba75e]" style={{ width: `${gauge}%` }} /></div>
          <p className="mt-2 text-xs text-[#61716b]">{tankVolume > 0 ? `${tankVolume} of ${protectedVolume} ${market.unit} left · ${money(heldValue, market)} held` : "Nothing protected yet"}</p>
          <button onClick={redeem} className={`${buttonBase} mt-4 w-full border border-[#0ba75e] text-[#0b7a4b] hover:bg-[#dff5e9]`}><QrCode size={17} />Redeem at pump</button>
        </section>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <button type="button" onClick={() => setView("wallet")} className="rounded-md text-left outline-offset-2 hover:ring-2 hover:ring-[#dff5e9]" aria-label={`Wallet: ${money(walletBalance, market)}. Open wallet`}><Metric icon={WalletCards} label="Available wallet balance" value={money(walletBalance, market)} detail={walletBalance > 0 ? "Ready to protect fuel · Open wallet" : "Add funds here or when you protect"} /></button>
        <Metric icon={ShieldCheck} label="Protected fuel" value={`${tankVolume} ${market.unit}`} detail={tankVolume > 0 ? `${money(heldValue, market)} held for it` : "Lock a price to protect fuel"} />
        <Metric icon={MapPin} label="Stations priced" value={pricesLoading ? "…" : stations.length.toLocaleString(market.locale)} detail={cheapest ? `Lowest ${money(cheapest.unitPrice, market)}${unit}` : "Loading prices…"} />
      </div>
      <section className="mt-4 rounded-md border border-[#dce5df] bg-white"><div className="flex items-center justify-between border-b border-[#dce5df] p-4"><div><h2 className="font-semibold">Lowest prices</h2><p className="text-xs text-[#61716b]">Published station prices, lowest first</p></div><MapPin size={19} className="text-[#0b7a4b]" /></div>
        {pricesLoading ? <p className="p-4 text-sm text-[#61716b]">Loading {market.name} prices…</p> :
          <div className="divide-y divide-[#e5ebe7]">{stations.slice(0, 3).map((option, index) => <div key={option.scopeId} className="grid grid-cols-[1fr_auto] gap-3 p-4"><div className="min-w-0"><p className="font-semibold">{shortLabel(option.label)}</p><p className="truncate text-xs text-[#61716b]">{option.label.split(" - ").slice(1).join(" - ") || option.providerName}</p></div><div className="text-right"><p className="font-semibold">{money(option.unitPrice, market)}{unit}</p><p className="text-xs text-[#0b7a4b]">{index === 0 ? "Lowest" : option.providerName}</p></div></div>)}</div>}
      </section>
      {savings > 0 && <section className="mt-4 flex flex-col justify-between gap-4 rounded-md border border-[#efd695] bg-[#fff8e6] p-5 sm:flex-row sm:items-center">
        <div><p className="text-sm text-[#735d2c]">Saved with FuelCap so far</p><p className="font-[family-name:var(--font-space-grotesk)] text-2xl font-bold">{money(savings, market)}</p><p className="mt-1 text-sm text-[#735d2c]">Across {protectedFills} protected {protectedFills === 1 ? "fill" : "fills"}.</p></div>
        <button onClick={share} className={`${buttonBase} shrink-0 bg-[#ffc24b] text-[#0b1b2b] hover:bg-[#f0b337]`}><Gift size={17} />Share my savings</button>
      </section>}
    </div>
  );
}

function OnboardingView({ send, complete }: { send: (command: LifecycleCommand) => Promise<LifecycleCustomer | null>; complete: (customer: LifecycleCustomer) => void }) {
  const [step, setStep] = useState<"profile" | "licence" | "checking" | "pin">("profile");
  const [planId, setPlanId] = useState<PlanId>("STANDARD");
  const [name, setName] = useState("Francis Doherty");
  const [email, setEmail] = useState("francis.doherty@example.test");
  const [phone, setPhone] = useState("+44 7700 900042");
  const [licenceName, setLicenceName] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [customer, setCustomer] = useState<LifecycleCustomer | null>(null);
  async function register() { setBusy(true); const record = await send({ type: "REGISTER_CUSTOMER", customer: { customerId: DEMO_CUSTOMER_ID, name, email, phone, planId } }); setCustomer(record); setStep("licence"); setBusy(false); }
  async function verify() { setBusy(true); await send({ type: "START_KYC", customerId: DEMO_CUSTOMER_ID, licenceLast4: "2048" }); setStep("checking"); setBusy(false); window.setTimeout(async () => { const record = await send({ type: "VERIFY_KYC", customerId: DEMO_CUSTOMER_ID }); setCustomer(record); setStep("pin"); }, process.env.NEXT_PUBLIC_FUELCAP_E2E === "true" ? 150 : 3000); }
  async function finish() { if (pin.length !== 4) return; setBusy(true); const record = await send({ type: "SET_PIN", customerId: DEMO_CUSTOMER_ID }); if (record) complete(record); setBusy(false); }
  return <div className="view-enter mx-auto max-w-4xl"><PageTitle eyebrow={`Set up your account · ${step === "profile" ? "1" : step === "licence" ? "2" : step === "checking" ? "3" : "4"} of 4`} title={step === "profile" ? "Choose how you use FuelCap" : step === "licence" ? "Verify your identity" : step === "checking" ? "We are checking your licence" : "Your FuelCap card is ready"} />
    {step === "profile" && <section className="rounded-lg border border-[#dce5df] bg-white p-5 md:p-7"><div className="grid gap-4 sm:grid-cols-3">{servicePlans.map((plan) => <button type="button" key={plan.id} onClick={() => setPlanId(plan.id)} className={`rounded-lg border p-4 text-left ${planId === plan.id ? "border-[#0ba75e] bg-[#edf8f1] ring-2 ring-[#0ba75e]/20" : "border-[#dce5df]"}`}><span className="text-xs font-bold uppercase text-[#0b7a4b]">{plan.name}</span><strong className="mt-2 block text-xl">{plan.monthlyFeeMinor ? `£${(plan.monthlyFeeMinor / 100).toFixed(2)}` : "Free"}<small className="text-xs font-normal text-[#61716b]"> / month</small></strong><span className="mt-2 block text-xs text-[#61716b]">Up to £{plan.walletLimitMinor / 100} · {plan.stationScope.toLowerCase()} protection</span></button>)}</div><div className="mt-6 grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold">Full name<input aria-label="Full name" value={name} onChange={(e) => setName(e.target.value)} className="mt-2 h-11 w-full rounded-md border border-[#cdd9d1] px-3 font-normal" /></label><label className="text-sm font-semibold">Mobile number<input aria-label="Mobile number" value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-2 h-11 w-full rounded-md border border-[#cdd9d1] px-3 font-normal" /></label><label className="text-sm font-semibold sm:col-span-2">Email address<input aria-label="Email address" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-2 h-11 w-full rounded-md border border-[#cdd9d1] px-3 font-normal" /></label></div><button type="button" disabled={busy || !name || !email || !phone} onClick={() => void register()} className={`${buttonBase} mt-6 w-full bg-[#0ba75e] text-white`}>{busy ? "Creating account..." : "Continue to identity check"}</button></section>}
    {step === "licence" && <section className="rounded-lg border border-[#dce5df] bg-white p-6 text-center"><div className="mx-auto grid size-14 place-items-center rounded-full bg-[#dff5e9] text-[#0b7a4b]"><BadgeCheck size={28}/></div><h2 className="mt-4 text-xl font-bold">Add your driving licence</h2><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[#61716b]">Take a clear photo on your phone. We use it to confirm your identity before activating your wallet and card.</p><label className="mx-auto mt-6 block max-w-md rounded-lg border-2 border-dashed border-[#9bc7ad] bg-[#f4fbf7] p-7 font-semibold text-[#0b7a4b]">{licenceName || "Take or choose licence photo"}<input aria-label="Driving licence photo" className="sr-only" type="file" accept="image/*" capture="environment" onChange={(event) => setLicenceName(event.target.files?.[0]?.name ?? "licence.jpg")}/></label><button type="button" disabled={!licenceName || busy} onClick={() => void verify()} className={`${buttonBase} mt-5 w-full max-w-md bg-[#0ba75e] text-white`}>Submit for verification</button></section>}
    {step === "checking" && <section role="status" className="rounded-lg border border-[#efd695] bg-[#fff8e6] p-8 text-center"><div className="mx-auto size-12 animate-spin rounded-full border-4 border-[#eadba9] border-t-[#0b7a4b]"/><h2 className="mt-5 text-xl font-bold">Verification in progress</h2><p className="mt-2 text-sm text-[#735d2c]">Your customer record is already visible to the operations team. This demonstration completes the identity check in a few seconds.</p></section>}
    {step === "pin" && <section className="rounded-lg border border-[#9bc7ad] bg-white p-6"><div className="flex items-start gap-3 rounded-md bg-[#edf8f1] p-4 text-[#0b7a4b]"><BadgeCheck size={22}/><div><strong className="block">Identity verified</strong><span className="text-sm">Your virtual card was issued automatically.</span></div></div><div className="mt-5 rounded-md bg-[#0b1b2b] p-5 text-white"><span className="text-xs uppercase text-[#8fb8a6]">FuelCap virtual card</span><p className="mt-5 text-xl tracking-[.12em]">{customer?.card.maskedPan}</p><p className="mt-3 text-sm text-[#8fb8a6]">Expires {customer?.card.expiry}</p></div><label className="mt-5 block text-sm font-semibold">Choose a 4-digit PIN<input aria-label="Card PIN" inputMode="numeric" maxLength={4} type="password" value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, ""))} className="mt-2 h-12 w-full rounded-md border border-[#cdd9d1] px-3 text-center text-xl tracking-[.5em]" /></label><button type="button" disabled={pin.length !== 4 || busy} onClick={() => void finish()} className={`${buttonBase} mt-5 w-full bg-[#0ba75e] text-white`}>Open my wallet</button></section>}
  </div>;
}

function WalletView({ market, balance, customer, addFunds, changePlan, setView }: MarketProps & { balance: number; customer: LifecycleCustomer | null; addFunds: (amount: number) => void; changePlan: (planId: PlanId) => void; setView: (view: View) => void }) {
  return <div className="view-enter"><PageTitle eyebrow="Money" title="FuelCap wallet" />
    <section className="grid gap-5 rounded-lg bg-[#0b1b2b] p-6 text-white md:grid-cols-[1fr_auto] md:items-center"><div><p className="text-sm text-[#8fb8a6]">Available to protect fuel</p><p className="mt-2 text-5xl font-bold">{money(balance, market)}</p><p className="mt-3 text-sm text-[#c7d6ce]">Wallet funds stay yours until you use them to protect fuel. Money never expires.</p></div><WalletCards size={42} className="text-[#65d49a]" /></section>
    <section className="mt-5 rounded-lg border border-[#dce5df] bg-white p-5"><h2 className="font-semibold">Add funds</h2><p className="mt-1 text-sm text-[#61716b]">Choose an amount using your saved payment method ending 4242. You can also add funds in the same step when you lock a price.</p><div className="mt-4 grid grid-cols-3 gap-2">{[100,250,500].map((amount) => <button type="button" key={amount} onClick={() => addFunds(amount)} className="h-12 rounded-md border border-[#b8d6c3] bg-[#edf8f1] font-semibold text-[#0b7a4b]">+{money(amount, market, 0)}</button>)}</div><button type="button" onClick={() => setView("lock")} className={`${buttonBase} mt-5 w-full bg-[#0ba75e] text-white`}><LockKeyhole size={17} />Choose fuel protection</button></section>
    <section className="mt-5 rounded-lg border border-[#dce5df] bg-white p-5"><div className="flex items-center gap-3"><CircleDollarSign className="text-[#0b7a4b]" /><div><h2 className="font-semibold">How your money moves</h2><p className="text-sm text-[#61716b]">Available cash → held for protected fuel → retailer settlement. Every step shows in Activity.</p></div></div></section>
    {customer && <section className="mt-5 rounded-lg border border-[#dce5df] bg-white p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase text-[#0b7a4b]">Your {customer.planId.toLowerCase()} plan</p><h2 className="mt-1 font-semibold">Need broader price protection?</h2><p className="mt-1 text-sm text-[#61716b]">Change plan at any time. Limits and eligible station coverage update immediately.</p></div><BadgeCheck className="text-[#0b7a4b]"/></div><div className="mt-4 grid grid-cols-3 gap-2">{servicePlans.map((plan) => <button type="button" key={plan.id} disabled={customer.planId === plan.id} onClick={() => changePlan(plan.id)} className={`rounded-md border px-2 py-3 text-sm font-semibold ${customer.planId === plan.id ? "border-[#0ba75e] bg-[#dff5e9] text-[#0b7a4b]" : "border-[#dce5df]"}`}>{plan.name}<span className="block text-[10px] font-normal">{plan.monthlyFeeMinor ? `£${(plan.monthlyFeeMinor / 100).toFixed(2)}/mo` : "Free"}</span></button>)}</div></section>}
  </div>;
}

function Metric({ icon: Icon, label, value, detail }: { icon: typeof Home; label: string; value: string; detail: string }) {
  return <div className="rounded-md border border-[#dce5df] bg-white p-4"><div className="flex items-center gap-2 text-sm font-medium text-[#61716b]"><Icon size={17} className="text-[#0b7a4b]" />{label}</div><p className="mt-3 text-2xl font-bold">{value}</p><p className="mt-1 text-xs text-[#61716b]">{detail}</p></div>;
}

function TankView({ market, tankVolume, heldValue, locks, setView, redeem }: MarketProps & { tankVolume: number; heldValue: number; locks: LockRecord[]; setView: (view: View) => void; redeem: () => void }) {
  const current = locks.find(isActive);
  return <div className="view-enter"><PageTitle eyebrow="Balance" title="My virtual tank" />
    <section className="grid gap-5 rounded-md bg-[#0b1b2b] p-6 text-white md:grid-cols-[1fr_auto] md:items-center">
      <div><p className="text-sm text-[#8fb8a6]">Protected regular {market.fuelWord}</p><p className="mt-2 font-[family-name:var(--font-space-grotesk)] text-5xl font-bold">{tankVolume} <span className="text-xl text-[#8fb8a6]">{market.unit}</span></p><p className="mt-3 text-sm text-[#c7d6ce]">{current ? `Max ${money(current.strike, market)}/${market.unit} at ${current.scopeLabel} · ${money(heldValue, market)} held` : "Lock a price to protect your first fill."}</p></div>
      <div className="flex gap-2"><button onClick={() => setView("lock")} className={`${buttonBase} bg-[#0ba75e] text-white`}><LockKeyhole size={17} />Add fuel</button><button onClick={redeem} className={`${buttonBase} border border-[#476070] text-white`}><QrCode size={17} />Redeem</button></div>
    </section>
    <section className="mt-5 rounded-md border border-[#dce5df] bg-white"><div className="border-b border-[#dce5df] p-4"><h2 className="font-semibold">Active price locks</h2></div>
      {locks.length === 0 ? <EmptyState icon={LockKeyhole} title="Nothing protected yet" text="Lock a price to protect your next fill. You can add funds in the same step." action={() => setView("lock")} /> :
        <div className="divide-y divide-[#e5ebe7]">{locks.map((lock) => <div key={lock.id} className="flex items-center justify-between gap-4 p-4"><div className="min-w-0"><p className="font-semibold">{lock.remainingVolume} of {lock.volume} {market.unit} remaining</p><p className="truncate text-xs text-[#61716b]">{shortLabel(lock.scopeLabel)} · {new Date(lock.createdAt).toLocaleString(market.locale)}</p></div><div className="text-right"><p className="font-semibold">Max {money(lock.strike, market)}/{market.unit}</p><p className="text-xs capitalize text-[#0b7a4b]">{lock.status.replace("_", " ")}</p></div></div>)}</div>}
    </section>
  </div>;
}

function LockView({
  market, volume, setVolume, confirm, busy, options, stations, selected, scopeType,
  scopeId, changeScope, setScopeId, loading, quotesPaused, priceSource, lockPeriodDays, walletBalance, sandbox,
}: MarketProps & {
  volume: number;
  setVolume: (n: number) => void;
  confirm: () => Promise<void>;
  busy: boolean;
  options: PriceOption[];
  stations: PriceOption[];
  selected: PriceOption | undefined;
  scopeType: LockScope;
  scopeId: string | null;
  changeScope: (scope: LockScope) => void;
  setScopeId: (id: string | null) => void;
  loading: boolean;
  quotesPaused: boolean;
  priceSource: string;
  lockPeriodDays: number;
  walletBalance: number;
  sandbox: boolean;
}) {
  const scopedOptions = scopeType === "station" ? stations : options.filter((option) => option.scopeType === scopeType).sort((a, b) => a.unitPrice - b.unitPrice);
  const [searchQuery, setSearchQuery] = useState("");
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationState, setLocationState] = useState<"idle" | "locating" | "denied">("idle");
  const distance = (option: PriceOption) => {
    if (!location || option.latitude == null || option.longitude == null) return null;
    const radians = (value: number) => value * Math.PI / 180;
    const dLat = radians(option.latitude - location.latitude);
    const dLon = radians(option.longitude - location.longitude);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(location.latitude)) * Math.cos(radians(option.latitude)) * Math.sin(dLon / 2) ** 2;
    return 3958.8 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };
  const matches = (query: string) => {
    const needle = query.trim().toLocaleLowerCase();
    return scopedOptions.filter((option) => !needle || `${option.label} ${option.providerName ?? ""}`.toLocaleLowerCase().includes(needle));
  };
  const matching = matches(searchQuery);
  const ranked = matching.map((option) => ({ option, distance: distance(option) }));
  if (location) ranked.sort((a, b) => (a.distance ?? Number.MAX_VALUE) - (b.distance ?? Number.MAX_VALUE));
  const searchResults = ranked.slice(0, 12);
  const selectedResult = ranked.find(({ option }) => option.scopeId === scopeId);
  if (selectedResult && !searchResults.includes(selectedResult)) searchResults.unshift(selectedResult);
  const search = (query: string) => {
    setSearchQuery(query);
    // The quote always follows a visible, selected result.
    const next = matches(query);
    if (!next.some((option) => option.scopeId === scopeId)) setScopeId(next[0]?.scopeId ?? null);
  };
  const locate = () => {
    setLocationState("locating");
    navigator.geolocation.getCurrentPosition(({ coords }) => { setLocation({ latitude: coords.latitude, longitude: coords.longitude }); setLocationState("idle"); }, () => setLocationState("denied"), { timeout: 10_000, maximumAge: 300_000 });
  };
  const quote: Quote | null = selected ? quoteProtection(selected.unitPrice, volume) : null;
  const topUp = quote && sandbox ? topUpFor(quote.total, walletBalance) : 0;
  const unit = `/${market.unit}`;
  const priceLabel = scopeType === "station" ? "Current station price" : scopeType === "provider" ? "Typical brand price" : "Typical price anywhere";
  const scopeCopy = scopeType === "station"
    ? "This cap can be redeemed only at the selected filling station."
    : scopeType === "provider"
      ? `This cap works at ${selected?.stationCount ?? 0} covered ${selected?.label ?? "provider"} stations.`
      : `This cap works at ${selected?.stationCount ?? 0} eligible stations across ${market.name}.`;
  const confirmText = busy ? "Saving..." : quotesPaused ? "New quotes paused" : topUp ? `Add ${money(topUp, market)} & protect ${volume} ${market.unit}` : quote ? `Protect ${volume} ${market.unit} · ${money(quote.total, market)}` : "Confirm lock";
  return <div className="view-enter mx-auto max-w-3xl"><PageTitle eyebrow="New price lock" title={`Lock today's ${market.fuelWord} price`} />
    {quotesPaused && <p role="status" className="mb-4 rounded-md border border-[#efb0a8] bg-[#fff0ed] px-4 py-3 text-sm text-[#8a3026]">New protections are paused for a moment. Anything you&apos;ve already protected is unaffected.</p>}
    <section className="rounded-md border border-[#dce5df] bg-white p-5 md:p-7">
      <fieldset>
        <legend className="text-sm font-semibold">Where do you want your cap to work?</legend>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {([
            ["station", "Station"],
            ["provider", "Brand"],
            ["country", "Anywhere"],
          ] as [LockScope, string][]).map(([scope, label]) => (
            <button type="button" key={scope} aria-label={scope === "station" ? "One station" : scope === "provider" ? "One brand" : "Anywhere"} aria-pressed={scopeType === scope} onClick={() => { setSearchQuery(""); changeScope(scope); }} className={`h-11 rounded-md border px-2 text-sm font-semibold ${scopeType === scope ? "border-[#0ba75e] bg-[#dff5e9] text-[#0b7a4b]" : "border-[#dce5df] bg-white"}`}>{label}</button>
          ))}
        </div>
      </fieldset>

      {scopeType !== "country" && <div className="mt-5">
        <label htmlFor="scope-search" className="text-sm font-semibold">{scopeType === "station" ? "Find a filling station" : "Find a fuel brand"}</label>
        <div className="mt-2 flex gap-2"><div className="relative min-w-0 flex-1"><Search aria-hidden="true" size={18} className="absolute left-3 top-3.5 text-[#61716b]"/><input id="scope-search" value={searchQuery} onChange={(event) => search(event.target.value)} disabled={loading} placeholder={scopeType === "station" ? "Station, postcode, town or city" : "Search brands or operators"} className="h-12 w-full rounded-md border border-[#cdd9d1] bg-white pl-10 pr-3 text-sm" /></div>{scopeType === "station" && <button type="button" onClick={locate} disabled={locationState === "locating"} aria-label="Sort stations nearest first" className="inline-flex h-12 items-center gap-2 rounded-md border border-[#cdd9d1] px-3 text-sm font-semibold"><LocateFixed size={17}/><span className="hidden sm:inline">{locationState === "locating" ? "Locating…" : location ? "Nearest" : "Near me"}</span></button>}</div>
        {locationState === "denied" && <p className="mt-2 text-xs text-[#9a4b32]">Location was unavailable. Search by postcode, town, city or station name instead.</p>}
        <div className="mt-2 max-h-80 overflow-y-auto rounded-md border border-[#dce5df]" role="listbox" aria-label={scopeType === "station" ? "Matching filling stations" : "Matching fuel brands"}>
          {searchResults.map(({ option, distance: miles }) => { const chosen = scopeId === option.scopeId; return <button type="button" role="option" aria-selected={chosen} key={option.scopeId} onClick={() => setScopeId(option.scopeId)} className={`grid w-full grid-cols-[1fr_auto] gap-3 border-b border-[#edf1ee] p-3 text-left last:border-0 ${chosen ? "bg-[#e7f7ee] shadow-[inset_4px_0_0_#0b7a4b]" : "bg-white hover:bg-[#f6faf7]"}`}><span className="min-w-0"><strong className="block truncate text-sm">{shortLabel(option.label)}</strong><small className="mt-1 block truncate text-[#61716b]">{scopeType === "station" ? option.label.split(" - ").slice(1).join(" - ") || option.providerName : `${option.stationCount} covered stations`}</small></span><span className="text-right"><strong className="block text-sm">{money(option.unitPrice, market)}{unit}</strong>{chosen ? <small className="mt-1 block font-semibold text-[#0b7a4b]">Selected</small> : miles != null && <small className="mt-1 block text-[#0b7a4b]">{miles < 10 ? miles.toFixed(1) : Math.round(miles)} miles</small>}</span></button>; })}
          {loading && <p className="p-4 text-sm text-[#61716b]">Loading {market.name} prices…</p>}
          {!loading && searchResults.length === 0 && <p className="p-4 text-sm text-[#61716b]">No matches. Try a shorter station, postcode, town, city or brand name.</p>}
        </div>
        <p className="mt-2 text-xs text-[#61716b]">Showing {Math.min(searchResults.length, matching.length)} of {matching.length.toLocaleString(market.locale)} matches · {location ? "nearest first" : "lowest price first"}.</p>
      </div>}

      <div className="mt-5 flex items-start justify-between gap-4 border-y border-[#e5ebe7] py-5">
        <div className="min-w-0">
          <p className="text-sm text-[#61716b]">{priceLabel}</p>
          <p className="mt-1 font-[family-name:var(--font-space-grotesk)] text-3xl font-bold">{loading ? "Loading..." : selected ? money(selected.unitPrice, market) : "Select a station"}{selected && !loading && <span className="text-sm font-medium text-[#61716b]">{unit}</span>}</p>
          <p className="mt-2 max-w-md text-xs leading-5 text-[#61716b]">{loading ? "Retrieving station prices" : selected?.label ?? "Choose a station from the list above"}</p>
          {scopeType === "station" && selected?.latitude != null && selected.longitude != null && <a className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[#0b7a4b]" href={`https://www.openstreetmap.org/?mlat=${selected.latitude}&mlon=${selected.longitude}#map=16/${selected.latitude}/${selected.longitude}`} target="_blank" rel="noreferrer">View on map <ExternalLink size={13}/></a>}
        </div>
        <span className="shrink-0 rounded-md bg-[#dff5e9] px-3 py-2 text-xs font-bold text-[#0b7a4b]">{scopeType === "station" ? "1 station" : `${selected?.stationCount ?? 0} stations`}</span>
      </div>
      <div className="mt-4 flex items-start gap-2 text-xs leading-5 text-[#61716b]"><MapPin size={15} className="mt-0.5 shrink-0 text-[#0b7a4b]" /><p>{scopeCopy} Your plan protects this price for <strong>{lockPeriodDays} days</strong>. Source: <strong>{priceSource}</strong>. Published prices may differ from the forecourt display after a recent update.</p></div>

      <div className="py-6"><div className="flex items-center justify-between"><label htmlFor="volume" className="font-semibold">How much to lock?</label><output className="text-xl font-bold">{volume} {market.unit}</output></div>
        <input id="volume" className="mt-5 w-full accent-[#0ba75e]" type="range" min={market.unit === "gal" ? 10 : 40} max={market.maxVolume} step={market.unit === "gal" ? 5 : 10} value={volume} onChange={(e) => setVolume(Number(e.target.value))} />
        <div className="mt-2 flex justify-between text-xs text-[#61716b]"><span>{market.unit === "gal" ? 10 : 40} {market.unit}</span><span>{market.maxVolume} {market.unit}</span></div>
      </div>

      {quote && !loading && <div className="rounded-md border border-[#dce5df] p-4" aria-label="Protection summary">
        <div className="flex items-end justify-between gap-3"><div><p className="text-sm text-[#61716b]">Your max price</p><p className="text-xs text-[#61716b]">5% above today&apos;s {money(quote.reference, market)}</p></div><p className="font-[family-name:var(--font-space-grotesk)] text-2xl font-bold text-[#0b7a4b]">{money(quote.strike, market)}<span className="text-sm font-medium text-[#61716b]">{unit}</span></p></div>
        <dl className="mt-3 space-y-2 border-t border-[#e5ebe7] pt-3 text-sm">
          <div className="flex justify-between gap-3"><dt>Held for your fuel<span className="block text-xs text-[#61716b]">{volume} {market.unit} × {money(quote.strike, market)}. Unused money stays yours.</span></dt><dd className="font-semibold">{money(quote.held, market)}</dd></div>
          <div className="flex justify-between gap-3"><dt>Protection charge<span className="block text-xs text-[#61716b]">{money(quote.chargePerUnit, market)}{unit}, one-off, not refundable</span></dt><dd className="font-semibold">{money(quote.charge, market)}</dd></div>
          <div className="flex justify-between gap-3 border-t border-[#e5ebe7] pt-2 text-base font-bold"><dt>Total from wallet</dt><dd>{money(quote.total, market)}</dd></div>
        </dl>
        {topUp > 0 && <p className="mt-3 rounded-md bg-[#f1f7f3] px-3 py-2 text-sm leading-5 text-[#33443d]">Your wallet has {money(walletBalance, market)}. We&apos;ll add <strong>{money(topUp, market)}</strong> from your card ending 4242 in the same step.</p>}
      </div>}
      <div className="mt-4 rounded-md bg-[#dff5e9] p-4"><div className="flex gap-3"><ShieldCheck className="shrink-0 text-[#0b7a4b]" size={21} /><div className="text-sm leading-6 text-[#285e46]"><p className="font-semibold text-[#0b7a4b]">FuelCap protection</p><p>Price rises: we pay the difference above your max price, up to {quote ? money(quote.boundary, market) : "the limit"}{unit}.</p><p>Price falls: you pay the lower pump price and the rest goes back to your wallet.</p><p>Your money never expires. Only the price cap has a clock.</p></div></div></div>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-[#e5ebe7] pt-5"><div><p className="text-xs text-[#61716b]">Total from wallet (simulated)</p><p className="text-2xl font-bold">{quote && !loading ? money(quote.total, market) : "—"}</p></div><button aria-label={`Confirm price lock: ${confirmText}`} disabled={busy || loading || !selected || quotesPaused} onClick={confirm} className={`${buttonBase} h-12 bg-[#0b7a4b] px-6 text-white hover:bg-[#0b1b2b]`}><LockKeyhole size={18} />{confirmText}</button></div>
    </section>
    <p className="mt-4 text-center text-xs leading-5 text-[#61716b]">Demo only. Simulated money: no payment is taken and no fuel is purchased.</p>
  </div>;
}

function ActivityView({ market, transactions }: MarketProps & { transactions: TransactionRecord[] }) {
  const rows = useMemo(() => [...transactions].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((transaction) => ({
    id: transaction.id,
    icon: transaction.type === "redemption" ? Fuel : transaction.type === "lock" ? LockKeyhole : transaction.type === "top_up" ? WalletCards : BadgeCheck,
    title: transaction.description,
    amount: `${transaction.amount > 0 ? "+" : ""}${money(transaction.amount, market)}`,
    positive: transaction.amount > 0,
    date: new Date(transaction.createdAt),
  })), [market, transactions]);
  return <div className="view-enter"><PageTitle eyebrow="Account" title="Activity" /><section className="overflow-hidden rounded-md border border-[#dce5df] bg-white"><div className="border-b border-[#dce5df] p-4"><h2 className="font-semibold">Recent transactions</h2></div>
    {rows.length === 0 ? <p className="p-6 text-center text-sm text-[#61716b]">No activity yet. Your first protection will show here.</p> :
      <div className="divide-y divide-[#e5ebe7]">{rows.map((row) => { const Icon = row.icon; return <div key={row.id} className="grid grid-cols-[40px_1fr_auto] items-center gap-3 p-4"><div className="grid size-10 place-items-center rounded-md bg-[#edf7f1] text-[#0b7a4b]"><Icon size={18} /></div><div className="min-w-0"><p className="text-sm font-semibold">{row.title}</p><p className="mt-0.5 text-xs text-[#61716b]">{row.date.toLocaleString(market.locale)}</p></div><p className={`whitespace-nowrap text-sm font-semibold ${row.positive ? "text-[#0b7a4b]" : ""}`}>{row.amount}</p></div>; })}</div>}
  </section></div>;
}

function SettingsView({ marketCode, changeMarket, customerName }: { marketCode: MarketCode; changeMarket: (code: MarketCode) => void; customerName: string | null }) {
  return <div className="view-enter"><PageTitle eyebrow="Preferences" title="Settings" /><div className="grid gap-4 lg:grid-cols-2">
    <section className="rounded-md border border-[#dce5df] bg-white p-5"><div className="flex items-center gap-3"><CircleUserRound size={22} className="text-[#0b7a4b]" /><div><h2 className="font-semibold">Customer profile</h2><p className="text-sm text-[#61716b]">{customerName ? `${customerName} · FuelCap member` : "Demo customer · profile not created yet"}</p></div></div><p className="mt-4 text-sm text-[#61716b]">Payment method: card ending 4242 (simulated).</p></section>
    <section className="rounded-md border border-[#dce5df] bg-white p-5"><h2 className="font-semibold">Market and units</h2><p className="mt-1 text-sm text-[#61716b]">Each country has its own wallet, currency and protections. Switching doesn&apos;t move money between them.</p><div className="mt-4 grid grid-cols-3 gap-2">{(Object.keys(markets) as MarketCode[]).map((code) => <button key={code} onClick={() => changeMarket(code)} className={`h-10 rounded-md border text-sm font-semibold ${marketCode === code ? "border-[#0ba75e] bg-[#dff5e9] text-[#0b7a4b]" : "border-[#dce5df]"}`}>{code === "GB" ? "UK" : code}</button>)}</div></section>
  </div></div>;
}

function PageTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return <div className="mb-6"><p className="text-sm font-medium text-[#61716b]">{eyebrow}</p><h1 className="font-[family-name:var(--font-space-grotesk)] text-2xl font-bold md:text-3xl">{title}</h1></div>;
}

function EmptyState({ icon: Icon, title, text, action }: { icon: typeof Home; title: string; text: string; action: () => void }) {
  return <div className="flex flex-col items-center px-5 py-10 text-center"><div className="grid size-11 place-items-center rounded-md bg-[#dff5e9] text-[#0b7a4b]"><Icon size={21} /></div><p className="mt-3 font-semibold">{title}</p><p className="mt-1 max-w-sm text-sm text-[#61716b]">{text}</p><button onClick={action} className={`${buttonBase} mt-4 bg-[#0b7a4b] text-white`}>Protect fuel</button></div>;
}

function RedeemDialog({ market, volume, lock, pumpPrice, busy, redeem, close, protect }: MarketProps & { volume: number; lock?: LockRecord; pumpPrice: number; busy: boolean; redeem: (amount: number) => Promise<void>; close: () => void; protect: () => void }) {
  const remaining = lock?.remainingVolume ?? 0;
  const steps = market.unit === "gal" ? [10, 20] : [20, 40];
  const fillOptions = [...new Set([...steps.filter((step) => step < remaining), remaining])].filter((amount) => amount > 0);
  const [chosen, setChosen] = useState(steps[1]);
  const fillVolume = Math.min(chosen, remaining);
  return <div role="dialog" aria-modal="true" aria-labelledby="redeem-title" className="fixed inset-0 z-50 grid place-items-end bg-[#0b1b2b]/55 p-0 sm:place-items-center sm:p-4"><div className="w-full max-w-md rounded-t-lg bg-white p-5 shadow-2xl sm:rounded-lg">
    <div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase text-[#0b7a4b]">Retailer payment</p><h2 id="redeem-title" className="text-xl font-bold">Pay with your tank</h2></div><button onClick={close} className="grid size-9 place-items-center rounded-md border border-[#dce5df]" aria-label="Close"><X size={18} /></button></div>
    {volume <= 0 || !lock ? <div className="mt-6 rounded-md border border-[#dce5df] p-6 text-center">
      <p className="font-semibold">Nothing protected yet</p>
      <p className="mt-1 text-sm text-[#61716b]">Protect some fuel first, then pay at the pump from here.</p>
      <button onClick={protect} className={`${buttonBase} mt-4 bg-[#0b7a4b] text-white`}><LockKeyhole size={17} />Protect fuel</button>
    </div> : <>
      <div className="mx-auto mt-6 w-fit rounded-md border border-[#dce5df] bg-white p-4"><QRCodeSVG value={`fuelcap-demo:${market.code}:${lock.id}:${volume}`} size={210} fgColor="#0b1b2b" /></div>
      <p className="mt-5 text-center font-semibold">{volume} {market.unit} available · max {money(lock.strike, market)}/{market.unit}</p><p className="mt-1 text-center text-sm text-[#61716b]">Pump price now {money(pumpPrice, market)}/{market.unit} at {shortLabel(lock.scopeLabel)}. Show this code to the retailer, who confirms the quantity dispensed.</p>
      <fieldset className="mt-4"><legend className="text-sm font-semibold">How much are you filling?</legend><div className="mt-2 grid grid-cols-3 gap-2">{fillOptions.map((amount) => <button type="button" key={amount} aria-pressed={amount === fillVolume} onClick={() => setChosen(amount)} className={`h-11 rounded-md border text-sm font-semibold ${amount === fillVolume ? "border-2 border-[#0b7a4b] bg-[#dff5e9] text-[#0b7a4b]" : "border-[#dce5df]"}`}>{amount === remaining && amount !== steps[0] && amount !== steps[1] ? `All ${amount} ${market.unit}` : `${amount} ${market.unit}`}</button>)}</div></fieldset>
      <button disabled={busy || fillVolume <= 0} onClick={() => redeem(fillVolume)} className={`${buttonBase} mt-5 w-full bg-[#0b7a4b] text-white`}>{busy ? "Completing fill..." : `Retailer confirms ${fillVolume} ${market.unit}`}</button>
    </>}
    <button onClick={close} className={`${buttonBase} mt-2 w-full border border-[#dce5df]`}>Cancel</button>
  </div></div>;
}

function AccountMenu({ email, close, openAuth }: { email: string | null; close: () => void; openAuth: () => void }) {
  async function signOut() {
    await createClient().auth.signOut();
    close();
  }
  return <div className="fixed inset-0 z-50 bg-[#0b1b2b]/40" onMouseDown={close}><div onMouseDown={(e) => e.stopPropagation()} className="ml-auto min-h-full w-full max-w-sm bg-white p-5 shadow-2xl">
    <div className="flex items-center justify-between"><Brand /><button onClick={close} className="grid size-9 place-items-center rounded-md border border-[#dce5df]" aria-label="Close menu"><X size={18} /></button></div>
    <div className="mt-8 flex items-center gap-3 rounded-md bg-[#f3f6f4] p-4"><CircleUserRound size={32} className="text-[#0b7a4b]" /><div className="min-w-0"><p className="font-semibold">{email ? "FuelCap member" : "Customer account"}</p><p className="truncate text-xs text-[#61716b]">{email ?? "Demo profile on this device"}</p></div></div>
    {email ? <button onClick={signOut} className={`${buttonBase} mt-8 w-full border border-[#dce5df] text-[#b0382b]`}><LogOut size={17} />Sign out</button> :
      <button onClick={openAuth} className={`${buttonBase} mt-8 w-full bg-[#0ba75e] text-white`}><CircleUserRound size={17} />Create account or sign in</button>}
  </div></div>;
}

function AuthDialog({ close }: { close: () => void }) {
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    const supabase = createClient();
    const result = mode === "sign-in"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: email.split("@")[0] },
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
    setBusy(false);
    if (result.error) {
      setMessage(result.error.message);
      return;
    }
    if (mode === "sign-up" && !result.data.session) {
      setMessage("Check your email to confirm your FuelCap account.");
      return;
    }
    close();
  }

  return <div role="dialog" aria-modal="true" aria-labelledby="auth-title" className="fixed inset-0 z-[60] grid place-items-center bg-[#0b1b2b]/55 p-4"><div className="w-full max-w-md rounded-lg bg-white p-6 shadow-2xl">
    <div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase text-[#0b7a4b]">FuelCap account</p><h2 id="auth-title" className="text-xl font-bold">{mode === "sign-in" ? "Sign in" : "Create account"}</h2></div><button onClick={close} className="grid size-9 place-items-center rounded-md border border-[#dce5df]" aria-label="Close"><X size={18} /></button></div>
    <form onSubmit={submit} className="mt-6 space-y-4">
      <label className="block text-sm font-semibold">Email<input required type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1.5 h-11 w-full rounded-md border border-[#cdd9d1] px-3 font-normal" /></label>
      <label className="block text-sm font-semibold">Password<input required minLength={8} type="password" autoComplete={mode === "sign-in" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1.5 h-11 w-full rounded-md border border-[#cdd9d1] px-3 font-normal" /></label>
      {message && <p role="status" className="rounded-md bg-[#fff0ed] px-3 py-2 text-sm text-[#8a3026]">{message}</p>}
      <button disabled={busy} className={`${buttonBase} w-full bg-[#0ba75e] text-white`}>{busy ? "Please wait..." : mode === "sign-in" ? "Sign in" : "Create account"}</button>
    </form>
    <button onClick={() => { setMode(mode === "sign-in" ? "sign-up" : "sign-in"); setMessage(null); }} className="mt-4 w-full text-center text-sm font-semibold text-[#0b7a4b]">{mode === "sign-in" ? "Create a new account" : "Already have an account? Sign in"}</button>
  </div></div>;
}
