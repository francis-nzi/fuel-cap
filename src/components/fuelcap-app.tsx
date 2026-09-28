"use client";

import { SlidersHorizontal } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MarketCode, markets, money } from "@/lib/markets";
import { normalizeOptions, shiftOptions, stationsByPrice, type LockScope, type PriceOption } from "@/lib/price-options";
import { cents, quoteProtection, round4, settleFill, topUpFor } from "@/lib/protection";
import { createClient } from "@/lib/supabase/client";
import { initialDemoControlSnapshot, type DemoControlSnapshot } from "@fuelcap/demo-control";
import { servicePlans, type LifecycleCommand, type LifecycleCustomer } from "@fuelcap/demo-data/customer-lifecycle";
import { AuthDialog } from "./customer/auth-dialog";
import { DEMO_CUSTOMER_ID, OnboardingView } from "./customer/onboarding";
import { PRESENTER_REFERENCE, PresenterPanel, type RunOfShow } from "./customer/presenter-panel";
import { AccountScreen, ActivityScreen, DoneScreen, HomeScreen, PayScreen, ProtectScreen, ReceiptScreen } from "./customer/screens";
import { emptyAccounts, isActive, shortLabel, type Account, type Accounts, type LockRecord, type Receipt, type Screen, type TransactionRecord } from "./customer/types";
import { Header, primaryButton, StickyAction, TabBar } from "./customer/ui";

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
type StoredDemo = { market: MarketCode; accounts: Accounts; onboarded: boolean; customer: LifecycleCustomer | null; pumpOverride: number | null };

const STORAGE_KEY = "fuelcap-demo-v3";
const LEGACY_STORAGE_KEYS = ["fuelcap-demo", "fuelcap-demo-v2"];
const PRESENTER_KEY = "fuelcap-presenter";
const DEFAULT_CAP_DAYS = 7;
const DAY_MS = 86_400_000;

// Demo station sets. Distances are illustrative demo data for the "nearest first" list.
const demoStations: Record<MarketCode, { id: string; provider: string; label: string; price: number; miles: number }[]> = {
  US: [
    { id: "11000000-0000-0000-0000-000000000001", provider: "Shell", label: "Shell Downtown - 101 Main St, Austin, TX", price: 3.5, miles: 0.4 },
    { id: "11000000-0000-0000-0000-000000000003", provider: "BP", label: "BP Central - 220 Congress Ave, Austin, TX", price: 3.39, miles: 0.9 },
    { id: "11000000-0000-0000-0000-000000000002", provider: "Shell", label: "Shell Riverside - 480 River Rd, Austin, TX", price: 3.49, miles: 1.6 },
    { id: "11000000-0000-0000-0000-000000000005", provider: "Chevron", label: "Chevron Airport - 2901 Airport Blvd, Austin, TX", price: 3.47, miles: 2.3 },
    { id: "11000000-0000-0000-0000-000000000006", provider: "Chevron", label: "Chevron South - 7300 S Congress Ave, Austin, TX", price: 3.58, miles: 3.1 },
    { id: "11000000-0000-0000-0000-000000000004", provider: "BP", label: "BP North - 8150 Burnet Rd, Austin, TX", price: 3.53, miles: 4.8 },
  ],
  CA: [
    { id: "21000000-0000-0000-0000-000000000001", provider: "Shell", label: "Shell King Street - 548 King St W, Toronto, ON", price: 1.589, miles: 0.5 },
    { id: "21000000-0000-0000-0000-000000000005", provider: "Esso", label: "Esso Front Street - 200 Front St W, Toronto, ON", price: 1.619, miles: 0.8 },
    { id: "21000000-0000-0000-0000-000000000003", provider: "Petro-Canada", label: "Petro-Canada Bloor - 55 Bloor St E, Toronto, ON", price: 1.609, miles: 1.9 },
    { id: "21000000-0000-0000-0000-000000000002", provider: "Shell", label: "Shell Lakeshore - 1250 Lake Shore Blvd, Toronto, ON", price: 1.629, miles: 2.4 },
    { id: "21000000-0000-0000-0000-000000000004", provider: "Petro-Canada", label: "Petro-Canada Danforth - 1675 Danforth Ave, Toronto, ON", price: 1.649, miles: 3.6 },
    { id: "21000000-0000-0000-0000-000000000006", provider: "Esso", label: "Esso North York - 5000 Yonge St, Toronto, ON", price: 1.669, miles: 7.2 },
  ],
  GB: [
    { id: "31000000-0000-0000-0000-000000000001", provider: "Shell", label: "Shell Fulham - 147 New Kings Rd, London", price: 1.419, miles: 0.3 },
    { id: "31000000-0000-0000-0000-000000000003", provider: "BP", label: "BP Battersea - 9 York Rd, London", price: 1.429, miles: 1.1 },
    { id: "31000000-0000-0000-0000-000000000005", provider: "Texaco", label: "Texaco Brixton - 234 Brixton Rd, London", price: 1.439, miles: 2.2 },
    { id: "31000000-0000-0000-0000-000000000002", provider: "Shell", label: "Shell Islington - 108 Upper St, London", price: 1.449, miles: 3.4 },
    { id: "31000000-0000-0000-0000-000000000004", provider: "BP", label: "BP Camden - 102 Camden Rd, London", price: 1.459, miles: 3.9 },
    { id: "31000000-0000-0000-0000-000000000006", provider: "Texaco", label: "Texaco Hackney - 88 Mare St, London", price: 1.479, miles: 5.0 },
  ],
};
const DEMO_DISTANCES: Record<string, number> = Object.fromEntries(Object.values(demoStations).flat().map((station) => [station.id, station.miles]));

// The US demo reference station ($3.50 → max $3.68, limit $4.03: the brief's cases A–C). The presenter panel sets its
// pump price directly; otherwise the control room's published move shifts every US price.
const US_REFERENCE_STATION_ID = demoStations.US[0].id;
const US_CONTROL_BASELINE = initialDemoControlSnapshot.displayUnitPrice;

const volumeChoices = (unit: string) => (unit === "gal" ? [10, 15, 25, 40] : [20, 40, 60, 100]);
const fillStep = (unit: string) => (unit === "gal" ? [10, 20] : [20, 40]);

function buildFallbackOptions(marketCode: MarketCode): PriceOption[] {
  const market = markets[marketCode];
  const now = new Date().toISOString();
  return demoStations[marketCode].map((station) => ({
    scopeType: "station", scopeId: station.id, label: station.label, providerName: station.provider, unitPrice: station.price,
    currency: market.currency, unit: market.unit, stationCount: 1, observedAt: now,
  }));
}

/** A short cashier fallback code derived from the protection id, e.g. FC-4821. */
function cashierCode(id: string) {
  let hash = 0;
  for (const character of id) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return `FC-${1000 + (hash % 9000)}`;
}

export function FuelCapApp() {
  const [screen, setScreen] = useState<Screen>("home");
  const [marketCode, setMarketCode] = useState<MarketCode>("US");
  const [volume, setVolume] = useState(25);
  const [fill, setFill] = useState(20);
  const [accounts, setAccounts] = useState<Accounts>(emptyAccounts);
  const [hydrated, setHydrated] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [rawOptions, setRawOptions] = useState<PriceOption[]>([]);
  const [optionsMarket, setOptionsMarket] = useState<MarketCode | null>(null);
  const [pickStationId, setPickStationId] = useState<string | null>(null);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [onboarded, setOnboarded] = useState(false);
  const [demoControl, setDemoControl] = useState<DemoControlSnapshot>(initialDemoControlSnapshot);
  const [lifecycleCustomer, setLifecycleCustomer] = useState<LifecycleCustomer | null>(null);
  const [pumpOverride, setPumpOverride] = useState<number | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [shared, setShared] = useState(false);
  const [sharedEver, setSharedEver] = useState(false);
  const [presenter, setPresenter] = useState(false);
  const [presenterSheet, setPresenterSheet] = useState(false);
  const content = useRef<HTMLDivElement>(null);
  const market = markets[marketCode];
  const account = accounts[marketCode];
  const customerPlan = servicePlans.find((plan) => plan.id === lifecycleCustomer?.planId);
  const capDays = customerPlan?.lockPeriodDays ?? DEFAULT_CAP_DAYS;
  const sandbox = !userId;

  const flash = useCallback((message: string, ms = 3600) => {
    setNotice(message);
    window.setTimeout(() => setNotice((current) => (current === message ? null : current)), ms);
  }, []);
  const updateAccount = useCallback((code: MarketCode, update: (current: Account) => Account) => {
    setAccounts((current) => ({ ...current, [code]: update(current[code]) }));
  }, []);
  const go = useCallback((next: Screen) => { setScreen(next); setShared(false); }, []);

  // One normalised price list per market feeds home, protect and the pump.
  const baseOptions = useMemo(() => (optionsMarket === marketCode ? normalizeOptions(rawOptions, markets[marketCode].name) : []), [rawOptions, optionsMarket, marketCode]);
  const usReferenceRaw = baseOptions.find((option) => option.scopeId === US_REFERENCE_STATION_ID)?.unitPrice ?? PRESENTER_REFERENCE;
  const usShift = marketCode !== "US" ? 0 : pumpOverride !== null ? round4(pumpOverride - usReferenceRaw) : round4(demoControl.displayUnitPrice - US_CONTROL_BASELINE);
  const options = useMemo(() => (usShift ? shiftOptions(baseOptions, usShift) : baseOptions), [baseOptions, usShift]);
  const stationList = useMemo(() => stationsByPrice(options), [options]);
  const pricesLoading = optionsLoading || optionsMarket !== marketCode;
  const referenceOption = (marketCode === "US" ? options.find((option) => option.scopeId === US_REFERENCE_STATION_ID) : undefined) ?? options.find((option) => option.scopeType === "country");
  const referencePrice = referenceOption?.unitPrice ?? null;
  const referenceLabel = referenceOption?.scopeType === "station"
    ? `${shortLabel(referenceOption.label)}${referenceOption.scopeId && DEMO_DISTANCES[referenceOption.scopeId] !== undefined ? ` · ${DEMO_DISTANCES[referenceOption.scopeId]} mi` : ""}`
    : `Typical across ${(referenceOption?.stationCount ?? 0).toLocaleString(market.locale)} stations`;
  const quotesPaused = marketCode === "US" && demoControl.quoteAvailability === "PAUSED";

  const activeLocks = account.locks.filter(isActive);
  // Fills draw on the earliest accepted protection first (Customer Rules, Rule 17).
  const activeLock = [...activeLocks].sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
  const heldValue = cents(activeLocks.reduce((sum, lock) => sum + lock.held, 0));
  const savings = cents(account.transactions.reduce((sum, transaction) => sum + (transaction.saving ?? 0), 0));

  const pumpPriceFor = useCallback((lock: LockRecord) => {
    const option = lock.scopeType === "station" ? options.find((candidate) => candidate.scopeType === "station" && candidate.scopeId === lock.scopeId) : options.find((candidate) => candidate.scopeType === lock.scopeType && (lock.scopeType === "country" || candidate.scopeId === lock.scopeId));
    return option?.unitPrice ?? lock.referencePrice;
  }, [options]);

  const protectOption = activeLock ? options.find((option) => option.scopeType === "station" && option.scopeId === activeLock.scopeId) : stationList.find((option) => option.scopeId === pickStationId);
  const protectReference = protectOption?.unitPrice ?? activeLock?.referencePrice ?? null;
  const quote = protectReference === null ? null : quoteProtection(protectReference, volume, activeLock);
  const topUp = quote && sandbox ? topUpFor(quote.total, account.wallet) : 0;

  const fills = activeLock ? [...new Set([...fillStep(market.unit).map((step) => Math.min(step, activeLock.remainingVolume)), activeLock.remainingVolume])] : [];
  const fillVolume = activeLock ? Math.min(fill, activeLock.remainingVolume) : 0;

  const loadCloudData = useCallback(async () => {
    const supabase = createClient();
    const [profileResult, locksResult, transactionsResult] = await Promise.all([
      supabase.from("profiles").select("market").maybeSingle(),
      supabase.from("price_locks").select("id,volume,remaining_volume,locked_unit_price,status,scope_type,reference_label,created_at").order("created_at", { ascending: false }),
      supabase.from("transactions").select("id,type,amount,volume,unit_price,description,created_at").order("created_at", { ascending: false }),
    ]);
    const code = profileResult.data?.market && markets[profileResult.data.market as MarketCode] ? profileResult.data.market as MarketCode : "US";
    setMarketCode(code);
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
          expiresAt: new Date(new Date(row.created_at).getTime() + DEFAULT_CAP_DAYS * DAY_MS).toISOString(),
        };
      }) : current.locks,
      transactions: transactionsResult.data ? transactionsResult.data.map((row) => ({
        id: row.id, type: row.type, amount: Number(row.amount),
        volume: row.volume === null ? null : Number(row.volume),
        unitPrice: row.unit_price === null ? null : Number(row.unit_price),
        description: row.description, createdAt: row.created_at,
      })) : current.transactions,
    }));
  }, [updateAccount]);

  useEffect(() => {
    let cancelled = false;
    function publish(next: PriceOption[]) {
      if (cancelled) return;
      const normalized = normalizeOptions(next, markets[marketCode].name);
      const preferred = (marketCode === "US" ? normalized.find((option) => option.scopeId === US_REFERENCE_STATION_ID) : undefined) ?? stationsByPrice(normalized)[0];
      setRawOptions(next);
      setOptionsMarket(marketCode);
      setPickStationId(preferred?.scopeId ?? null);
      setOptionsLoading(false);
    }
    async function loadPriceOptions() {
      if (marketCode === "GB") {
        try {
          const response = await fetch("/api/fuel-finder", { cache: "no-store" });
          if (response.ok) {
            const payload = await response.json() as { options: PriceOption[] };
            if (payload.options.length) return publish(payload.options);
          }
        } catch { /* use the verified database or demonstrator fallback below */ }
      }
      const { data } = await createClient().rpc("get_current_lock_options", { p_market: marketCode, p_fuel_grade: "regular" });
      const remoteOptions = ((data ?? []) as LockOptionRow[]).map((row: LockOptionRow) => ({
        scopeType: row.scope_type as LockScope, scopeId: row.scope_id, label: row.label, providerName: row.provider_name,
        unitPrice: Number(row.unit_price), currency: row.currency, unit: row.unit, stationCount: Number(row.station_count), observedAt: row.observed_at,
      }));
      publish(remoteOptions.some((option) => option.scopeType === "station") ? remoteOptions : buildFallbackOptions(marketCode));
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

  // Restore the demo (per-market wallets, protections, onboarding, presenter price) after a refresh.
  useEffect(() => {
    window.setTimeout(() => {
      try {
        LEGACY_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const data = JSON.parse(stored) as Partial<StoredDemo>;
          if (data.market && markets[data.market]) setMarketCode(data.market);
          if (data.accounts) setAccounts({ ...emptyAccounts(), ...data.accounts });
          if (data.onboarded) setOnboarded(true);
          if (data.customer) setLifecycleCustomer(data.customer);
          if (typeof data.pumpOverride === "number") setPumpOverride(data.pumpOverride);
        }
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
      try {
        const fromUrl = new URLSearchParams(window.location.search).get("demo") === "1";
        if (fromUrl || sessionStorage.getItem(PRESENTER_KEY) === "on") setPresenter(true);
      } catch { /* presenter stays hidden */ }
      setHydrated(true);
    }, 0);
  }, []);

  useEffect(() => {
    if (!hydrated || userId) return;
    try {
      const data: StoredDemo = { market: marketCode, accounts, onboarded, customer: lifecycleCustomer, pumpOverride };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch { /* storage unavailable: the session still works in memory */ }
  }, [hydrated, userId, marketCode, accounts, onboarded, lifecycleCustomer, pumpOverride]);

  // Presenter controls: ?demo=1 or Ctrl + . (never shown to customers otherwise).
  useEffect(() => {
    function toggle(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key === ".") {
        event.preventDefault();
        setPresenter((current) => {
          try { sessionStorage.setItem(PRESENTER_KEY, current ? "off" : "on"); } catch { /* ignore */ }
          return !current;
        });
      }
    }
    window.addEventListener("keydown", toggle);
    return () => window.removeEventListener("keydown", toggle);
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
      if (session?.user) void loadCloudData();
    });
    return () => data.subscription.unsubscribe();
  }, [loadCloudData]);

  useEffect(() => { content.current?.scrollTo({ top: 0 }); }, [screen]);

  function changeMarket(code: MarketCode) {
    if (code === marketCode) return;
    setOptionsLoading(true);
    setMarketCode(code);
    setVolume(volumeChoices(markets[code].unit)[2]);
    setFill(fillStep(markets[code].unit)[1]);
    setReceipt(null);
    flash(`Country changed to ${markets[code].name}. Each country has its own wallet and protections.`, 3200);
    if (userId) void createClient().from("profiles").update({ market: code }).eq("id", userId);
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

  async function confirmProtect() {
    if (quotesPaused) return flash("New protections are paused for a moment. Anything you've already protected is unaffected.", 4200);
    if (!quote || (!activeLock && !protectOption)) return flash("Choose a station to protect your fuel.", 3200);
    const stationLabel = activeLock?.scopeLabel ?? protectOption!.label;
    setBusy(true);
    if (userId) {
      const { error } = await createClient().rpc("create_scoped_demo_lock", { p_market: marketCode, p_fuel_grade: "regular", p_volume: volume, p_scope_type: "station", p_scope_id: activeLock?.scopeId ?? protectOption?.scopeId ?? null });
      setBusy(false);
      if (error) return flash(error.message, 4200);
      await loadCloudData();
      return go("done");
    }
    const now = new Date().getTime();
    const entries: TransactionRecord[] = [{
      id: crypto.randomUUID(), type: "lock", amount: -quote.total, volume, unitPrice: quote.strike,
      description: `Protected ${volume} ${market.unit} · ${shortLabel(stationLabel)}`,
      detail: `Max ${money(quote.strike, market)}/${market.unit} · charge ${money(quote.charge, market)}`,
      createdAt: new Date(now).toISOString(),
    }];
    if (topUp) entries.push({ id: crypto.randomUUID(), type: "top_up", amount: topUp, volume: null, unitPrice: null, description: "Added funds", detail: "Visa ending 4242", createdAt: new Date(now - 1).toISOString() });
    updateAccount(marketCode, (current) => ({
      wallet: cents(current.wallet + topUp - quote.total),
      locks: activeLock
        ? current.locks.map((lock) => lock.id !== activeLock.id ? lock : { ...lock, volume: lock.volume + volume, remainingVolume: lock.remainingVolume + volume, held: round4(lock.held + quote.held), charge: round4(lock.charge + quote.charge) })
        : [{
          id: crypto.randomUUID(), volume, remainingVolume: volume, referencePrice: quote.reference, strike: quote.strike, boundary: quote.boundary,
          chargePerUnit: quote.chargePerUnit, charge: quote.charge, held: quote.held, status: "active", scopeType: "station",
          scopeId: protectOption?.scopeId ?? null, scopeLabel: stationLabel, createdAt: new Date(now).toISOString(), expiresAt: new Date(now + capDays * DAY_MS).toISOString(),
        }, ...current.locks],
      transactions: [...entries, ...current.transactions],
    }));
    if (topUp) recordFunding(topUp);
    setBusy(false);
    go("done");
  }

  async function startFill() {
    const lock = activeLock;
    if (!lock || fillVolume <= 0) return;
    const pumpPrice = pumpPriceFor(lock);
    const settlement = settleFill(fillVolume, pumpPrice, lock.strike, lock.boundary);
    setBusy(true);
    if (userId) {
      const { error } = await createClient().rpc("redeem_demo_fuel", { p_lock_id: lock.id, p_volume: fillVolume });
      setBusy(false);
      if (error) return flash(error.message, 3600);
      await loadCloudData();
    } else {
      const now = new Date().getTime();
      const perUnit = `${money(pumpPrice, market)}/${market.unit}`;
      const entries: TransactionRecord[] = [{
        id: crypto.randomUUID(), type: "redemption", amount: -cents(settlement.fromProtected + settlement.fromWallet), volume: fillVolume, unitPrice: pumpPrice,
        description: `Filled ${fillVolume} ${market.unit} at ${perUnit}`,
        detail: settlement.coveredByFuelCap > 0 ? `FuelCap covered ${money(settlement.coveredByFuelCap, market)}` : settlement.outcome === "fall" ? "Paid the lower pump price" : "Paid your cap price",
        createdAt: new Date(now).toISOString(), saving: settlement.coveredByFuelCap,
      }];
      if (settlement.returnedToWallet > 0) entries.unshift({
        id: crypto.randomUUID(), type: "refund", amount: settlement.returnedToWallet, volume: fillVolume, unitPrice: pumpPrice,
        description: "Price fell · returned to wallet", detail: `${fillVolume} ${market.unit} × ${money(lock.strike - pumpPrice, market)}`, createdAt: new Date(now + 1).toISOString(),
      });
      updateAccount(marketCode, (current) => ({
        wallet: cents(current.wallet + settlement.returnedToWallet - settlement.fromWallet),
        locks: current.locks.map((candidate) => candidate.id !== lock.id ? candidate : {
          ...candidate,
          remainingVolume: candidate.remainingVolume - fillVolume,
          held: Math.max(round4(candidate.held - settlement.heldReleased), 0),
          status: candidate.remainingVolume === fillVolume ? "redeemed" : "partially_redeemed",
        }),
        transactions: [...entries, ...current.transactions],
      }));
      setBusy(false);
    }
    setReceipt({ settlement, station: shortLabel(lock.scopeLabel), strike: lock.strike, boundary: lock.boundary });
    setFill(fillStep(market.unit)[1]);
    go("receipt");
  }

  async function share(text: string) {
    const url = window.location.origin;
    try {
      if (navigator.share) await navigator.share({ title: "FuelCap", text, url });
      else await navigator.clipboard.writeText(`${text} ${url}`);
      setShared(true);
      setSharedEver(true);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      flash("Sharing isn't available in this browser.", 3200);
    }
  }
  const shareLabel = shared ? "Link copied · share it anywhere" : "Share my win";
  const receiptShareText = receipt ? receipt.settlement.outcome === "fall"
    ? `Fuel fell to ${money(receipt.settlement.pumpPrice, market)} and FuelCap put ${money(receipt.settlement.returnedToWallet, market)} back in my wallet. Heads I win, tails I win.`
    : `Fuel hit ${money(receipt.settlement.pumpPrice, market)} and FuelCap covered ${money(receipt.settlement.coveredByFuelCap, market)} of my fill.` : "";

  function resetDemo() {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    setAccounts(emptyAccounts());
    setOnboarded(false);
    setLifecycleCustomer(null);
    setPumpOverride(null);
    setReceipt(null);
    setSharedEver(false);
    setMarketCode("US");
    setVolume(25);
    setFill(20);
    setPresenterSheet(false);
    go("home");
    flash("Demo reset.", 2400);
  }

  const us = accounts.US;
  const runOfShow: RunOfShow = {
    protected: us.transactions.some((transaction) => transaction.type === "lock"),
    moved: pumpOverride !== null && pumpOverride !== PRESENTER_REFERENCE,
    paid: us.transactions.some((transaction) => transaction.type === "redemption"),
    fell: us.transactions.some((transaction) => transaction.type === "refund"),
    shared: sharedEver,
  };
  const presenterPump = pumpOverride ?? round4(usReferenceRaw + round4(demoControl.displayUnitPrice - US_CONTROL_BASELINE));
  const panel = <PresenterPanel pump={presenterPump} setPump={setPumpOverride} steps={runOfShow} reset={resetDemo} available={marketCode === "US"} />;

  const firstName = lifecycleCustomer?.name.split(" ")[0] ?? "Francis";
  const initials = (lifecycleCustomer?.name ?? "Francis Doherty").split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  const pill = `DEMO · ${marketCode === "GB" ? "UK" : marketCode} ${market.currency === "GBP" ? "£" : "$"}`;
  const planLine = customerPlan ? `${customerPlan.name} · ${customerPlan.lockPeriodDays}-day cap · ${customerPlan.monthlyFeeMinor ? `£${(customerPlan.monthlyFeeMinor / 100).toFixed(2)}/mo` : "Free"}` : `Standard · ${DEFAULT_CAP_DAYS}-day cap · Free`;
  const daysLeft = activeLock ? Math.max(1, Math.ceil((new Date(activeLock.expiresAt).getTime() - new Date().getTime()) / DAY_MS)) : 0;
  const until = activeLock ? new Date(activeLock.expiresAt).toLocaleDateString(market.locale, { weekday: "short", day: "numeric", month: "short" }) : "";
  const protectCta = busy ? "Protecting…" : quotesPaused ? "New protections paused" : pricesLoading && !activeLock ? "Loading prices…" : !quote ? "Choose a station" : topUp ? `Add ${money(topUp, market)} & protect ${volume} ${market.unit}` : `Protect ${volume} ${market.unit} · ${money(quote.total, market)}`;

  return (
    <div className="min-h-dvh bg-[#e7eeea] lg:flex lg:items-start lg:justify-center lg:gap-14 lg:px-10 lg:py-7">
      <div className="relative mx-auto flex h-dvh w-full max-w-[440px] flex-col overflow-hidden bg-[#f5f8f6] lg:mx-0 lg:h-[min(844px,calc(100dvh-56px))] lg:w-[390px] lg:shrink-0 lg:rounded-[40px] lg:shadow-[0_0_0_10px_#0b1b2b,0_30px_60px_rgba(11,27,43,0.28)]">
        <Header pill={pill} initials={initials} openAccount={() => go(screen === "account" ? "home" : "account")} accountOpen={screen === "account"} />
        <main ref={content} className="flex-1 overflow-y-auto p-5">
          {screen === "home" && <HomeScreen market={market} firstName={firstName} showProfile={hydrated && !onboarded && !userId} startProfile={() => go("onboarding")} loading={pricesLoading} referencePrice={referencePrice} referenceLabel={referenceLabel} previewStrike={referencePrice === null ? null : quoteProtection(referencePrice, 1).strike} days={capDays} wallet={account.wallet} lock={activeLock} pumpPrice={activeLock ? pumpPriceFor(activeLock) : referencePrice ?? 0} daysLeft={daysLeft} heldValue={heldValue} savings={savings} go={go} share={() => void share(`I've saved ${money(savings, market)} on fuel with FuelCap.`)} shareLabel={shareLabel} />}
          {screen === "onboarding" && <OnboardingView send={sendLifecycle} complete={(customer) => { setLifecycleCustomer(customer); setOnboarded(true); go("home"); flash("Your FuelCap account is ready.", 3200); }} cancel={() => go("home")} />}
          {screen === "protect" && <ProtectScreen market={market} stations={stationList} distances={DEMO_DISTANCES} selectedId={pickStationId} select={setPickStationId} lock={activeLock} volumes={volumeChoices(market.unit)} volume={volume} setVolume={setVolume} quote={quote} topUp={topUp} wallet={account.wallet} days={capDays} loading={pricesLoading && !activeLock} paused={quotesPaused} />}
          {screen === "done" && (activeLock ? <DoneScreen market={market} lock={activeLock} until={until} wallet={account.wallet} go={go} /> : <PayScreen market={market} pumpPrice={0} fills={[]} fill={0} setFill={setFill} code="" go={go} />)}
          {screen === "pay" && <PayScreen market={market} lock={activeLock} pumpPrice={activeLock ? pumpPriceFor(activeLock) : 0} fills={fills} fill={fillVolume} setFill={setFill} code={activeLock ? cashierCode(activeLock.id) : ""} go={go} />}
          {screen === "receipt" && (receipt ? <ReceiptScreen market={market} receipt={receipt} share={() => void share(receiptShareText)} shareLabel={shareLabel} go={go} /> : <ActivityScreen market={market} transactions={account.transactions} />)}
          {screen === "activity" && <ActivityScreen market={market} transactions={account.transactions} />}
          {screen === "account" && <AccountScreen market={market} planLine={planLine} changeMarket={changeMarket} showProfile={hydrated && !onboarded && !userId} startProfile={() => go("onboarding")} email={userEmail} openAuth={() => setShowAuth(true)} signOut={() => void createClient().auth.signOut()} />}
        </main>
        {screen === "protect" && <StickyAction><button type="button" onClick={() => void confirmProtect()} disabled={busy || quotesPaused || !quote || (pricesLoading && !activeLock)} className={`${primaryButton} w-full`}>{protectCta}</button></StickyAction>}
        {screen === "pay" && activeLock && <StickyAction><button type="button" onClick={() => void startFill()} disabled={busy || fillVolume <= 0} className={`${primaryButton} w-full`}>{busy ? "Filling…" : `Start fill · ${fillVolume} ${market.unit} (simulated)`}</button></StickyAction>}
        <TabBar screen={screen} go={go} />
        {notice && <div role="status" className="absolute inset-x-4 bottom-24 z-30 rounded-xl bg-[#0b1b2b] px-4 py-3 text-center text-sm font-semibold text-white shadow-xl">{notice}</div>}
        {presenter && <button type="button" onClick={() => setPresenterSheet(true)} aria-label="Open presenter controls" className="absolute right-4 top-20 z-20 grid size-11 place-items-center rounded-full bg-[#0b1b2b] text-white shadow-lg lg:hidden"><SlidersHorizontal size={18} /></button>}
      </div>
      {presenter && <div className="hidden max-w-[640px] flex-1 pt-2 lg:block">{panel}</div>}
      {presenter && presenterSheet && <div role="dialog" aria-modal="true" aria-label="Presenter controls" className="fixed inset-0 z-50 overflow-y-auto bg-[#e7eeea] p-5 lg:hidden"><PresenterPanel pump={presenterPump} setPump={(price) => { setPumpOverride(price); }} steps={runOfShow} reset={resetDemo} available={marketCode === "US"} close={() => setPresenterSheet(false)} /></div>}
      {showAuth && <AuthDialog close={() => setShowAuth(false)} />}
    </div>
  );
}
