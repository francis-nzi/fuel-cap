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

type View = "home" | "tank" | "lock" | "activity" | "settings";
type LockRecord = {
  id: string;
  volume: number;
  remainingVolume: number;
  unitPrice: number;
  total: number;
  status: string;
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
  const [syncing, setSyncing] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const baseMarket = markets[marketCode];
  const livePrice = livePrices[marketCode] ?? baseMarket.livePrice;
  const market = { ...baseMarket, livePrice, lockedPrice: demoLockedPrice(baseMarket, livePrice) };

  const loadCloudData = useCallback(async () => {
    setSyncing(true);
    const supabase = createClient();
    const [profileResult, locksResult, transactionsResult, pricesResult] = await Promise.all([
      supabase.from("profiles").select("market").maybeSingle(),
      supabase.from("price_locks").select("id,volume,remaining_volume,locked_unit_price,status,created_at").order("created_at", { ascending: false }),
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

  function changeMarket(code: MarketCode) {
    setMarketCode(code);
    setVolume(markets[code].defaultVolume);
    setNotice(`Market changed to ${markets[code].name}`);
    window.setTimeout(() => setNotice(null), 2600);
    if (userId) void createClient().from("profiles").update({ market: code }).eq("id", userId);
  }

  async function confirmLock() {
    setActionBusy(true);
    if (userId) {
      const { error } = await createClient().rpc("create_demo_lock", {
        p_market: marketCode,
        p_fuel_grade: "regular",
        p_volume: volume,
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
      unitPrice: market.lockedPrice,
      total: volume * market.lockedPrice,
      status: "active",
      createdAt: new Date().toISOString(),
    };
    setLocks((current) => [record, ...current]);
    }
    setActionBusy(false);
    setNotice(`${volume} ${market.unit} locked at ${money(market.lockedPrice, market)}/${market.unit}`);
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
          {view === "home" && <HomeView market={market} tankVolume={tankVolume} saved={saved} setView={setView} redeem={() => setShowRedeem(true)} />}
          {view === "tank" && <TankView market={market} tankVolume={tankVolume} locks={locks} setView={setView} redeem={() => setShowRedeem(true)} />}
          {view === "lock" && <LockView market={market} volume={volume} setVolume={setVolume} confirm={confirmLock} busy={actionBusy} />}
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

function HomeView({ market, tankVolume, saved, setView, redeem }: MarketProps & { tankVolume: number; saved: number; setView: (view: View) => void; redeem: () => void }) {
  const advantage = market.livePrice - market.lockedPrice;
  return (
    <div className="view-enter">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div><p className="text-sm font-medium text-[#61716b]">Your overview</p><h1 className="font-[family-name:var(--font-space-grotesk)] text-2xl font-bold md:text-3xl">Your fuel is protected</h1></div>
        <button onClick={() => setView("lock")} className={`${buttonBase} whitespace-nowrap bg-[#0ba75e] text-white hover:bg-[#0b7a4b]`}><LockKeyhole size={17} />Lock price</button>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.3fr_.7fr]">
        <section className="rounded-md bg-[#0b1b2b] p-5 text-white md:p-7">
          <div className="flex items-start justify-between gap-4">
            <div><p className="text-xs font-bold uppercase text-[#8fb8a6]">Your locked price</p><p className="mt-2 font-[family-name:var(--font-space-grotesk)] text-4xl font-bold md:text-5xl">{money(market.lockedPrice, market)}<span className="ml-1 text-base font-medium text-[#8fb8a6]">/{market.unit}</span></p></div>
            <span className="rounded-md bg-[#17364a] px-2 py-1 text-xs font-semibold text-[#dff5e9]">Regular</span>
          </div>
          <div className="mt-7 grid grid-cols-2 gap-4 border-t border-[#284052] pt-5">
            <div><p className="text-xs text-[#8fb8a6]">Live pump price</p><p className="mt-1 text-lg font-semibold">{money(market.livePrice, market)}/{market.unit}</p></div>
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
      <div><p className="text-sm text-[#8fb8a6]">Available regular {market.fuelWord}</p><p className="mt-2 font-[family-name:var(--font-space-grotesk)] text-5xl font-bold">{tankVolume} <span className="text-xl text-[#8fb8a6]">{market.unit}</span></p><p className="mt-3 text-sm text-[#c7d6ce]">Protected at {money(market.lockedPrice, market)}/{market.unit}</p></div>
      <div className="flex gap-2"><button onClick={() => setView("lock")} className={`${buttonBase} bg-[#0ba75e] text-white`}><LockKeyhole size={17} />Add fuel</button><button onClick={redeem} className={`${buttonBase} border border-[#476070] text-white`}><QrCode size={17} />Redeem</button></div>
    </section>
    <section className="mt-5 rounded-md border border-[#dce5df] bg-white"><div className="border-b border-[#dce5df] p-4"><h2 className="font-semibold">Active price locks</h2></div>
      {locks.length === 0 ? <EmptyState icon={LockKeyhole} title="No additional locks yet" text="Your starter tank is ready. Add a simulated lock to test the full flow." action={() => setView("lock")} /> :
        <div className="divide-y divide-[#e5ebe7]">{locks.map((lock) => <div key={lock.id} className="flex items-center justify-between gap-4 p-4"><div><p className="font-semibold">{lock.remainingVolume} of {lock.volume} {market.unit} remaining</p><p className="text-xs text-[#61716b]">{new Date(lock.createdAt).toLocaleString(market.locale)}</p></div><div className="text-right"><p className="font-semibold">{money(lock.unitPrice, market)}/{market.unit}</p><p className="text-xs capitalize text-[#0b7a4b]">{lock.status.replace("_", " ")}</p></div></div>)}</div>}
    </section>
  </div>;
}

function LockView({ market, volume, setVolume, confirm, busy }: MarketProps & { volume: number; setVolume: (n: number) => void; confirm: () => Promise<void>; busy: boolean }) {
  const total = volume * market.lockedPrice;
  return <div className="view-enter mx-auto max-w-3xl"><PageTitle eyebrow="New price lock" title={`Lock today's ${market.fuelWord} price`} />
    <section className="rounded-md border border-[#dce5df] bg-white p-5 md:p-7">
      <div className="flex items-center justify-between gap-4 border-b border-[#e5ebe7] pb-5"><div><p className="text-sm text-[#61716b]">Current lock price</p><p className="mt-1 text-3xl font-bold">{money(market.lockedPrice, market)}<span className="text-sm text-[#61716b]">/{market.unit}</span></p></div><span className="rounded-md bg-[#dff5e9] px-3 py-2 text-xs font-bold text-[#0b7a4b]">Live demo price</span></div>
      <div className="py-6"><div className="flex items-center justify-between"><label htmlFor="volume" className="font-semibold">How much to lock?</label><output className="text-xl font-bold">{volume} {market.unit}</output></div>
        <input id="volume" className="mt-5 w-full accent-[#0ba75e]" type="range" min={market.unit === "gal" ? 10 : 40} max={market.maxVolume} step={market.unit === "gal" ? 5 : 10} value={volume} onChange={(e) => setVolume(Number(e.target.value))} />
        <div className="mt-2 flex justify-between text-xs text-[#61716b]"><span>{market.unit === "gal" ? 10 : 40} {market.unit}</span><span>{market.maxVolume} {market.unit}</span></div>
      </div>
      <div className="rounded-md bg-[#dff5e9] p-4"><div className="flex gap-3"><ShieldCheck className="shrink-0 text-[#0b7a4b]" size={21} /><div><p className="font-semibold text-[#0b7a4b]">FuelCap protection</p><p className="mt-1 text-sm leading-6 text-[#285e46]">If the reference price rises, this price stays capped. If it falls below your lock, the demo balance adjusts automatically.</p></div></div></div>
      <div className="mt-6 flex items-center justify-between border-t border-[#e5ebe7] pt-5"><div><p className="text-xs text-[#61716b]">Simulated total</p><p className="text-2xl font-bold">{money(total, market)}</p></div><button disabled={busy} onClick={confirm} className={`${buttonBase} h-12 bg-[#0ba75e] px-6 text-white hover:bg-[#0b7a4b]`}><LockKeyhole size={18} />{busy ? "Saving..." : "Confirm demo lock"}</button></div>
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
