"use client";

import Image from "next/image";
import {
  Activity, BadgeCheck, Bell, ChevronRight, CircleUserRound, Fuel,
  Gift, Home, LockKeyhole, LogOut, MapPin, Menu, QrCode, ReceiptText,
  Settings, ShieldCheck, SlidersHorizontal, WalletCards, X,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { demoLockedPrice, MarketCode, markets, money } from "@/lib/markets";
import { createClient } from "@/lib/supabase/client";
import { initialDemoControlSnapshot, type DemoControlSnapshot } from "@fuelcap/demo-control";

type View = "home" | "tank" | "lock" | "activity" | "settings";
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
  { id: "tank", label: "My tank", icon: Fuel },
  { id: "lock", label: "Lock price", icon: LockKeyhole },
  { id: "activity", label: "Activity", icon: Activity },
  { id: "settings", label: "Settings", icon: Settings },
];

const buttonBase =
  "inline-flex h-11 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";
const DEMO_NOW = Date.UTC(2026, 6, 24, 12);

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
  const [scopeType, setScopeType] = useState<LockScope>("station");
  const [scopeId, setScopeId] = useState<string | null>(null);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [demoControl, setDemoControl] = useState<DemoControlSnapshot>(initialDemoControlSnapshot);
  const [bridgeReachable, setBridgeReachable] = useState(false);
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
    const supabase = createClient();
    void supabase.rpc("get_current_lock_options", {
      p_market: marketCode,
      p_fuel_grade: "regular",
    }).then(({ data }) => {
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
      setPriceOptions(options);
      const first = options.find((option) => option.scopeType === "station");
      setScopeType("station");
      setScopeId(first?.scopeId ?? null);
      setOptionsLoading(false);
    });
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

  const tankVolume = (userId ? 0 : market.defaultVolume) + locks.reduce((sum, item) => sum + item.remainingVolume, 0);
  const saved = market.code === "US" ? 142 : market.code === "CA" ? 96 : 71;
  const selectedPriceOption = priceOptions.find((option) =>
    option.scopeType === scopeType && (scopeType === "country" || option.scopeId === scopeId));
  const currentOpenOption = priceOptions.find((option) => option.scopeType === "country");
  const controlledPriceOption = selectedPriceOption && marketCode === "US" ? { ...selectedPriceOption, unitPrice: demoControl.displayUnitPrice, observedAt: demoControl.updatedAt } : selectedPriceOption;
  const controlledReferencePrice = marketCode === "US" ? demoControl.displayUnitPrice : currentOpenOption?.unitPrice ?? market.livePrice;
  const activeLock = locks.find((lock) => ["active", "partially_redeemed"].includes(lock.status));

  function changeMarket(code: MarketCode) {
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
      unitPrice: selectedOption.unitPrice,
      total: volume * selectedOption.unitPrice,
      status: "active",
      scopeType,
      scopeLabel: selectedOption.label,
      createdAt: new Date().toISOString(),
    };
    setLocks((current) => [record, ...current]);
    }
    setActionBusy(false);
    setNotice(`${volume} ${market.unit} locked at ${money(selectedOption.unitPrice, market)}/${market.unit}`);
    setView("tank");
    window.setTimeout(() => setNotice(null), 3200);
  }

  async function redeemFuel(amount: number) {
    const activeLock = locks.find((lock) => lock.remainingVolume >= amount && ["active", "partially_redeemed"].includes(lock.status));
    if (!userId || !activeLock) {
      setNotice(userId ? "No active lock has enough fuel for this redemption." : "Sign in to persist a pump redemption.");
      window.setTimeout(() => setNotice(null), 3600);
      return;
    }
    setActionBusy(true);
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
            <ShieldCheck size={16} /> {userId ? "Supabase synced" : "Demo environment"}
          </div>
          <p className="mt-1 text-xs leading-5 text-[#61716b]">{userId ? "Account data persists securely." : "No real funds or fuel purchases."}</p>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-[#dce5df] bg-white/95 px-4 backdrop-blur md:px-8">
          <div className="md:hidden"><Brand compact /></div>
          <div className="hidden md:block">
            <p className="text-xs font-medium text-[#61716b]">{userId ? "Synced prototype" : "Prototype account"}</p>
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
          {marketCode === "US" && <section className={`mb-5 rounded-md border p-4 ${demoControl.quoteAvailability === "PAUSED" ? "border-[#efb0a8] bg-[#fff0ed]" : "border-[#9bc7ad] bg-[#edf8f1]"}`} aria-label="Admin demo control status" role="status"><div className="flex items-start gap-3"><ShieldCheck className={demoControl.quoteAvailability === "PAUSED" ? "text-[#a83c30]" : "text-[#0b7a4b]"} size={20} /><div className="min-w-0 flex-1"><p className="text-xs font-bold uppercase tracking-wide text-[#61716b]">Admin-controlled demonstration · {bridgeReachable ? "connected" : "safe baseline"}</p><p className="mt-1 font-semibold">{demoControl.customerMessage}</p><p className="mt-1 text-xs text-[#61716b]">{demoControl.correlationId} · {demoControl.decisionId} · accepted {demoControl.acceptedQuote.quoteId} at {money(demoControl.acceptedQuote.unitPrice, market)} preserved</p></div><span className="rounded-md bg-white px-2 py-1 text-xs font-bold">{demoControl.quoteAvailability}</span></div></section>}
          {view === "home" && <HomeView market={market} tankVolume={tankVolume} saved={saved} activeLock={activeLock} referencePrice={controlledReferencePrice} demoPrice={marketCode === "US" ? demoControl.displayUnitPrice : undefined} setView={setView} redeem={() => setShowRedeem(true)} />}
          {view === "tank" && <TankView market={market} tankVolume={tankVolume} locks={locks} setView={setView} redeem={() => setShowRedeem(true)} />}
          {view === "lock" && <LockView market={market} volume={volume} setVolume={setVolume} confirm={confirmLock} busy={actionBusy} options={priceOptions} selected={controlledPriceOption} scopeType={scopeType} scopeId={scopeId} changeScope={changeScope} setScopeId={setScopeId} loading={optionsLoading} quotesPaused={marketCode === "US" && demoControl.quoteAvailability === "PAUSED"} />}
          {view === "activity" && <ActivityView market={market} locks={locks} transactions={transactions} cloud={Boolean(userId)} />}
          {view === "settings" && <SettingsView marketCode={marketCode} changeMarket={changeMarket} />}
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid h-[76px] grid-cols-5 border-t border-[#dce5df] bg-white px-1 pb-[env(safe-area-inset-bottom)] md:hidden" aria-label="Primary navigation">
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
      {showRedeem && <RedeemDialog market={market} volume={tankVolume} cloud={Boolean(userId)} busy={actionBusy} redeem={redeemFuel} close={() => setShowRedeem(false)} />}
      {showMenu && <AccountMenu email={userEmail} close={() => setShowMenu(false)} openAuth={() => { setShowMenu(false); setShowAuth(true); }} />}
      {showAuth && <AuthDialog close={() => setShowAuth(false)} />}
      {syncing && <div role="status" className="fixed right-4 top-20 z-40 rounded-md border border-[#dce5df] bg-white px-3 py-2 text-xs font-semibold shadow-sm">Syncing account...</div>}
    </div>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <Image src="/fuelcap-mark.svg" alt="" width={compact ? 27 : 32} height={compact ? 27 : 32} />
      <span className="font-[family-name:var(--font-space-grotesk)] text-xl font-bold">FuelCap</span>
    </div>
  );
}

function NavButton({ item, active, onClick }: { item: (typeof nav)[number]; active: boolean; onClick: () => void }) {
  const Icon = item.icon;
  return <button onClick={onClick} className={`flex h-11 w-full items-center gap-3 rounded-md px-3 text-sm font-semibold ${active ? "bg-[#dff5e9] text-[#0b7a4b]" : "text-[#61716b] hover:bg-[#f3f6f4]"}`}><Icon size={18} />{item.label}</button>;
}

type MarketProps = { market: (typeof markets)[MarketCode] };

function HomeView({ market, tankVolume, saved, activeLock, referencePrice, demoPrice, setView, redeem }: MarketProps & { tankVolume: number; saved: number; activeLock?: LockRecord; referencePrice: number; demoPrice?: number; setView: (view: View) => void; redeem: () => void }) {
  const capPrice = demoPrice ?? activeLock?.unitPrice ?? referencePrice;
  const advantage = Math.max(referencePrice - capPrice, 0);
  return (
    <div className="view-enter">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div><p className="text-sm font-medium text-[#61716b]">Your overview</p><h1 className="font-[family-name:var(--font-space-grotesk)] text-2xl font-bold md:text-3xl">Your fuel is protected</h1></div>
        <button onClick={() => setView("lock")} className={`${buttonBase} whitespace-nowrap bg-[#0ba75e] text-white hover:bg-[#0b7a4b]`}><LockKeyhole size={17} />Lock price</button>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.3fr_.7fr]">
        <section className="rounded-md bg-[#0b1b2b] p-5 text-white md:p-7">
          <div className="flex items-start justify-between gap-4">
            <div><p className="text-xs font-bold uppercase text-[#8fb8a6]">{demoPrice !== undefined ? "Admin-controlled demo price" : activeLock ? "Your FuelCap price" : "Current open price"}</p><p className="mt-2 font-[family-name:var(--font-space-grotesk)] text-4xl font-bold md:text-5xl" data-testid="headline-unit-price">{money(capPrice, market)}<span className="ml-1 text-base font-medium text-[#8fb8a6]">/{market.unit}</span></p><p className="mt-2 max-w-md text-xs text-[#8fb8a6]">{demoPrice !== undefined ? "Synthetic US customer projection" : activeLock?.scopeLabel ?? `Any eligible ${market.name} station`}</p></div>
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
        <Metric icon={BadgeCheck} label="Saved this year" value={money(saved, market, 0)} detail="18 protected fills" />
        <Metric icon={ShieldCheck} label="Price-drop protection" value="On" detail="Automatic adjustments" />
        <Metric icon={MapPin} label="Nearby stations" value="24" detail="Within 5 miles" />
      </div>
      <section className="mt-4 flex flex-col justify-between gap-4 rounded-md border border-[#efd695] bg-[#fff8e6] p-5 sm:flex-row sm:items-center">
        <div><p className="font-semibold">You have not paid full price in 6 months</p><p className="mt-1 text-sm text-[#735d2c]">Share your scorecard and give friends a better first lock.</p></div>
        <button className={`${buttonBase} shrink-0 bg-[#ffc24b] text-[#0b1b2b] hover:bg-[#f0b337]`}><Gift size={17} />Share scorecard</button>
      </section>
    </div>
  );
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
  scopeId, changeScope, setScopeId, loading, quotesPaused,
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
}) {
  const scopedOptions = options.filter((option) => option.scopeType === scopeType);
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

      {scopeType !== "country" && <div className="mt-5">
        <label htmlFor="scope-option" className="text-sm font-semibold">{scopeType === "station" ? "Choose a filling station" : "Choose a fuel brand"}</label>
        <select id="scope-option" value={scopeId ?? ""} onChange={(event) => setScopeId(event.target.value)} disabled={loading} className="mt-2 h-12 w-full rounded-md border border-[#cdd9d1] bg-white px-3 text-sm">
          {scopedOptions.map((option) => <option key={option.scopeId} value={option.scopeId ?? ""}>{option.label} · {money(option.unitPrice, market)}/{market.unit}</option>)}
        </select>
      </div>}

      <div className="mt-5 flex items-start justify-between gap-4 border-y border-[#e5ebe7] py-5">
        <div>
          <p className="text-sm text-[#61716b]">{priceLabel}</p>
          <p className="mt-1 font-[family-name:var(--font-space-grotesk)] text-3xl font-bold">{loading || !selected ? "Loading..." : money(quotePrice, market)}{selected && <span className="text-sm font-medium text-[#61716b]">/{market.unit}</span>}</p>
          <p className="mt-2 max-w-md text-xs leading-5 text-[#61716b]">{selected?.label ?? "Retrieving verified station prices"}</p>
        </div>
        <span className="shrink-0 rounded-md bg-[#dff5e9] px-3 py-2 text-xs font-bold text-[#0b7a4b]">{scopeType === "station" ? "1 station" : `${selected?.stationCount ?? 0} stations`}</span>
      </div>
      <div className="mt-4 flex items-start gap-2 text-xs leading-5 text-[#61716b]"><MapPin size={15} className="mt-0.5 shrink-0 text-[#0b7a4b]" /><p>{scopeCopy} Prices are verified observations for this prototype and may differ from the forecourt display.</p></div>

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
    <section className="rounded-md border border-[#dce5df] bg-white p-5"><div className="flex items-center gap-3"><CircleUserRound size={22} className="text-[#0b7a4b]" /><div><h2 className="font-semibold">Prototype profile</h2><p className="text-sm text-[#61716b]">Francis · Demo account</p></div></div><button className={`${buttonBase} mt-5 w-full border border-[#dce5df]`}><WalletCards size={17} />Manage payment method</button></section>
    <section className="rounded-md border border-[#dce5df] bg-white p-5"><h2 className="font-semibold">Market and units</h2><p className="mt-1 text-sm text-[#61716b]">Prices and volumes follow the selected market.</p><div className="mt-4 grid grid-cols-3 gap-2">{(Object.keys(markets) as MarketCode[]).map((code) => <button key={code} onClick={() => changeMarket(code)} className={`h-10 rounded-md border text-sm font-semibold ${marketCode === code ? "border-[#0ba75e] bg-[#dff5e9] text-[#0b7a4b]" : "border-[#dce5df]"}`}>{code === "GB" ? "UK" : code}</button>)}</div></section>
  </div></div>;
}

function PageTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return <div className="mb-6"><p className="text-sm font-medium text-[#61716b]">{eyebrow}</p><h1 className="font-[family-name:var(--font-space-grotesk)] text-2xl font-bold md:text-3xl">{title}</h1></div>;
}

function EmptyState({ icon: Icon, title, text, action }: { icon: typeof Home; title: string; text: string; action: () => void }) {
  return <div className="flex flex-col items-center px-5 py-10 text-center"><div className="grid size-11 place-items-center rounded-md bg-[#dff5e9] text-[#0b7a4b]"><Icon size={21} /></div><p className="mt-3 font-semibold">{title}</p><p className="mt-1 max-w-sm text-sm text-[#61716b]">{text}</p><button onClick={action} className={`${buttonBase} mt-4 bg-[#0ba75e] text-white`}>Create demo lock</button></div>;
}

function RedeemDialog({ market, volume, cloud, busy, redeem, close }: MarketProps & { volume: number; cloud: boolean; busy: boolean; redeem: (amount: number) => Promise<void>; close: () => void }) {
  const redeemVolume = market.unit === "gal" ? 10 : 20;
  return <div role="dialog" aria-modal="true" aria-labelledby="redeem-title" className="fixed inset-0 z-50 grid place-items-end bg-[#0b1b2b]/55 p-0 sm:place-items-center sm:p-4"><div className="w-full max-w-md rounded-t-lg bg-white p-5 shadow-2xl sm:rounded-lg">
    <div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase text-[#0b7a4b]">Demo redemption</p><h2 id="redeem-title" className="text-xl font-bold">Pay with your tank</h2></div><button onClick={close} className="grid size-9 place-items-center rounded-md border border-[#dce5df]" aria-label="Close"><X size={18} /></button></div>
    <div className="mx-auto mt-6 w-fit rounded-md border border-[#dce5df] bg-white p-4"><QRCodeSVG value={`fuelcap-demo:${market.code}:${volume}:842119`} size={210} fgColor="#0b1b2b" /></div>
    <p className="mt-5 text-center font-semibold">{volume} {market.unit} available</p><p className="mt-1 text-center text-sm text-[#61716b]">Show this simulated code at a partner pump.</p>
    {cloud && <button disabled={busy || volume < redeemVolume} onClick={() => redeem(redeemVolume)} className={`${buttonBase} mt-5 w-full bg-[#0ba75e] text-white`}>{busy ? "Redeeming..." : `Simulate ${redeemVolume} ${market.unit} redemption`}</button>}
    <button onClick={close} className={`${buttonBase} mt-2 w-full ${cloud ? "border border-[#dce5df]" : "bg-[#0b1b2b] text-white"}`}>Done</button>
  </div></div>;
}

function AccountMenu({ email, close, openAuth }: { email: string | null; close: () => void; openAuth: () => void }) {
  async function signOut() {
    await createClient().auth.signOut();
    close();
  }
  return <div className="fixed inset-0 z-50 bg-[#0b1b2b]/40" onMouseDown={close}><div onMouseDown={(e) => e.stopPropagation()} className="ml-auto min-h-full w-full max-w-sm bg-white p-5 shadow-2xl">
    <div className="flex items-center justify-between"><Brand /><button onClick={close} className="grid size-9 place-items-center rounded-md border border-[#dce5df]" aria-label="Close menu"><X size={18} /></button></div>
    <div className="mt-8 flex items-center gap-3 rounded-md bg-[#f3f6f4] p-4"><CircleUserRound size={32} className="text-[#0b7a4b]" /><div className="min-w-0"><p className="font-semibold">{email ? "FuelCap member" : "Prototype account"}</p><p className="truncate text-xs text-[#61716b]">{email ?? "Not signed in"}</p></div></div>
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
