"use client";

import Image from "next/image";
import {
  Activity, BadgeCheck, Bell, ChevronRight, CircleDollarSign, CircleUserRound, Fuel,
  ExternalLink, Gift, Home, LocateFixed, LockKeyhole, LogOut, MapPin, Menu, QrCode, ReceiptText,
  Search, Settings, ShieldCheck, SlidersHorizontal, WalletCards, X,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { demoLockedPrice, MarketCode, markets, money } from "@/lib/markets";
import { createClient } from "@/lib/supabase/client";
import { initialDemoControlSnapshot, type DemoControlSnapshot } from "@fuelcap/demo-control";
import { servicePlans, type LifecycleCommand, type LifecycleCustomer, type PlanId } from "@fuelcap/demo-data/customer-lifecycle";

type View = "home" | "onboarding" | "wallet" | "tank" | "lock" | "activity" | "settings";
type LockScope = "station" | "provider" | "country";
type PriceOption = {
  scopeType: LockScope;
  scopeId: string | null;
  label: string;
  providerName: string | null;
  unitPrice: number;
  currency: string;
  unit: string;
  stationCount: number;
  observedAt: string;
  latitude?: number;
  longitude?: number;
  referenceStationLabel?: string;
};
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
  unitPrice: number;
  total: number;
  status: string;
  scopeType: LockScope;
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
};

const demoStations: Record<MarketCode, { id: string; providerId: string; provider: string; label: string; price: number }[]> = {
  US: [
    { id: "11000000-0000-0000-0000-000000000001", providerId: "10000000-0000-0000-0000-000000000001", provider: "Shell", label: "Shell Downtown - 101 Main St, Austin, TX", price: 3.42 },
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

function buildFallbackOptions(marketCode: MarketCode): PriceOption[] {
  const market = markets[marketCode];
  const stations = demoStations[marketCode];
  const now = new Date().toISOString();
  const stationOptions: PriceOption[] = stations.map((station) => ({
    scopeType: "station", scopeId: station.id, label: station.label,
    providerName: station.provider, unitPrice: station.price,
    currency: market.currency, unit: market.unit, stationCount: 1, observedAt: now,
  }));
  const providers = new Map<string, PriceOption>();
  stations.forEach((station) => {
    const existing = providers.get(station.providerId);
    providers.set(station.providerId, {
      scopeType: "provider", scopeId: station.providerId, label: station.provider,
      providerName: station.provider,
      unitPrice: Math.max(existing?.unitPrice ?? 0, station.price),
      currency: market.currency, unit: market.unit,
      stationCount: (existing?.stationCount ?? 0) + 1, observedAt: now,
    });
  });
  const country: PriceOption = {
    scopeType: "country", scopeId: null, label: `Any eligible ${market.name} station`,
    providerName: null, unitPrice: Math.max(...stations.map((station) => station.price)),
    currency: market.currency, unit: market.unit, stationCount: stations.length, observedAt: now,
  };
  return [...stationOptions, ...providers.values(), country];
}

const nav: { id: View; label: string; icon: typeof Home }[] = [
  { id: "home", label: "Home", icon: Home },
  { id: "wallet", label: "Wallet", icon: WalletCards },
  { id: "tank", label: "My tank", icon: Fuel },
  { id: "lock", label: "Lock price", icon: LockKeyhole },
  { id: "activity", label: "Activity", icon: Activity },
  { id: "settings", label: "Settings", icon: Settings },
];

const buttonBase =
  "inline-flex h-11 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";
const DEMO_NOW = Date.UTC(2026, 6, 24, 12);
const DEMO_CUSTOMER_ID = "FC-DEMO-1042";

export function FuelCapApp() {
  const [view, setView] = useState<View>("home");
  const [marketCode, setMarketCode] = useState<MarketCode>("US");
  const [volume, setVolume] = useState(markets.US.defaultVolume);
  const [locks, setLocks] = useState<LockRecord[]>([]);
  const [showMenu, setShowMenu] = useState(false);
  const [showRedeem, setShowRedeem] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [livePrices, setLivePrices] = useState<Partial<Record<MarketCode, number>>>({});
  const [priceOptions, setPriceOptions] = useState<PriceOption[]>([]);
  const [priceSource, setPriceSource] = useState("Verified FuelCap price feed");
  const [scopeType, setScopeType] = useState<LockScope>("station");
  const [scopeId, setScopeId] = useState<string | null>(null);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [customerReady, setCustomerReady] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);
  const [demoControl, setDemoControl] = useState<DemoControlSnapshot>(initialDemoControlSnapshot);
  const [bridgeReachable, setBridgeReachable] = useState(false);
  const [lifecycleCustomer, setLifecycleCustomer] = useState<LifecycleCustomer | null>(null);
  const baseMarket = markets[marketCode];
  const livePrice = livePrices[marketCode] ?? baseMarket.livePrice;
  const market = { ...baseMarket, livePrice, lockedPrice: demoLockedPrice(baseMarket, livePrice) };

  const loadCloudData = useCallback(async () => {
    setSyncing(true);
    const supabase = createClient();
    const [profileResult, locksResult, transactionsResult, pricesResult] = await Promise.all([
      supabase.from("profiles").select("market").maybeSingle(),
      supabase.from("price_locks").select("id,volume,remaining_volume,locked_unit_price,status,scope_type,reference_label,created_at").order("created_at", { ascending: false }),
      supabase.from("transactions").select("id,type,amount,volume,unit_price,description,created_at").order("created_at", { ascending: false }),
      supabase.from("price_snapshots").select("market,unit_price,observed_at").order("observed_at", { ascending: false }),
    ]);

    if (profileResult.data?.market && markets[profileResult.data.market as MarketCode]) {
      const code = profileResult.data.market as MarketCode;
      setMarketCode(code);
      setVolume(markets[code].defaultVolume);
    }
    if (locksResult.data) {
      setLocks(locksResult.data.map((row) => ({
        id: row.id,
        volume: Number(row.volume),
        remainingVolume: Number(row.remaining_volume),
        unitPrice: Number(row.locked_unit_price),
        total: Number(row.volume) * Number(row.locked_unit_price),
        status: row.status,
        scopeType: (row.scope_type ?? "country") as LockScope,
        scopeLabel: row.reference_label ?? "Any eligible station",
        createdAt: row.created_at,
      })));
    }
    if (transactionsResult.data) {
      setTransactions(transactionsResult.data.map((row) => ({
        id: row.id,
        type: row.type,
        amount: Number(row.amount),
        volume: row.volume === null ? null : Number(row.volume),
        unitPrice: row.unit_price === null ? null : Number(row.unit_price),
        description: row.description,
        createdAt: row.created_at,
      })));
    }
    if (pricesResult.data) {
      const prices: Partial<Record<MarketCode, number>> = {};
      pricesResult.data.forEach((row) => {
        const code = row.market as MarketCode;
        if (prices[code] === undefined) prices[code] = Number(row.unit_price);
      });
      setLivePrices(prices);
    }
    setSyncing(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadPriceOptions() {
      if (marketCode === "GB") {
        try {
          const response = await fetch("/api/fuel-finder", { cache: "no-store" });
          if (response.ok) {
            const payload = await response.json() as { source: string; live: boolean; options: PriceOption[] };
            if (!cancelled && payload.options.length) {
              setPriceOptions(payload.options);
              setPriceSource(payload.live ? `${payload.source} · live E10` : payload.source);
              const first = payload.options.find((option) => option.scopeType === "station");
              setScopeType("station");
              setScopeId(first?.scopeId ?? null);
              setOptionsLoading(false);
              return;
            }
          }
        } catch { /* use the verified database or demonstrator fallback below */ }
      }
      const { data } = await createClient().rpc("get_current_lock_options", { p_market: marketCode, p_fuel_grade: "regular" });
      if (cancelled) return;
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
      const options = remoteOptions.length > 0 ? remoteOptions : buildFallbackOptions(marketCode);
      setPriceSource(remoteOptions.length > 0 ? "Verified FuelCap price feed" : marketCode === "GB" ? "Fuel Finder fallback dataset" : "FuelCap fallback dataset");
      setPriceOptions(options);
      const first = options.find((option) => option.scopeType === "station");
      setScopeType("station");
      setScopeId(first?.scopeId ?? null);
      setOptionsLoading(false);
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
        const next = await response.json() as DemoControlSnapshot & { bridgeReachable: boolean };
        if (!cancelled) { setDemoControl(next); setBridgeReachable(next.bridgeReachable); }
      } catch { if (!cancelled) setBridgeReachable(false); }
    }
    void refreshDemoControl();
    const interval = window.setInterval(refreshDemoControl, 1500);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem("fuelcap-demo");
    if (!stored) return;
    window.setTimeout(() => {
      try {
        const data = JSON.parse(stored) as { market?: MarketCode; locks?: LockRecord[] };
        if (data.market && markets[data.market]) {
          setMarketCode(data.market);
          setVolume(markets[data.market].defaultVolume);
        }
        if (Array.isArray(data.locks)) {
          setLocks(data.locks.map((lock) => ({
            ...lock,
            remainingVolume: lock.remainingVolume ?? lock.volume,
            status: lock.status ?? "active",
            scopeType: lock.scopeType ?? "country",
            scopeLabel: lock.scopeLabel ?? "Any eligible station",
          })));
        }
      } catch {
        localStorage.removeItem("fuelcap-demo");
      }
    }, 0);
  }, []);

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
        setTransactions([]);
        setLivePrices({});
        setLocks([]);
      }
    });
    return () => data.subscription.unsubscribe();
  }, [loadCloudData]);

  useEffect(() => {
    if (!userId) localStorage.setItem("fuelcap-demo", JSON.stringify({ market: marketCode, locks }));
  }, [marketCode, locks, userId]);

  const tankVolume = locks.reduce((sum, item) => sum + item.remainingVolume, 0);
  const saved = market.code === "US" ? 142 : market.code === "CA" ? 96 : 71;
  const selectedPriceOption = priceOptions.find((option) =>
    option.scopeType === scopeType && (scopeType === "country" || option.scopeId === scopeId));
  const currentOpenOption = priceOptions.find((option) => option.scopeType === "country");
  const controlledPriceOption = selectedPriceOption && marketCode === "US" ? { ...selectedPriceOption, unitPrice: demoControl.displayUnitPrice, observedAt: demoControl.updatedAt } : selectedPriceOption;
  const controlledReferencePrice = marketCode === "US" ? demoControl.displayUnitPrice : currentOpenOption?.unitPrice ?? market.livePrice;
  const activeLock = locks.find((lock) => ["active", "partially_redeemed"].includes(lock.status));

  function changeMarket(code: MarketCode) {
    if (code === marketCode) {
      setOptionsLoading(false);
      return;
    }
    setOptionsLoading(true);
    setMarketCode(code);
    setVolume(markets[code].defaultVolume);
    setNotice(`Market changed to ${markets[code].name}`);
    window.setTimeout(() => setNotice(null), 2600);
    if (userId) void createClient().from("profiles").update({ market: code }).eq("id", userId);
  }

  function changeScope(nextScope: LockScope) {
    setScopeType(nextScope);
    const first = priceOptions.find((option) => option.scopeType === nextScope);
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

  async function confirmLock() {
    if (marketCode === "US" && demoControl.quoteAvailability === "PAUSED") {
      setNotice("New quotes are paused by the governed demo decision. Your accepted quote remains protected.");
      window.setTimeout(() => setNotice(null), 4200);
      return;
    }
    const selectedOption = priceOptions.find((option) =>
      option.scopeType === scopeType && (scopeType === "country" || option.scopeId === scopeId));
    if (!selectedOption) {
      setNotice("Select an available price option before locking.");
      window.setTimeout(() => setNotice(null), 3200);
      return;
    }
    const effectiveUnitPrice = marketCode === "US" ? demoControl.displayUnitPrice : selectedOption.unitPrice;
    const purchaseTotal = volume * effectiveUnitPrice;
    if (!userId && walletBalance < purchaseTotal) {
      setNotice(`Add ${money(purchaseTotal - walletBalance, market)} to your wallet before protecting this fuel.`);
      setView("wallet");
      window.setTimeout(() => setNotice(null), 4200);
      return;
    }
    setActionBusy(true);
    if (userId) {
      const { error } = await createClient().rpc("create_scoped_demo_lock", {
        p_market: marketCode,
        p_fuel_grade: "regular",
        p_volume: volume,
        p_scope_type: scopeType,
        p_scope_id: scopeType === "country" ? null : scopeId,
      });
      if (error) {
        setNotice(error.message);
        setActionBusy(false);
        window.setTimeout(() => setNotice(null), 4200);
        return;
      }
      await loadCloudData();
    } else {
    const record: LockRecord = {
      id: crypto.randomUUID(),
      volume,
      remainingVolume: volume,
      unitPrice: effectiveUnitPrice,
      total: volume * effectiveUnitPrice,
      status: "active",
      scopeType,
      scopeLabel: selectedOption.label,
      createdAt: new Date().toISOString(),
    };
    setLocks((current) => [record, ...current]);
    setWalletBalance((balance) => balance - purchaseTotal);
    }
    setActionBusy(false);
    setNotice(`${volume} ${market.unit} protected at ${money(effectiveUnitPrice, market)}/${market.unit}`);
    setView("tank");
    window.setTimeout(() => setNotice(null), 3200);
  }

  async function redeemFuel(amount: number) {
    const activeLock = locks.find((lock) => lock.remainingVolume >= amount && ["active", "partially_redeemed"].includes(lock.status));
    if (!activeLock) {
      setNotice("No active protection has enough fuel for this redemption.");
      window.setTimeout(() => setNotice(null), 3600);
      return;
    }
    setActionBusy(true);
    if (!userId) {
      const pumpPrice = demoControl.displayUnitPrice + 0.35;
      const covered = Math.max(pumpPrice - activeLock.unitPrice, 0) * amount;
      setLocks((current) => current.map((lock) => lock.id === activeLock.id ? { ...lock, remainingVolume: lock.remainingVolume - amount, status: lock.remainingVolume === amount ? "redeemed" : "partially_redeemed" } : lock));
      setTransactions((current) => [{ id: crypto.randomUUID(), type: "redemption", amount: amount * pumpPrice, volume: amount, unitPrice: pumpPrice, description: `${amount} ${market.unit} redeemed · FuelCap covered ${money(covered, market)}`, createdAt: new Date().toISOString() }, ...current]);
      setShowRedeem(false);
      setNotice(`${amount} ${market.unit} filled at ${money(pumpPrice, market)}/${market.unit}. FuelCap covered ${money(covered, market)}.`);
      setActionBusy(false);
      window.setTimeout(() => setNotice(null), 5000);
      return;
    }
    const { error } = await createClient().rpc("redeem_demo_fuel", {
      p_lock_id: activeLock.id,
      p_volume: amount,
    });
    if (error) {
      setNotice(error.message);
    } else {
      await loadCloudData();
      setShowRedeem(false);
      setNotice(`${amount} ${market.unit} redeemed from your virtual tank.`);
    }
    setActionBusy(false);
    window.setTimeout(() => setNotice(null), 3600);
  }

  return (
    <div className="min-h-dvh bg-[#f3f6f4] md:grid md:grid-cols-[224px_1fr]">
      <aside className="hidden min-h-dvh border-r border-[#dce5df] bg-white px-4 py-5 md:flex md:flex-col">
        <Brand />
        <nav className="mt-10 space-y-1" aria-label="Primary navigation">
          {nav.map((item) => <NavButton key={item.id} item={item} active={view === item.id} onClick={() => setView(item.id)} />)}
        </nav>
        <div className="mt-auto rounded-md border border-[#dce5df] bg-[#f7faf8] p-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#0b7a4b]">
            <ShieldCheck size={16} /> {userId ? "Account synced" : "Sandbox"}
          </div>
          <p className="mt-1 text-xs leading-5 text-[#61716b]">{userId ? "Account data persists securely." : "No real funds or fuel purchases."}</p>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-[#dce5df] bg-white/95 px-4 backdrop-blur md:px-8">
          <div className="md:hidden"><Brand compact /></div>
          <div className="hidden md:block">
            <p className="text-xs font-medium text-[#61716b]">{userId ? "Account synced" : "Personal account"}</p>
            <p className="text-sm font-semibold">Good morning{userEmail ? `, ${userEmail.split("@")[0]}` : ", Francis"}</p>
          </div>
          <div className="flex items-center gap-2">
            <label className="sr-only" htmlFor="market">Market</label>
            <select
              id="market"
              value={marketCode}
              onChange={(event) => changeMarket(event.target.value as MarketCode)}
              className="h-10 rounded-md border border-[#dce5df] bg-white px-2 text-sm font-semibold"
            >
              <option value="US">US</option><option value="CA">Canada</option><option value="GB">UK</option>
            </select>
            <button className="grid size-10 place-items-center rounded-md border border-[#dce5df] bg-white" aria-label="Notifications">
              <Bell size={18} />
            </button>
            <button onClick={() => setShowMenu(true)} className="grid size-10 place-items-center rounded-md bg-[#0b1b2b] text-white" aria-label="Open account menu">
              <Menu size={19} />
            </button>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 pb-28 pt-6 md:px-8 md:pb-10 md:pt-8">
          {marketCode === "US" && <section className={`mb-5 rounded-md border p-4 ${demoControl.quoteAvailability === "PAUSED" ? "border-[#efb0a8] bg-[#fff0ed]" : "border-[#9bc7ad] bg-[#edf8f1]"}`} aria-label="Price protection status" role="status"><div className="flex items-start gap-3"><ShieldCheck className={demoControl.quoteAvailability === "PAUSED" ? "text-[#a83c30]" : "text-[#0b7a4b]"} size={20} /><div className="min-w-0 flex-1"><p className="text-xs font-bold uppercase tracking-wide text-[#61716b]">Price protection service · {bridgeReachable ? "live status" : "last known safe price"}</p><p className="mt-1 font-semibold">{demoControl.customerMessage.replace("Demo control connected · ", "").replace("Admin published a simulated ", "").replace("Admin withdrew ", "")}</p><p className="mt-1 text-xs text-[#61716b]">Your accepted protection at {money(demoControl.acceptedQuote.unitPrice, market)}/{market.unit} remains unchanged.</p></div><span className="rounded-md bg-white px-2 py-1 text-xs font-bold">{demoControl.quoteAvailability}</span></div></section>}
          {view === "home" && <HomeView market={market} tankVolume={tankVolume} walletBalance={walletBalance} customerReady={customerReady || Boolean(userId)} startCustomer={() => setView("onboarding")} saved={saved} nearbyPrices={priceOptions.filter((option) => option.scopeType === "station").sort((a,b) => a.unitPrice-b.unitPrice).slice(0,3)} activeLock={activeLock} referencePrice={controlledReferencePrice} demoPrice={marketCode === "US" ? demoControl.displayUnitPrice : undefined} setView={setView} redeem={() => setShowRedeem(true)} />}
          {view === "onboarding" && <OnboardingView send={sendLifecycle} complete={(customer) => { setLifecycleCustomer(customer); setCustomerReady(true); changeMarket("GB"); setView("wallet"); }} />}
          {view === "wallet" && <WalletView market={market} balance={walletBalance} customer={lifecycleCustomer} addFunds={(amount) => { setCustomerReady(true); setWalletBalance((balance) => balance + amount); void sendLifecycle({ type: "FUND_WALLET", customerId: DEMO_CUSTOMER_ID, amountMinor: Math.round(amount * 100) }); setNotice(`${money(amount, market)} added to your FuelCap wallet.`); window.setTimeout(() => setNotice(null), 3200); }} changePlan={(planId) => void sendLifecycle({ type: "CHANGE_PLAN", customerId: DEMO_CUSTOMER_ID, planId })} setView={setView} />}
          {view === "tank" && <TankView market={market} tankVolume={tankVolume} locks={locks} setView={setView} redeem={() => setShowRedeem(true)} />}
          {view === "lock" && <LockView market={market} volume={volume} setVolume={setVolume} confirm={confirmLock} busy={actionBusy} options={priceOptions} selected={controlledPriceOption} scopeType={scopeType} scopeId={scopeId} changeScope={changeScope} setScopeId={setScopeId} loading={optionsLoading} quotesPaused={marketCode === "US" && demoControl.quoteAvailability === "PAUSED"} priceSource={priceSource} />}
          {view === "activity" && <ActivityView market={market} locks={locks} transactions={transactions} cloud={Boolean(userId)} />}
          {view === "settings" && <SettingsView marketCode={marketCode} changeMarket={changeMarket} />}
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid h-[76px] grid-cols-6 border-t border-[#dce5df] bg-white px-1 pb-[env(safe-area-inset-bottom)] md:hidden" aria-label="Primary navigation">
        {nav.map((item) => {
          const Icon = item.icon;
          return (
            <button key={item.id} onClick={() => setView(item.id)} className={`flex min-w-0 flex-col items-center justify-center gap-1 text-[10px] font-semibold ${view === item.id ? "text-[#0ba75e]" : "text-[#61716b]"}`}>
              <Icon size={20} strokeWidth={view === item.id ? 2.5 : 2} /><span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {notice && <div role="status" className="fixed bottom-24 left-1/2 z-50 w-[calc(100%-32px)] max-w-md -translate-x-1/2 rounded-md bg-[#0b1b2b] px-4 py-3 text-center text-sm font-semibold text-white shadow-xl md:bottom-6">{notice}</div>}
      {showRedeem && <RedeemDialog market={market} volume={tankVolume} busy={actionBusy} redeem={redeemFuel} close={() => setShowRedeem(false)} />}
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
      <span className="font-[family-name:var(--font-space-grotesk)] text-xl font-bold">FuelCap</span>
    </div>
  );
}

function NavButton({ item, active, onClick }: { item: (typeof nav)[number]; active: boolean; onClick: () => void }) {
  const Icon = item.icon;
  return <button onClick={onClick} className={`flex h-11 w-full items-center gap-3 rounded-md px-3 text-sm font-semibold ${active ? "bg-[#dff5e9] text-[#0b7a4b]" : "text-[#61716b] hover:bg-[#f3f6f4]"}`}><Icon size={18} />{item.label}</button>;
}

type MarketProps = { market: (typeof markets)[MarketCode] };

function HomeView({ market, tankVolume, walletBalance, customerReady, startCustomer, saved, nearbyPrices, activeLock, referencePrice, demoPrice, setView, redeem }: MarketProps & { tankVolume: number; walletBalance: number; customerReady: boolean; startCustomer: () => void; saved: number; nearbyPrices: PriceOption[]; activeLock?: LockRecord; referencePrice: number; demoPrice?: number; setView: (view: View) => void; redeem: () => void }) {
  const capPrice = demoPrice ?? activeLock?.unitPrice ?? referencePrice;
  const advantage = Math.max(referencePrice - capPrice, 0);
  return (
    <div className="view-enter">
      {!customerReady && <section className="mb-5 grid gap-5 rounded-lg bg-[#0b1b2b] p-6 text-white md:grid-cols-[1fr_auto] md:items-center"><div><p className="text-xs font-bold uppercase tracking-wide text-[#8fb8a6]">Welcome to FuelCap</p><h1 className="mt-2 text-2xl font-bold">Pay less for fuel with a price you can plan around</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#c7d6ce]">Create your profile, add funds, protect the fuel you expect to use and pay from your virtual tank at participating retailers.</p></div><button type="button" onClick={startCustomer} className={`${buttonBase} bg-[#0ba75e] text-white`}><CircleUserRound size={17} />Create your profile</button></section>}
      <div className="mb-6 flex items-end justify-between gap-4">
        <div><p className="text-sm font-medium text-[#61716b]">Your overview</p><h1 className="font-[family-name:var(--font-space-grotesk)] text-2xl font-bold md:text-3xl">{tankVolume > 0 ? "Your fuel is protected" : "Plan your next fill"}</h1></div>
        <button onClick={() => setView("lock")} className={`${buttonBase} whitespace-nowrap bg-[#0ba75e] text-white hover:bg-[#0b7a4b]`}><LockKeyhole size={17} />Lock price</button>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.3fr_.7fr]">
        <section className="rounded-md bg-[#0b1b2b] p-5 text-white md:p-7">
          <div className="flex items-start justify-between gap-4">
            <div><p className="text-xs font-bold uppercase text-[#8fb8a6]">{activeLock ? "Your FuelCap price" : "Current protection price"}</p><p className="mt-2 font-[family-name:var(--font-space-grotesk)] text-4xl font-bold md:text-5xl" data-testid="headline-unit-price">{money(capPrice, market)}<span className="ml-1 text-base font-medium text-[#8fb8a6]">/{market.unit}</span></p><p className="mt-2 max-w-md text-xs text-[#8fb8a6]">{activeLock?.scopeLabel ?? `Available across eligible ${market.name} stations`}</p></div>
            <span className="rounded-md bg-[#17364a] px-2 py-1 text-xs font-semibold text-[#dff5e9]">Regular</span>
          </div>
          <div className="mt-7 grid grid-cols-2 gap-4 border-t border-[#284052] pt-5">
            <div><p className="text-xs text-[#8fb8a6]">Current open price basis</p><p className="mt-1 text-lg font-semibold">{money(referencePrice, market)}/{market.unit}</p></div>
            <div className="border-l border-[#284052] pl-4"><p className="text-xs text-[#8fb8a6]">Your advantage</p><p className="mt-1 text-lg font-semibold text-[#ffc24b]">+{money(advantage, market)}/{market.unit}</p></div>
          </div>
        </section>
        <section className="rounded-md border border-[#dce5df] bg-white p-5">
          <div className="flex items-center justify-between"><p className="font-semibold">Virtual tank</p><Fuel className="text-[#0ba75e]" size={20} /></div>
          <p className="mt-6 font-[family-name:var(--font-space-grotesk)] text-4xl font-bold">{tankVolume}<span className="ml-1 text-base font-medium text-[#61716b]">{market.unit}</span></p>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#edf2ef]"><div className="h-full w-[62%] bg-[#0ba75e]" /></div>
          <button onClick={redeem} className={`${buttonBase} mt-5 w-full border border-[#0ba75e] text-[#0b7a4b] hover:bg-[#dff5e9]`}><QrCode size={17} />Redeem at pump</button>
        </section>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <Metric icon={WalletCards} label="Available wallet balance" value={money(walletBalance, market)} detail="Ready to protect fuel" />
        <Metric icon={BadgeCheck} label="Saved this year" value={money(saved, market, 0)} detail="18 protected fills" />
        <Metric icon={MapPin} label="Nearby prices" value="24" detail={`Best price ${money(Math.max(referencePrice - 0.28, 0), market)}/${market.unit}`} />
      </div>
      <section className="mt-4 rounded-md border border-[#dce5df] bg-white"><div className="flex items-center justify-between border-b border-[#dce5df] p-4"><div><h2 className="font-semibold">Lowest live prices</h2><p className="text-xs text-[#61716b]">Current published station prices, sorted lowest first</p></div><MapPin size={19} className="text-[#0b7a4b]" /></div><div className="divide-y divide-[#e5ebe7]">{nearbyPrices.map((option,index)=><div key={option.scopeId} className="grid grid-cols-[1fr_auto] gap-3 p-4"><div><p className="font-semibold">{option.label.split(" - ")[0]}</p><p className="text-xs text-[#61716b]">{option.label.split(" - ").slice(1).join(" - ") || option.providerName || "UK Fuel Finder forecourt"}</p></div><div className="text-right"><p className="font-semibold">{money(option.unitPrice, market)}/{market.unit}</p><p className="text-xs text-[#0b7a4b]">{index === 0 ? "Lowest published" : "Available now"}</p></div></div>)}</div></section>
      <section className="mt-4 flex flex-col justify-between gap-4 rounded-md border border-[#efd695] bg-[#fff8e6] p-5 sm:flex-row sm:items-center">
        <div><p className="font-semibold">You have not paid full price in 6 months</p><p className="mt-1 text-sm text-[#735d2c]">Share your scorecard and give friends a better first lock.</p></div>
        <button className={`${buttonBase} shrink-0 bg-[#ffc24b] text-[#0b1b2b] hover:bg-[#f0b337]`}><Gift size={17} />Share scorecard</button>
      </section>
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
  async function verify() { setBusy(true); await send({ type: "START_KYC", customerId: DEMO_CUSTOMER_ID, licenceLast4: "2048" }); setStep("checking"); setBusy(false); window.setTimeout(async () => { const record = await send({ type: "VERIFY_KYC", customerId: DEMO_CUSTOMER_ID }); setCustomer(record); setStep("pin"); }, process.env.NEXT_PUBLIC_FUELCAP_E2E === "true" ? 150 : 10000); }
  async function finish() { if (pin.length !== 4) return; setBusy(true); const record = await send({ type: "SET_PIN", customerId: DEMO_CUSTOMER_ID }); if (record) complete(record); setBusy(false); }
  return <div className="view-enter mx-auto max-w-4xl"><PageTitle eyebrow={`Set up your account · ${step === "profile" ? "1" : step === "licence" ? "2" : step === "checking" ? "3" : "4"} of 4`} title={step === "profile" ? "Choose how you use FuelCap" : step === "licence" ? "Verify your identity" : step === "checking" ? "We are checking your licence" : "Your FuelCap card is ready"} />
    {step === "profile" && <section className="rounded-lg border border-[#dce5df] bg-white p-5 md:p-7"><div className="grid gap-4 sm:grid-cols-3">{servicePlans.map((plan) => <button type="button" key={plan.id} onClick={() => setPlanId(plan.id)} className={`rounded-lg border p-4 text-left ${planId === plan.id ? "border-[#0ba75e] bg-[#edf8f1] ring-2 ring-[#0ba75e]/20" : "border-[#dce5df]"}`}><span className="text-xs font-bold uppercase text-[#0b7a4b]">{plan.name}</span><strong className="mt-2 block text-xl">{plan.monthlyFeeMinor ? `£${(plan.monthlyFeeMinor / 100).toFixed(2)}` : "Free"}<small className="text-xs font-normal text-[#61716b]"> / month</small></strong><span className="mt-2 block text-xs text-[#61716b]">Up to £{plan.walletLimitMinor / 100} · {plan.stationScope.toLowerCase()} protection</span></button>)}</div><div className="mt-6 grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold">Full name<input aria-label="Full name" value={name} onChange={(e) => setName(e.target.value)} className="mt-2 h-11 w-full rounded-md border border-[#cdd9d1] px-3 font-normal" /></label><label className="text-sm font-semibold">Mobile number<input aria-label="Mobile number" value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-2 h-11 w-full rounded-md border border-[#cdd9d1] px-3 font-normal" /></label><label className="text-sm font-semibold sm:col-span-2">Email address<input aria-label="Email address" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-2 h-11 w-full rounded-md border border-[#cdd9d1] px-3 font-normal" /></label></div><button type="button" disabled={busy || !name || !email || !phone} onClick={() => void register()} className={`${buttonBase} mt-6 w-full bg-[#0ba75e] text-white`}>{busy ? "Creating account..." : "Continue to identity check"}</button></section>}
    {step === "licence" && <section className="rounded-lg border border-[#dce5df] bg-white p-6 text-center"><div className="mx-auto grid size-14 place-items-center rounded-full bg-[#dff5e9] text-[#0b7a4b]"><BadgeCheck size={28}/></div><h2 className="mt-4 text-xl font-bold">Add your driving licence</h2><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[#61716b]">Take a clear photo on your phone. We use it to confirm your identity before activating your wallet and card.</p><label className="mx-auto mt-6 block max-w-md rounded-lg border-2 border-dashed border-[#9bc7ad] bg-[#f4fbf7] p-7 font-semibold text-[#0b7a4b]">{licenceName || "Take or choose licence photo"}<input aria-label="Driving licence photo" className="sr-only" type="file" accept="image/*" capture="environment" onChange={(event) => setLicenceName(event.target.files?.[0]?.name ?? "licence.jpg")}/></label><button type="button" disabled={!licenceName || busy} onClick={() => void verify()} className={`${buttonBase} mt-5 w-full max-w-md bg-[#0ba75e] text-white`}>Submit for verification</button></section>}
    {step === "checking" && <section role="status" className="rounded-lg border border-[#efd695] bg-[#fff8e6] p-8 text-center"><div className="mx-auto size-12 animate-spin rounded-full border-4 border-[#eadba9] border-t-[#0b7a4b]"/><h2 className="mt-5 text-xl font-bold">Verification in progress</h2><p className="mt-2 text-sm text-[#735d2c]">Your customer record is already visible to the operations team. This demonstration completes the identity check in about 10 seconds.</p></section>}
    {step === "pin" && <section className="rounded-lg border border-[#9bc7ad] bg-white p-6"><div className="flex items-start gap-3 rounded-md bg-[#edf8f1] p-4 text-[#0b7a4b]"><BadgeCheck size={22}/><div><strong className="block">Identity verified</strong><span className="text-sm">Your virtual card was issued automatically.</span></div></div><div className="mt-5 rounded-md bg-[#0b1b2b] p-5 text-white"><span className="text-xs uppercase text-[#8fb8a6]">FuelCap virtual card</span><p className="mt-5 text-xl tracking-[.12em]">{customer?.card.maskedPan}</p><p className="mt-3 text-sm text-[#8fb8a6]">Expires {customer?.card.expiry}</p></div><label className="mt-5 block text-sm font-semibold">Choose a 4-digit PIN<input aria-label="Card PIN" inputMode="numeric" maxLength={4} type="password" value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, ""))} className="mt-2 h-12 w-full rounded-md border border-[#cdd9d1] px-3 text-center text-xl tracking-[.5em]" /></label><button type="button" disabled={pin.length !== 4 || busy} onClick={() => void finish()} className={`${buttonBase} mt-5 w-full bg-[#0ba75e] text-white`}>Open my wallet</button></section>}
  </div>;
}

function WalletView({ market, balance, customer, addFunds, changePlan, setView }: MarketProps & { balance: number; customer: LifecycleCustomer | null; addFunds: (amount: number) => void; changePlan: (planId: PlanId) => void; setView: (view: View) => void }) {
  return <div className="view-enter"><PageTitle eyebrow="Money" title="FuelCap wallet" />
    <section className="grid gap-5 rounded-lg bg-[#0b1b2b] p-6 text-white md:grid-cols-[1fr_auto] md:items-center"><div><p className="text-sm text-[#8fb8a6]">Available to protect fuel</p><p className="mt-2 text-5xl font-bold">{money(balance, market)}</p><p className="mt-3 text-sm text-[#c7d6ce]">Wallet funds remain visible as cash until you use them to protect a chosen fuel volume.</p></div><WalletCards size={42} className="text-[#65d49a]" /></section>
    <section className="mt-5 rounded-lg border border-[#dce5df] bg-white p-5"><h2 className="font-semibold">Add funds</h2><p className="mt-1 text-sm text-[#61716b]">Choose an amount using your saved payment method ending 4242.</p><div className="mt-4 grid grid-cols-3 gap-2">{[100,250,500].map((amount) => <button type="button" key={amount} onClick={() => addFunds(amount)} className="h-12 rounded-md border border-[#b8d6c3] bg-[#edf8f1] font-semibold text-[#0b7a4b]">+{money(amount, market, 0)}</button>)}</div><button type="button" disabled={balance <= 0} onClick={() => setView("lock")} className={`${buttonBase} mt-5 w-full bg-[#0ba75e] text-white`}><LockKeyhole size={17} />Choose fuel protection</button></section>
    <section className="mt-5 rounded-lg border border-[#dce5df] bg-white p-5"><div className="flex items-center gap-3"><CircleDollarSign className="text-[#0b7a4b]" /><div><h2 className="font-semibold">How your money moves</h2><p className="text-sm text-[#61716b]">Available cash → protected fuel → retailer settlement. Every step remains visible in Activity.</p></div></div></section>
    {customer && <section className="mt-5 rounded-lg border border-[#dce5df] bg-white p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase text-[#0b7a4b]">Your {customer.planId.toLowerCase()} plan</p><h2 className="mt-1 font-semibold">Need broader price protection?</h2><p className="mt-1 text-sm text-[#61716b]">Change plan at any time. Limits and eligible station coverage update immediately.</p></div><BadgeCheck className="text-[#0b7a4b]"/></div><div className="mt-4 grid grid-cols-3 gap-2">{servicePlans.map((plan) => <button type="button" key={plan.id} disabled={customer.planId === plan.id} onClick={() => changePlan(plan.id)} className={`rounded-md border px-2 py-3 text-sm font-semibold ${customer.planId === plan.id ? "border-[#0ba75e] bg-[#dff5e9] text-[#0b7a4b]" : "border-[#dce5df]"}`}>{plan.name}<span className="block text-[10px] font-normal">{plan.monthlyFeeMinor ? `£${(plan.monthlyFeeMinor / 100).toFixed(2)}/mo` : "Free"}</span></button>)}</div></section>}
  </div>;
}

function Metric({ icon: Icon, label, value, detail }: { icon: typeof Home; label: string; value: string; detail: string }) {
  return <div className="rounded-md border border-[#dce5df] bg-white p-4"><div className="flex items-center gap-2 text-sm font-medium text-[#61716b]"><Icon size={17} className="text-[#0b7a4b]" />{label}</div><p className="mt-3 text-2xl font-bold">{value}</p><p className="mt-1 text-xs text-[#61716b]">{detail}</p></div>;
}

function TankView({ market, tankVolume, locks, setView, redeem }: MarketProps & { tankVolume: number; locks: LockRecord[]; setView: (view: View) => void; redeem: () => void }) {
  return <div className="view-enter"><PageTitle eyebrow="Balance" title="My virtual tank" />
    <section className="grid gap-5 rounded-md bg-[#0b1b2b] p-6 text-white md:grid-cols-[1fr_auto] md:items-center">
      <div><p className="text-sm text-[#8fb8a6]">Available regular {market.fuelWord}</p><p className="mt-2 font-[family-name:var(--font-space-grotesk)] text-5xl font-bold">{tankVolume} <span className="text-xl text-[#8fb8a6]">{market.unit}</span></p><p className="mt-3 text-sm text-[#c7d6ce]">{locks[0] ? `${locks[0].scopeLabel} at ${money(locks[0].unitPrice, market)}/${market.unit}` : "Create a price lock to protect your first fill."}</p></div>
      <div className="flex gap-2"><button onClick={() => setView("lock")} className={`${buttonBase} bg-[#0ba75e] text-white`}><LockKeyhole size={17} />Add fuel</button><button onClick={redeem} className={`${buttonBase} border border-[#476070] text-white`}><QrCode size={17} />Redeem</button></div>
    </section>
    <section className="mt-5 rounded-md border border-[#dce5df] bg-white"><div className="border-b border-[#dce5df] p-4"><h2 className="font-semibold">Active price locks</h2></div>
      {locks.length === 0 ? <EmptyState icon={LockKeyhole} title="No additional locks yet" text="Your starter tank is ready. Add a simulated lock to test the full flow." action={() => setView("lock")} /> :
        <div className="divide-y divide-[#e5ebe7]">{locks.map((lock) => <div key={lock.id} className="flex items-center justify-between gap-4 p-4"><div><p className="font-semibold">{lock.remainingVolume} of {lock.volume} {market.unit} remaining</p><p className="text-xs text-[#61716b]">{new Date(lock.createdAt).toLocaleString(market.locale)}</p></div><div className="text-right"><p className="font-semibold">{money(lock.unitPrice, market)}/{market.unit}</p><p className="text-xs capitalize text-[#0b7a4b]">{lock.status.replace("_", " ")}</p></div></div>)}</div>}
    </section>
  </div>;
}

function LockView({
  market, volume, setVolume, confirm, busy, options, selected, scopeType,
  scopeId, changeScope, setScopeId, loading, quotesPaused, priceSource,
}: MarketProps & {
  volume: number;
  setVolume: (n: number) => void;
  confirm: () => Promise<void>;
  busy: boolean;
  options: PriceOption[];
  selected: PriceOption | undefined;
  scopeType: LockScope;
  scopeId: string | null;
  changeScope: (scope: LockScope) => void;
  setScopeId: (id: string | null) => void;
  loading: boolean;
  quotesPaused: boolean;
  priceSource: string;
}) {
  const scopedOptions = options.filter((option) => option.scopeType === scopeType);
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
  const query = searchQuery.trim().toLocaleLowerCase();
  const searchResults = scopedOptions.filter((option) => !query || `${option.label} ${option.providerName ?? ""}`.toLocaleLowerCase().includes(query)).map((option) => ({ option, distance: distance(option) })).sort((a, b) => location ? (a.distance ?? Number.MAX_VALUE) - (b.distance ?? Number.MAX_VALUE) : a.option.label.localeCompare(b.option.label)).slice(0, 12);
  const locate = () => {
    setLocationState("locating");
    navigator.geolocation.getCurrentPosition(({ coords }) => { setLocation({ latitude: coords.latitude, longitude: coords.longitude }); setLocationState("idle"); }, () => setLocationState("denied"), { timeout: 10_000, maximumAge: 300_000 });
  };
  const quotePrice = selected?.unitPrice ?? 0;
  const total = volume * quotePrice;
  const priceLabel = scopeType === "station" ? "Current station price" : scopeType === "provider" ? "Current provider maximum" : "Current open maximum";
  const scopeCopy = scopeType === "station"
    ? "This cap can be redeemed only at the selected filling station."
    : scopeType === "provider"
      ? `This cap works at ${selected?.stationCount ?? 0} covered ${selected?.label ?? "provider"} stations.`
      : `This cap works at ${selected?.stationCount ?? 0} eligible stations across ${market.name}.`;
  return <div className="view-enter mx-auto max-w-3xl"><PageTitle eyebrow="New price lock" title={`Lock today's ${market.fuelWord} price`} />
    <section className="rounded-md border border-[#dce5df] bg-white p-5 md:p-7">
      <fieldset>
        <legend className="text-sm font-semibold">Where do you want your cap to work?</legend>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {([
            ["station", "Station"],
            ["provider", "Brand"],
            ["country", "Anywhere"],
          ] as [LockScope, string][]).map(([scope, label]) => (
            <button type="button" key={scope} aria-label={scope === "station" ? "One station" : scope === "provider" ? "One brand" : "Anywhere"} onClick={() => changeScope(scope)} className={`h-11 rounded-md border px-2 text-sm font-semibold ${scopeType === scope ? "border-[#0ba75e] bg-[#dff5e9] text-[#0b7a4b]" : "border-[#dce5df] bg-white"}`}>{label}</button>
          ))}
        </div>
      </fieldset>

      {scopeType !== "country" && <><div className="mt-5">
        <label htmlFor="scope-search" className="text-sm font-semibold">{scopeType === "station" ? "Find a filling station" : "Find a fuel brand"}</label>
        <div className="mt-2 flex gap-2"><div className="relative min-w-0 flex-1"><Search aria-hidden="true" size={18} className="absolute left-3 top-3.5 text-[#61716b]"/><input id="scope-search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} disabled={loading} placeholder={scopeType === "station" ? "Station, postcode, town or city" : "Search brands or operators"} className="h-12 w-full rounded-md border border-[#cdd9d1] bg-white pl-10 pr-3 text-sm" /></div>{scopeType === "station" && <button type="button" onClick={locate} disabled={locationState === "locating"} className="inline-flex h-12 items-center gap-2 rounded-md border border-[#cdd9d1] px-3 text-sm font-semibold"><LocateFixed size={17}/><span className="hidden sm:inline">{locationState === "locating" ? "Locating…" : location ? "Nearest" : "Near me"}</span></button>}</div>
        {locationState === "denied" && <p className="mt-2 text-xs text-[#9a4b32]">Location was unavailable. Search by postcode, town, city or station name instead.</p>}
        <div className="mt-2 max-h-80 overflow-y-auto rounded-md border border-[#dce5df]" role="listbox" aria-label={scopeType === "station" ? "Matching filling stations" : "Matching fuel brands"}>
          {searchResults.map(({ option, distance: miles }) => <button type="button" role="option" aria-selected={scopeId === option.scopeId} key={option.scopeId} onClick={() => setScopeId(option.scopeId)} className={`grid w-full grid-cols-[1fr_auto] gap-3 border-b border-[#edf1ee] p-3 text-left last:border-0 ${scopeId === option.scopeId ? "bg-[#e7f7ee]" : "bg-white hover:bg-[#f6faf7]"}`}><span className="min-w-0"><strong className="block truncate text-sm">{option.label.split(" - ")[0]}</strong><small className="mt-1 block truncate text-[#61716b]">{scopeType === "station" ? option.label.split(" - ").slice(1).join(" - ") || option.providerName : `${option.stationCount} covered stations`}</small></span><span className="text-right"><strong className="block text-sm">{money(option.unitPrice, market)}/{market.unit}</strong>{miles != null && <small className="mt-1 block text-[#0b7a4b]">{miles < 10 ? miles.toFixed(1) : Math.round(miles)} miles</small>}</span></button>)}
          {!loading && searchResults.length === 0 && <p className="p-4 text-sm text-[#61716b]">No matches. Try a shorter station, postcode, town, city or brand name.</p>}
        </div>
        <p className="mt-2 text-xs text-[#61716b]">Showing {searchResults.length} of {scopedOptions.length.toLocaleString()} matches{location ? " · nearest first" : ""}.</p>
      </div><div className="hidden">
        <label htmlFor="scope-option" className="text-sm font-semibold">{scopeType === "station" ? "Choose a filling station" : "Choose a fuel brand"}</label>
        <select id="scope-option" value={scopeId ?? ""} onChange={(event) => setScopeId(event.target.value)} disabled={loading} className="mt-2 h-12 w-full rounded-md border border-[#cdd9d1] bg-white px-3 text-sm">
          {scopedOptions.map((option) => <option key={option.scopeId} value={option.scopeId ?? ""}>{option.label} · {money(option.unitPrice, market)}/{market.unit}</option>)}
        </select>
      </div></>}

      <div className="mt-5 flex items-start justify-between gap-4 border-y border-[#e5ebe7] py-5">
        <div>
          <p className="text-sm text-[#61716b]">{priceLabel}</p>
          <p className="mt-1 font-[family-name:var(--font-space-grotesk)] text-3xl font-bold">{loading || !selected ? "Loading..." : money(quotePrice, market)}{selected && <span className="text-sm font-medium text-[#61716b]">/{market.unit}</span>}</p>
          <p className="mt-2 max-w-md text-xs leading-5 text-[#61716b]">{selected?.label ?? "Retrieving verified station prices"}</p>
          {scopeType === "station" && selected?.latitude != null && selected.longitude != null && <a className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[#0b7a4b]" href={`https://www.openstreetmap.org/?mlat=${selected.latitude}&mlon=${selected.longitude}#map=16/${selected.latitude}/${selected.longitude}`} target="_blank" rel="noreferrer">View on map <ExternalLink size={13}/></a>}
          {scopeType === "country" && selected?.referenceStationLabel && <p className="mt-2 max-w-md text-xs leading-5 text-[#61716b]">Maximum published price from {selected.referenceStationLabel} · observed {new Date(selected.observedAt).toLocaleString(market.locale)}.</p>}
        </div>
        <span className="shrink-0 rounded-md bg-[#dff5e9] px-3 py-2 text-xs font-bold text-[#0b7a4b]">{scopeType === "station" ? "1 station" : `${selected?.stationCount ?? 0} stations`}</span>
      </div>
      <div className="mt-4 flex items-start gap-2 text-xs leading-5 text-[#61716b]"><MapPin size={15} className="mt-0.5 shrink-0 text-[#0b7a4b]" /><p>{scopeCopy} Source: <strong>{priceSource}</strong>. Published prices may differ from the forecourt display after a recent update.</p></div>

      <div className="py-6"><div className="flex items-center justify-between"><label htmlFor="volume" className="font-semibold">How much to lock?</label><output className="text-xl font-bold">{volume} {market.unit}</output></div>
        <input id="volume" className="mt-5 w-full accent-[#0ba75e]" type="range" min={market.unit === "gal" ? 10 : 40} max={market.maxVolume} step={market.unit === "gal" ? 5 : 10} value={volume} onChange={(e) => setVolume(Number(e.target.value))} />
        <div className="mt-2 flex justify-between text-xs text-[#61716b]"><span>{market.unit === "gal" ? 10 : 40} {market.unit}</span><span>{market.maxVolume} {market.unit}</span></div>
      </div>
      <div className="rounded-md bg-[#dff5e9] p-4"><div className="flex gap-3"><ShieldCheck className="shrink-0 text-[#0b7a4b]" size={21} /><div><p className="font-semibold text-[#0b7a4b]">FuelCap protection</p><p className="mt-1 text-sm leading-6 text-[#285e46]">If the reference price rises, this price stays capped. If it falls below your lock, the demo balance adjusts automatically.</p></div></div></div>
      <div className="mt-6 flex items-center justify-between gap-4 border-t border-[#e5ebe7] pt-5"><div><p className="text-xs text-[#61716b]">Simulated total</p><p className="text-2xl font-bold">{money(total, market)}</p></div><button aria-label="Confirm price lock" disabled={busy || loading || !selected || quotesPaused} onClick={confirm} className={`${buttonBase} h-12 bg-[#0ba75e] px-6 text-white hover:bg-[#0b7a4b]`}><LockKeyhole size={18} />{busy ? "Saving..." : quotesPaused ? "New quotes paused" : "Confirm lock"}</button></div>
    </section>
    <p className="mt-4 text-center text-xs leading-5 text-[#61716b]">Prototype only. No payment is taken and no fuel is purchased.</p>
  </div>;
}

function ActivityView({ market, locks, transactions, cloud }: MarketProps & { locks: LockRecord[]; transactions: TransactionRecord[]; cloud: boolean }) {
  const rows = useMemo(() => cloud ? transactions.map((transaction) => ({
    id: transaction.id,
    icon: transaction.type === "redemption" ? Fuel : transaction.type === "lock" ? LockKeyhole : BadgeCheck,
    title: transaction.description,
    detail: transaction.volume === null ? transaction.type : `${transaction.volume} ${market.unit}${transaction.unitPrice === null ? "" : ` at ${money(transaction.unitPrice, market)}/${market.unit}`}`,
    amount: money(transaction.amount, market),
    date: new Date(transaction.createdAt),
  })) : [
    ...locks.map((lock) => ({ id: lock.id, icon: LockKeyhole, title: `Locked ${lock.volume} ${market.unit}`, detail: `${money(lock.unitPrice, market)}/${market.unit}`, amount: money(lock.total, market), date: new Date(lock.createdAt) })),
    { id: "refund", icon: BadgeCheck, title: "Price-drop adjustment", detail: "Reference price decreased", amount: `+${money(market.unit === "gal" ? 11.6 : 8.4, market)}`, date: new Date(DEMO_NOW - 86400000 * 2) },
    { id: "fill", icon: Fuel, title: "Pump redemption", detail: `18 ${market.unit} regular`, amount: `-${money(18 * market.lockedPrice, market)}`, date: new Date(DEMO_NOW - 86400000 * 5) },
  ], [cloud, locks, market, transactions]);
  return <div className="view-enter"><PageTitle eyebrow="Account" title="Activity" /><section className="overflow-hidden rounded-md border border-[#dce5df] bg-white"><div className="flex items-center justify-between border-b border-[#dce5df] p-4"><h2 className="font-semibold">Recent transactions</h2><button aria-label="Filter activity" className="grid size-9 place-items-center rounded-md border border-[#dce5df]"><SlidersHorizontal size={17} /></button></div>
    <div className="divide-y divide-[#e5ebe7]">{rows.map((row) => { const Icon = row.icon; return <div key={row.id} className="grid grid-cols-[40px_1fr_auto] items-center gap-3 p-4"><div className="grid size-10 place-items-center rounded-md bg-[#edf7f1] text-[#0b7a4b]"><Icon size={18} /></div><div><p className="text-sm font-semibold">{row.title}</p><p className="mt-0.5 text-xs text-[#61716b]">{row.detail} · {row.date.toLocaleDateString(market.locale)}</p></div><p className="text-sm font-semibold">{row.amount}</p></div>; })}</div>
  </section></div>;
}

function SettingsView({ marketCode, changeMarket }: { marketCode: MarketCode; changeMarket: (code: MarketCode) => void }) {
  return <div className="view-enter"><PageTitle eyebrow="Preferences" title="Settings" /><div className="grid gap-4 lg:grid-cols-2">
    <section className="rounded-md border border-[#dce5df] bg-white p-5"><div className="flex items-center gap-3"><CircleUserRound size={22} className="text-[#0b7a4b]" /><div><h2 className="font-semibold">Customer profile</h2><p className="text-sm text-[#61716b]">Francis · FuelCap member</p></div></div><button className={`${buttonBase} mt-5 w-full border border-[#dce5df]`}><WalletCards size={17} />Manage payment method</button></section>
    <section className="rounded-md border border-[#dce5df] bg-white p-5"><h2 className="font-semibold">Market and units</h2><p className="mt-1 text-sm text-[#61716b]">Prices and volumes follow the selected market.</p><div className="mt-4 grid grid-cols-3 gap-2">{(Object.keys(markets) as MarketCode[]).map((code) => <button key={code} onClick={() => changeMarket(code)} className={`h-10 rounded-md border text-sm font-semibold ${marketCode === code ? "border-[#0ba75e] bg-[#dff5e9] text-[#0b7a4b]" : "border-[#dce5df]"}`}>{code === "GB" ? "UK" : code}</button>)}</div></section>
  </div></div>;
}

function PageTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return <div className="mb-6"><p className="text-sm font-medium text-[#61716b]">{eyebrow}</p><h1 className="font-[family-name:var(--font-space-grotesk)] text-2xl font-bold md:text-3xl">{title}</h1></div>;
}

function EmptyState({ icon: Icon, title, text, action }: { icon: typeof Home; title: string; text: string; action: () => void }) {
  return <div className="flex flex-col items-center px-5 py-10 text-center"><div className="grid size-11 place-items-center rounded-md bg-[#dff5e9] text-[#0b7a4b]"><Icon size={21} /></div><p className="mt-3 font-semibold">{title}</p><p className="mt-1 max-w-sm text-sm text-[#61716b]">{text}</p><button onClick={action} className={`${buttonBase} mt-4 bg-[#0ba75e] text-white`}>Protect fuel</button></div>;
}

function RedeemDialog({ market, volume, busy, redeem, close }: MarketProps & { volume: number; busy: boolean; redeem: (amount: number) => Promise<void>; close: () => void }) {
  const redeemVolume = market.unit === "gal" ? 10 : 20;
  return <div role="dialog" aria-modal="true" aria-labelledby="redeem-title" className="fixed inset-0 z-50 grid place-items-end bg-[#0b1b2b]/55 p-0 sm:place-items-center sm:p-4"><div className="w-full max-w-md rounded-t-lg bg-white p-5 shadow-2xl sm:rounded-lg">
    <div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase text-[#0b7a4b]">Retailer payment</p><h2 id="redeem-title" className="text-xl font-bold">Pay with your tank</h2></div><button onClick={close} className="grid size-9 place-items-center rounded-md border border-[#dce5df]" aria-label="Close"><X size={18} /></button></div>
    <div className="mx-auto mt-6 w-fit rounded-md border border-[#dce5df] bg-white p-4"><QRCodeSVG value={`fuelcap-demo:${market.code}:${volume}:842119`} size={210} fgColor="#0b1b2b" /></div>
    <p className="mt-5 text-center font-semibold">{volume} {market.unit} available</p><p className="mt-1 text-center text-sm text-[#61716b]">Show this code to the retailer, who confirms the quantity dispensed.</p>
    <button disabled={busy || volume < redeemVolume} onClick={() => redeem(redeemVolume)} className={`${buttonBase} mt-5 w-full bg-[#0ba75e] text-white`}>{busy ? "Completing fill..." : `Retailer confirms ${redeemVolume} ${market.unit}`}</button>
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
    <div className="mt-8 flex items-center gap-3 rounded-md bg-[#f3f6f4] p-4"><CircleUserRound size={32} className="text-[#0b7a4b]" /><div className="min-w-0"><p className="font-semibold">{email ? "FuelCap member" : "Customer account"}</p><p className="truncate text-xs text-[#61716b]">{email ?? "Local sandbox profile"}</p></div></div>
    <div className="mt-5 space-y-1"><MenuRow icon={ReceiptText} label="Statements" /><MenuRow icon={ShieldCheck} label="Protection details" /><MenuRow icon={Bell} label="Notifications" /></div>
    {email ? <button onClick={signOut} className={`${buttonBase} mt-8 w-full border border-[#dce5df] text-[#b0382b]`}><LogOut size={17} />Sign out</button> :
      <button onClick={openAuth} className={`${buttonBase} mt-8 w-full bg-[#0ba75e] text-white`}><CircleUserRound size={17} />Create account or sign in</button>}
  </div></div>;
}

function MenuRow({ icon: Icon, label }: { icon: typeof Home; label: string }) {
  return <button className="flex h-12 w-full items-center gap-3 rounded-md px-3 text-sm font-semibold hover:bg-[#f3f6f4]"><Icon size={18} className="text-[#61716b]" />{label}<ChevronRight size={16} className="ml-auto text-[#61716b]" /></button>;
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
