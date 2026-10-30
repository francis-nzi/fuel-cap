"use client";

import { SlidersHorizontal } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MarketCode, markets, money } from "@/lib/markets";
import { balanceOf, chargeRate, coverageLabel, defaultUsual, depositChoices, maxDeposit, payFromBalance, planFee, planFor, planProtection, walletLimit, type Unit } from "@/lib/funding";
import { milesBetween } from "@/lib/geo";
import { normalizeOptions, shiftOptions, stationsByPrice, type LockScope, type PriceOption } from "@/lib/price-options";
import { cents, round4, savedVsReference, savingOnFill, settleFill } from "@/lib/protection";
import { createClient } from "@/lib/supabase/client";
import { initialDemoControlSnapshot, type DemoControlSnapshot } from "@fuelcap/demo-control";
import { servicePlans, type LifecycleCommand, type LifecycleCustomer, type PlanId, type ServicePlan } from "@fuelcap/demo-data/customer-lifecycle";
import { AuthDialog } from "./customer/auth-dialog";
import { DEMO_CUSTOMER_ID, OnboardingView } from "./customer/onboarding";
import { PRESENTER_REFERENCE, PresenterPanel, type RunOfShow } from "./customer/presenter-panel";
import { AccountScreen, ActivityScreen, AddMoneyScreen, DoneScreen, HomeScreen, PayScreen, ReceiptScreen, type StationSummary } from "./customer/screens";
import { StationPicker, useOrigin } from "./customer/station-picker";
import { emptyAccounts, formatVolume, isActive, shortLabel, type Account, type Accounts, type LockRecord, type Receipt, type Screen, type TransactionRecord } from "./customer/types";
import { Header, primaryButton, StickyAction, TabBar } from "./customer/ui";
import { useDeviceLocation } from "./customer/use-location";

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
type StoredDemo = { market: MarketCode; accounts: Accounts; onboarded: boolean; customer: LifecycleCustomer | null; pumpOverride: number | null; planId: PlanId };

const STORAGE_KEY = "fuelcap-demo-v4";
const LEGACY_STORAGE_KEYS = ["fuelcap-demo", "fuelcap-demo-v2", "fuelcap-demo-v3"];
const DAY_MS = 86_400_000;

// Demo stations (illustrative names, prices and positions) for markets without a live feed. UK prices come live
// from Fuel Finder, which carries real station coordinates.
type DemoStation = { id: string; provider: string; label: string; price: number; latitude: number; longitude: number };
const demoStations: Record<MarketCode, DemoStation[]> = {
  US: [
    { id: "11000000-0000-0000-0000-000000000001", provider: "Shell", label: "Shell Downtown - 101 Main St, Austin, TX", price: 3.5, latitude: 30.2668, longitude: -97.7429 },
    { id: "11000000-0000-0000-0000-000000000003", provider: "BP", label: "BP Central - 220 Congress Ave, Austin, TX", price: 3.39, latitude: 30.2712, longitude: -97.7404 },
    { id: "11000000-0000-0000-0000-000000000002", provider: "Shell", label: "Shell Riverside - 480 River Rd, Austin, TX", price: 3.49, latitude: 30.2448, longitude: -97.7270 },
    { id: "11000000-0000-0000-0000-000000000005", provider: "Chevron", label: "Chevron Airport - 2901 Airport Blvd, Austin, TX", price: 3.47, latitude: 30.2905, longitude: -97.7076 },
    { id: "11000000-0000-0000-0000-000000000006", provider: "Chevron", label: "Chevron South - 7300 S Congress Ave, Austin, TX", price: 3.58, latitude: 30.1937, longitude: -97.7782 },
    { id: "11000000-0000-0000-0000-000000000004", provider: "BP", label: "BP North - 8150 Burnet Rd, Austin, TX", price: 3.53, latitude: 30.3586, longitude: -97.7365 },
  ],
  CA: [
    { id: "21000000-0000-0000-0000-000000000001", provider: "Shell", label: "Shell King Street - 548 King St W, Toronto, ON", price: 1.589, latitude: 43.6447, longitude: -79.3990 },
    { id: "21000000-0000-0000-0000-000000000005", provider: "Esso", label: "Esso Front Street - 200 Front St W, Toronto, ON", price: 1.619, latitude: 43.6440, longitude: -79.3860 },
    { id: "21000000-0000-0000-0000-000000000003", provider: "Petro-Canada", label: "Petro-Canada Bloor - 55 Bloor St E, Toronto, ON", price: 1.609, latitude: 43.6705, longitude: -79.3860 },
    { id: "21000000-0000-0000-0000-000000000002", provider: "Shell", label: "Shell Lakeshore - 1250 Lake Shore Blvd, Toronto, ON", price: 1.629, latitude: 43.6635, longitude: -79.3200 },
    { id: "21000000-0000-0000-0000-000000000004", provider: "Petro-Canada", label: "Petro-Canada Danforth - 1675 Danforth Ave, Toronto, ON", price: 1.649, latitude: 43.6845, longitude: -79.3200 },
    { id: "21000000-0000-0000-0000-000000000006", provider: "Esso", label: "Esso North York - 5000 Yonge St, Toronto, ON", price: 1.669, latitude: 43.7680, longitude: -79.4130 },
  ],
  GB: [
    { id: "31000000-0000-0000-0000-000000000001", provider: "Shell", label: "Shell Fulham - 147 New Kings Rd, London", price: 1.419, latitude: 51.4730, longitude: -0.2010 },
    { id: "31000000-0000-0000-0000-000000000003", provider: "BP", label: "BP Battersea - 9 York Rd, London", price: 1.429, latitude: 51.4640, longitude: -0.1790 },
    { id: "31000000-0000-0000-0000-000000000005", provider: "Texaco", label: "Texaco Brixton - 234 Brixton Rd, London", price: 1.439, latitude: 51.4700, longitude: -0.1130 },
    { id: "31000000-0000-0000-0000-000000000002", provider: "Shell", label: "Shell Islington - 108 Upper St, London", price: 1.449, latitude: 51.5390, longitude: -0.1030 },
    { id: "31000000-0000-0000-0000-000000000004", provider: "BP", label: "BP Camden - 102 Camden Rd, London", price: 1.459, latitude: 51.5420, longitude: -0.1360 },
    { id: "31000000-0000-0000-0000-000000000006", provider: "Texaco", label: "Texaco Hackney - 88 Mare St, London", price: 1.479, latitude: 51.5390, longitude: -0.0560 },
  ],
};
const demoCoords = new Map(Object.values(demoStations).flat().map((station) => [station.id, station]));

// The US demo reference station ($3.50). The presenter panel sets its pump price directly; otherwise the control
// room's published move shifts every US price.
const US_REFERENCE_STATION_ID = demoStations.US[0].id;
const US_CONTROL_BASELINE = initialDemoControlSnapshot.displayUnitPrice;
const fillSteps = (unit: string) => (unit === "gal" ? [5, 10] : [20, 40]);

function buildFallbackOptions(marketCode: MarketCode): PriceOption[] {
  const market = markets[marketCode];
  const now = new Date().toISOString();
  return demoStations[marketCode].map((station) => ({
    scopeType: "station", scopeId: station.id, label: station.label, providerName: station.provider, unitPrice: station.price,
    currency: market.currency, unit: market.unit, stationCount: 1, observedAt: now, latitude: station.latitude, longitude: station.longitude,
  }));
}
/** Database rows don't carry coordinates yet; the seeded demo stations share ids with the list above. */
const withDemoCoords = (options: PriceOption[]) => options.map((option) => {
  const known = option.scopeId ? demoCoords.get(option.scopeId) : undefined;
  return known && option.latitude === undefined ? { ...option, latitude: known.latitude, longitude: known.longitude } : option;
});

/** A short cashier fallback code derived from the protection id, e.g. FC-4821. */
function cashierCode(id: string) {
  let hash = 0;
  for (const character of id) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return `FC-${1000 + (hash % 9000)}`;
}

const setAsideOf = (account: Account) => cents(account.locks.filter(isActive).reduce((sum, lock) => sum + lock.held, 0));
const nextSeq = (account: Account) => account.transactions.reduce((max, row) => Math.max(max, row.seq), 0) + 1;

export function FuelCapApp() {
  const [screen, setScreen] = useState<Screen>("home");
  const [returnTo, setReturnTo] = useState<Screen>("home");
  const [marketCode, setMarketCode] = useState<MarketCode>("US");
  const [fill, setFill] = useState(5);
  const [amount, setAmount] = useState(100);
  const [monthly, setMonthly] = useState(false);
  const [lastAdded, setLastAdded] = useState(0);
  const [accounts, setAccounts] = useState<Accounts>(emptyAccounts);
  const [hydrated, setHydrated] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [rawOptions, setRawOptions] = useState<PriceOption[]>([]);
  const [optionsMarket, setOptionsMarket] = useState<MarketCode | null>(null);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [onboarded, setOnboarded] = useState(false);
  const [planId, setPlanId] = useState<PlanId>("BASIC");
  const [demoControl, setDemoControl] = useState<DemoControlSnapshot>(initialDemoControlSnapshot);
  const [lifecycleCustomer, setLifecycleCustomer] = useState<LifecycleCustomer | null>(null);
  const [pumpOverride, setPumpOverride] = useState<number | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [shared, setShared] = useState(false);
  const [sharedEver, setSharedEver] = useState(false);
  const [presenter, setPresenter] = useState(false);
  const [presenterSheet, setPresenterSheet] = useState(false);
  const content = useRef<HTMLDivElement>(null);
  const device = useDeviceLocation();
  const market = markets[marketCode];
  const unit = market.unit as Unit;
  const account = accounts[marketCode];
  const plan = planFor(lifecycleCustomer?.planId ?? planId);
  const usual = account.usualWeekly ?? defaultUsual(unit);

  const flash = useCallback((message: string, ms = 3600) => {
    setNotice(message);
    window.setTimeout(() => setNotice((current) => (current === message ? null : current)), ms);
  }, []);
  const updateAccount = useCallback((code: MarketCode, update: (current: Account) => Account) => {
    setAccounts((current) => ({ ...current, [code]: update(current[code]) }));
  }, []);
  const go = useCallback((next: Screen) => { setScreen(next); setShared(false); }, []);
  const openStations = () => { setReturnTo(screen === "station" ? "home" : screen); go("station"); };

  // One normalised price list per market feeds home, add money and the pump.
  const baseOptions = useMemo(() => (optionsMarket === marketCode ? normalizeOptions(withDemoCoords(rawOptions), markets[marketCode].name) : []), [rawOptions, optionsMarket, marketCode]);
  const usReferenceRaw = baseOptions.find((option) => option.scopeId === US_REFERENCE_STATION_ID)?.unitPrice ?? PRESENTER_REFERENCE;
  // The presenter's pump price applies only while the presenter panel is on (?demo=1).
  const usShift = marketCode !== "US" ? 0 : presenter && pumpOverride !== null ? round4(pumpOverride - usReferenceRaw) : round4(demoControl.displayUnitPrice - US_CONTROL_BASELINE);
  const options = useMemo(() => (usShift ? shiftOptions(baseOptions, usShift) : baseOptions), [baseOptions, usShift]);
  const stationList = useMemo(() => stationsByPrice(options), [options]);
  const pricesLoading = optionsLoading || optionsMarket !== marketCode;
  const quotesPaused = marketCode === "US" && demoControl.quoteAvailability === "PAUSED";

  // Your station: the one you chose, otherwise the nearest to you (or to the demo area).
  const origin = useOrigin(marketCode, stationList, device, null);
  const defaultStationId = useMemo(() => {
    if (marketCode === "US" && !device.coords && stationList.some((option) => option.scopeId === US_REFERENCE_STATION_ID)) return US_REFERENCE_STATION_ID;
    const located = stationList.filter((option) => option.latitude !== undefined && option.longitude !== undefined);
    const nearest = [...located].sort((a, b) => milesBetween(origin.coords, a as never) - milesBetween(origin.coords, b as never))[0];
    return nearest?.scopeId ?? stationList[0]?.scopeId ?? null;
  }, [marketCode, stationList, origin.coords, device.coords]);
  const stationId = account.stationId && stationList.some((option) => option.scopeId === account.stationId) ? account.stationId : defaultStationId;
  const station = stationList.find((option) => option.scopeId === stationId);
  const stationMiles = (option?: PriceOption) => option && option.latitude !== undefined && option.longitude !== undefined && !origin.demo ? milesBetween(origin.coords, option as never) : null;
  const stationSummary: StationSummary = station ? { name: shortLabel(station.label), price: station.unitPrice, miles: stationMiles(station) } : null;

  // What a protection is priced from, by plan coverage (DEC-065: Basic one station, Standard one brand, Plus anywhere).
  const scope = useMemo(() => {
    if (!station) return null;
    if (plan.stationScope === "BRAND") {
      const brand = options.find((option) => option.scopeType === "provider" && option.providerName === station.providerName);
      if (brand) return { reference: brand.unitPrice, scopeType: "provider" as LockScope, scopeId: brand.scopeId, label: `${station.providerName} stations` };
    }
    if (plan.stationScope === "ANYWHERE") {
      const country = options.find((option) => option.scopeType === "country");
      if (country) return { reference: country.unitPrice, scopeType: "country" as LockScope, scopeId: null, label: `Any ${market.name} station` };
    }
    return { reference: station.unitPrice, scopeType: "station" as LockScope, scopeId: station.scopeId, label: station.label };
  }, [station, plan.stationScope, options, market.name]);

  const activeLocks = account.locks.filter(isActive);
  // Fills draw on the earliest accepted protection first (Customer Rules, Rule 17).
  const activeLock = [...activeLocks].sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
  const balance = balanceOf(account.transactions);
  const setAside = setAsideOf(account);
  const free = cents(balance - setAside);
  const savings = cents(account.transactions.reduce((sum, transaction) => sum + (transaction.saving ?? 0), 0));
  const depositMax = maxDeposit(plan, balance);
  const depositAmount = Math.min(amount, Math.max(Math.floor(depositMax / 50) * 50, 0));
  const homeProtection = scope && !activeLock ? planProtection({ reference: scope.reference, usualWeekly: usual, plan, unit, free }) : null;
  const addPreview = scope && !activeLock ? planProtection({ reference: scope.reference, usualWeekly: usual, plan, unit, free: cents(free + depositAmount) }) : null;

  const pumpPriceFor = useCallback((lock: LockRecord) => {
    const where = lock.scopeType === "station" ? lock.stationId : stationId;
    return options.find((option) => option.scopeType === "station" && option.scopeId === where)?.unitPrice ?? lock.referencePrice;
  }, [options, stationId]);

  const fills = activeLock ? [...new Set([...fillSteps(unit).filter((step) => step < activeLock.remainingVolume), activeLock.remainingVolume])] : [];
  const fillVolume = activeLock ? (fills.includes(fill) ? fill : fills[0]) : 0;

  useEffect(() => {
    let cancelled = false;
    function publish(next: PriceOption[]) {
      if (cancelled) return;
      setRawOptions(next);
      setOptionsMarket(marketCode);
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

  // The control room's published US price and quote availability. Only the US demo market follows it, and only
  // while the page is visible.
  useEffect(() => {
    if (marketCode !== "US") return;
    let cancelled = false;
    async function refreshDemoControl() {
      if (document.visibilityState !== "visible") return;
      try {
        const response = await fetch("/api/demo-control", { cache: "no-store" });
        if (!response.ok || cancelled) return;
        const next = await response.json() as DemoControlSnapshot;
        if (!cancelled) setDemoControl(next);
      } catch { /* keep the last known control price */ }
    }
    void refreshDemoControl();
    const interval = window.setInterval(refreshDemoControl, presenter ? 1500 : 4000);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, [marketCode, presenter]);

  // Restore the demo (per-market balances, protections, onboarding, presenter price) after a refresh.
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
          if (data.planId) setPlanId(data.planId);
          if (typeof data.pumpOverride === "number") setPumpOverride(data.pumpOverride);
        }
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
      // Presenter controls appear only with ?demo=1 in the URL; customers never see them.
      setPresenter(new URLSearchParams(window.location.search).get("demo") === "1");
      setHydrated(true);
    }, 0);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      const data: StoredDemo = { market: marketCode, accounts, onboarded, customer: lifecycleCustomer, pumpOverride, planId };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch { /* storage unavailable: the session still works in memory */ }
  }, [hydrated, marketCode, accounts, onboarded, lifecycleCustomer, pumpOverride, planId]);

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_FUELCAP_E2E === "true") return;
    const supabase = createClient();
    const loadProfile = () => void supabase.from("profiles").select("market").maybeSingle().then(({ data }) => {
      if (data?.market && markets[data.market as MarketCode]) setMarketCode(data.market as MarketCode);
    });
    void supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? null);
      setUserId(data.user?.id ?? null);
      if (data.user) loadProfile();
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user.email ?? null);
      setUserId(session?.user.id ?? null);
      if (session?.user) loadProfile();
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => { content.current?.scrollTo({ top: 0 }); }, [screen]);

  /** Protect the usual window's fuel from the free balance (DEC-065 Option A). Pure: returns the updated account. */
  const protectAccount = useCallback((current: Account, now: number, renewal: boolean): Account => {
    if (!scope || !station) return current;
    const freeNow = cents(balanceOf(current.transactions) - setAsideOf(current));
    const result = planProtection({ reference: scope.reference, usualWeekly: current.usualWeekly ?? defaultUsual(unit), plan, unit, free: freeNow });
    let seq = nextSeq(current);
    const at = new Date(now).toISOString();
    if (!result.quote) {
      if (!renewal) return current;
      const row: TransactionRecord = { id: crypto.randomUUID(), seq, type: "not_renewed", amount: 0, description: "Protection not renewed", detail: `Not enough free balance for ${unit === "gal" ? "1 gal" : "5 L"}. Your money is free to spend`, createdAt: at };
      return { ...current, transactions: [row, ...current.transactions] };
    }
    const quote = result.quote;
    const expiresAt = new Date(now + plan.lockPeriodDays * DAY_MS);
    const until = expiresAt.toLocaleDateString(market.locale, { weekday: "short", day: "numeric", month: "short" });
    const lock: LockRecord = {
      id: crypto.randomUUID(), volume: result.volume, remainingVolume: result.volume, referencePrice: quote.reference, strike: quote.strike, boundary: quote.boundary,
      chargePerUnit: quote.chargePerUnit, charge: quote.charge, held: quote.held, status: "active", scopeType: scope.scopeType, scopeId: scope.scopeId,
      stationId: station.scopeId, scopeLabel: scope.label, createdAt: at, expiresAt: expiresAt.toISOString(),
    };
    const rows: TransactionRecord[] = [
      { id: crypto.randomUUID(), seq: seq++, type: "protection", amount: 0, description: `${renewal ? "Renewed" : "Protected"} ${formatVolume(result.volume, unit)} at max ${money(quote.strike, market)}/${unit}`, detail: `Until ${until} · ${shortLabel(scope.label)} · ${money(quote.held, market)} set aside`, createdAt: at },
      { id: crypto.randomUUID(), seq: seq++, type: "charge", amount: -cents(quote.charge), description: "Protection charge", detail: `${formatVolume(result.volume, unit)} for ${plan.lockPeriodDays} days at ${money(quote.chargePerUnit, market, 4)}/${unit}`, createdAt: at },
    ];
    return { ...current, locks: [lock, ...current.locks], transactions: [...rows.reverse(), ...current.transactions] };
  }, [scope, station, unit, plan, market]);

  /** End a protection window: release the set-aside money, then renew automatically if auto-rollover is on. */
  const endWindow = useCallback((code: MarketCode, lockId: string) => {
    updateAccount(code, (current) => {
      const lock = current.locks.find((candidate) => candidate.id === lockId);
      if (!lock || !isActive(lock)) return current;
      const now = new Date().getTime();
      const ended: Account = {
        ...current,
        locks: current.locks.map((candidate) => candidate.id === lockId ? { ...candidate, status: "expired" } : candidate),
        transactions: [{ id: crypto.randomUUID(), seq: nextSeq(current), type: "ended", amount: 0, description: "Protection window ended", detail: `${formatVolume(lock.remainingVolume, markets[code].unit)} unused · ${money(lock.held, markets[code])} back to free balance`, createdAt: new Date(now).toISOString() }, ...current.transactions],
      };
      if (!current.autoRollover || code !== marketCode) return ended;
      if (quotesPaused) return { ...ended, transactions: [{ id: crypto.randomUUID(), seq: nextSeq(ended), type: "not_renewed", amount: 0, description: "Protection not renewed", detail: "No valid price right now. Nothing was charged; protect again any time", createdAt: new Date(now + 1).toISOString() }, ...ended.transactions] };
      return protectAccount(ended, now + 1, true);
    });
  }, [updateAccount, protectAccount, marketCode, quotesPaused]);

  // Windows that ran out while the app was closed end (and renew) on the next open.
  useEffect(() => {
    if (!hydrated || pricesLoading) return;
    const check = () => account.locks.filter((lock) => isActive(lock) && Date.parse(lock.expiresAt) <= new Date().getTime()).forEach((lock) => endWindow(marketCode, lock.id));
    check();
    const interval = window.setInterval(check, 30_000);
    return () => window.clearInterval(interval);
  }, [hydrated, pricesLoading, account.locks, endWindow, marketCode]);

  function changeMarket(code: MarketCode) {
    if (code === marketCode) return;
    setOptionsLoading(true);
    setMarketCode(code);
    setFill(fillSteps(markets[code].unit)[0]);
    setReceipt(null);
    if (screen === "station") go("home");
    flash(`Country changed to ${markets[code].name}. Each country has its own balance.`, 3200);
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

  const planFeeRow = (current: Account, next: ServicePlan): Account => planFee(next) ? {
    ...current,
    transactions: [{ id: crypto.randomUUID(), seq: nextSeq(current), type: "plan_fee", amount: 0, description: `${next.name} plan fee, paid by card`, detail: `${money(planFee(next), market)} · Visa ending 4242`, createdAt: new Date().toISOString() }, ...current.transactions],
  } : current;

  function changePlan(next: ServicePlan) {
    if (next.id === plan.id) return;
    if (balance > walletLimit(next)) return flash(`Your balance is over the ${next.name} plan's ${money(walletLimit(next), market, 0)} limit. Cash out some first.`, 4200);
    setPlanId(next.id);
    if (lifecycleCustomer) sendLifecycle({ type: "CHANGE_PLAN", customerId: DEMO_CUSTOMER_ID, planId: next.id }).catch(() => undefined);
    updateAccount(marketCode, (current) => planFeeRow(current, next));
    flash(`You're on ${next.name}. ${activeLock ? "It applies from your next window." : ""}`, 3200);
  }

  function addMoney() {
    if (depositAmount <= 0) return;
    setBusy(true);
    const now = new Date().getTime();
    updateAccount(marketCode, (current) => {
      const deposited: Account = {
        ...current,
        monthlyTopUp: monthly ? depositAmount : current.monthlyTopUp,
        transactions: [{ id: crypto.randomUUID(), seq: nextSeq(current), type: "deposit", amount: depositAmount, description: "Added money", detail: monthly ? "Visa ending 4242 · monthly top-up on" : "Visa ending 4242", createdAt: new Date(now).toISOString() }, ...current.transactions],
      };
      return current.locks.some(isActive) || quotesPaused ? deposited : protectAccount(deposited, now + 1, false);
    });
    if (lifecycleCustomer) sendLifecycle({ type: "FUND_WALLET", customerId: DEMO_CUSTOMER_ID, amountMinor: Math.round(depositAmount * 100) }).catch(() => undefined);
    setLastAdded(depositAmount);
    setMonthly(false);
    setBusy(false);
    go("done");
  }

  function protectNow() {
    if (quotesPaused) return flash("New protections are paused for a moment. Your money is unaffected.", 4200);
    updateAccount(marketCode, (current) => protectAccount(current, new Date().getTime(), false));
    setLastAdded(0);
    go("done");
  }

  function startFill() {
    const lock = activeLock;
    if (!lock || fillVolume <= 0) return;
    const pumpPrice = pumpPriceFor(lock);
    const settlement = settleFill(fillVolume, pumpPrice, lock.strike, lock.boundary);
    const paid = payFromBalance(settlement, free);
    const now = new Date().getTime();
    const perUnit = `${money(pumpPrice, market)}/${unit}`;
    updateAccount(marketCode, (current) => {
      let seq = nextSeq(current);
      const rows: TransactionRecord[] = [{
        id: crypto.randomUUID(), seq: seq++, type: "fuel", amount: -paid.fromBalance,
        description: `Fuel ${formatVolume(fillVolume, unit)} at ${perUnit}`,
        detail: settlement.coveredByFuelCap > 0 ? `FuelCap paid ${money(settlement.coveredByFuelCap, market)}` : settlement.outcome === "fall" ? "Pump below your cap" : "At your cap",
        createdAt: new Date(now).toISOString(), saving: savingOnFill(settlement, lock.referencePrice),
      }];
      if (pumpPrice < lock.referencePrice) rows.push({ id: crypto.randomUUID(), seq: seq++, type: "price_fall", amount: 0, description: `Price fell: you paid ${money(settlement.returnedToWallet, market)} less than your cap`, detail: "It stays in your balance", createdAt: new Date(now).toISOString() });
      if (paid.byCard > 0) rows.push({ id: crypto.randomUUID(), seq: seq++, type: "card", amount: 0, description: "Above your limit, paid by card", detail: `${money(paid.byCard, market)} · Visa ending 4242`, createdAt: new Date(now).toISOString() });
      return {
        ...current,
        locks: current.locks.map((candidate) => candidate.id !== lock.id ? candidate : {
          ...candidate,
          remainingVolume: round4(candidate.remainingVolume - fillVolume),
          held: Math.max(round4(candidate.held - settlement.heldReleased), 0),
          status: candidate.remainingVolume <= fillVolume ? "redeemed" : "partially_redeemed",
        }),
        transactions: [...rows.reverse(), ...current.transactions],
      };
    });
    setReceipt({ settlement, station: shortLabel(lock.scopeType === "station" ? lock.scopeLabel : station?.label ?? lock.scopeLabel), strike: lock.strike, boundary: lock.boundary, reference: lock.referencePrice, savedVsToday: savedVsReference(settlement, lock.referencePrice), fromBalance: paid.fromBalance, byCard: paid.byCard });
    setFill(fillSteps(unit)[0]);
    go("receipt");
  }

  function cashOut() {
    if (free <= 0) return;
    updateAccount(marketCode, (current) => ({ ...current, transactions: [{ id: crypto.randomUUID(), seq: nextSeq(current), type: "cashout", amount: -free, description: "Cash out", detail: "To Visa ending 4242", createdAt: new Date().toISOString() }, ...current.transactions] }));
    flash(`${money(free, market)} is on its way to your card.`, 3200);
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
    ? `Fuel fell to ${money(receipt.settlement.pumpPrice, market)}: I paid ${money(receipt.settlement.returnedToWallet, market)} less than my FuelCap cap${receipt.savedVsToday > 0 ? ` and saved ${money(receipt.savedVsToday, market)} vs the day I protected` : ""}. Heads I win, tails I win.`
    : `Fuel hit ${money(receipt.settlement.pumpPrice, market)} and FuelCap covered ${money(receipt.settlement.coveredByFuelCap, market)} of my fill.` : "";

  function resetDemo() {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    setAccounts(emptyAccounts());
    setOnboarded(false);
    setLifecycleCustomer(null);
    setPlanId("BASIC");
    setPumpOverride(null);
    setReceipt(null);
    setSharedEver(false);
    setMarketCode("US");
    setAmount(100);
    setFill(5);
    setPresenterSheet(false);
    go("home");
    flash("Demo reset.", 2400);
  }

  const us = accounts.US;
  const usActive = us.locks.find(isActive);
  const runOfShow: RunOfShow = {
    protected: us.transactions.some((transaction) => transaction.type === "protection"),
    moved: pumpOverride !== null && pumpOverride !== PRESENTER_REFERENCE,
    paid: us.transactions.some((transaction) => transaction.type === "fuel"),
    fell: us.transactions.some((transaction) => transaction.type === "price_fall"),
    shared: sharedEver,
  };
  const presenterPump = pumpOverride ?? round4(usReferenceRaw + round4(demoControl.displayUnitPrice - US_CONTROL_BASELINE));
  const endUsWindow = usActive ? () => endWindow("US", usActive.id) : undefined;
  const panel = (close?: () => void) => <PresenterPanel pump={presenterPump} setPump={setPumpOverride} steps={runOfShow} reset={resetDemo} available={marketCode === "US"} chargeRate={chargeRate(plan)} planName={plan.name} endWindow={endUsWindow} close={close} />;

  const firstName = lifecycleCustomer?.name.split(" ")[0] ?? "there";
  const initials = lifecycleCustomer ? lifecycleCustomer.name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase() : "FC";
  const pill = `DEMO · ${marketCode === "GB" ? "UK" : marketCode} ${market.currency === "GBP" ? "£" : "$"}`;
  const daysLeft = activeLock ? Math.max(1, Math.ceil((new Date(activeLock.expiresAt).getTime() - new Date().getTime()) / DAY_MS)) : 0;
  const until = activeLock ? new Date(activeLock.expiresAt).toLocaleDateString(market.locale, { weekday: "short", day: "numeric", month: "short" }) : "";
  const notProtectedReason = !activeLock && homeProtection?.reason === "below_minimum" ? `Your free balance isn't enough to protect the minimum (${unit === "gal" ? "1 gal" : "5 L"}). Add money to protect your usual fuel.` : quotesPaused ? "New protections are paused for a moment. Your money is unaffected." : null;
  const addCta = busy ? "Adding…" : depositMax < 50 ? "At your plan's limit" : `Add ${money(depositAmount, market)}`;

  return (
    <div className="min-h-dvh bg-[#e7eeea] lg:flex lg:items-start lg:justify-center lg:gap-14 lg:px-10 lg:py-7">
      <div className="relative mx-auto flex h-dvh w-full max-w-[440px] flex-col overflow-hidden bg-[#f5f8f6] lg:mx-0 lg:h-[min(844px,calc(100dvh-56px))] lg:w-[390px] lg:shrink-0 lg:rounded-[40px] lg:shadow-[0_0_0_10px_#0b1b2b,0_30px_60px_rgba(11,27,43,0.28)]">
        <Header pill={pill} initials={initials} openAccount={() => go(screen === "account" ? "home" : "account")} accountOpen={screen === "account"} />
        <main ref={content} className="flex-1 overflow-y-auto p-5">
          {screen === "home" && <HomeScreen market={market} firstName={firstName} showProfile={hydrated && !onboarded} startProfile={() => go("onboarding")} loading={pricesLoading} station={stationSummary} plan={plan} balance={balance} setAside={setAside} free={free} lock={activeLock} pumpPrice={activeLock ? pumpPriceFor(activeLock) : station?.unitPrice ?? 0} until={until} daysLeft={daysLeft} nextProtection={homeProtection} savings={savings} notProtectedReason={notProtectedReason} protectNow={protectNow} previewStrike={scope ? round4(scope.reference * 1.05) : null} go={go} share={() => void share(`I've saved ${money(savings, market)} on fuel with FuelCap.`)} shareLabel={shareLabel} />}
          {screen === "onboarding" && <OnboardingView market={market} initialUsual={usual} send={sendLifecycle} complete={(customer, usualWeekly) => { setLifecycleCustomer(customer); setPlanId(customer.planId); setOnboarded(true); updateAccount(marketCode, (current) => planFeeRow({ ...current, usualWeekly }, planFor(customer.planId))); go("home"); flash("Your FuelCap account is ready.", 3200); }} cancel={() => go("home")} />}
          {screen === "station" && <StationPicker market={market} stations={stationList} selectedId={stationId} choose={(id) => { updateAccount(marketCode, (current) => ({ ...current, stationId: id })); go(returnTo === "station" ? "home" : returnTo); if (activeLock && activeLock.scopeType === "station" && activeLock.stationId !== id) flash("Your new station applies from your next window.", 3600); }} cancel={() => go(returnTo === "station" ? "home" : returnTo)} device={device} coverage={coverageLabel(plan)} switchCountry={changeMarket} />}
          {screen === "add" && <AddMoneyScreen market={market} plan={plan} balance={balance} amount={depositAmount || depositChoices[0]} setAmount={setAmount} max={depositMax} monthly={monthly} setMonthly={setMonthly} lock={activeLock} until={until} preview={addPreview} paused={quotesPaused} upgrade={() => { const higher = servicePlans[servicePlans.findIndex((candidate) => candidate.id === plan.id) + 1]; if (higher) changePlan(higher); }} />}
          {screen === "done" && <DoneScreen market={market} added={lastAdded} lock={activeLock} until={until} balance={balance} free={free} go={go} />}
          {screen === "pay" && <PayScreen market={market} lock={activeLock} pumpPrice={activeLock ? pumpPriceFor(activeLock) : 0} fills={fills} fill={fillVolume} setFill={setFill} code={activeLock ? cashierCode(activeLock.id) : ""} go={go} />}
          {screen === "receipt" && (receipt ? <ReceiptScreen market={market} receipt={receipt} share={() => void share(receiptShareText)} shareLabel={shareLabel} go={go} /> : <ActivityScreen market={market} transactions={account.transactions} />)}
          {screen === "activity" && <ActivityScreen market={market} transactions={account.transactions} />}
          {screen === "account" && <AccountScreen market={market} plan={plan} plans={servicePlans} changePlan={changePlan} usual={usual} setUsual={(value) => updateAccount(marketCode, (current) => ({ ...current, usualWeekly: value }))} station={stationSummary} changeStation={openStations} changeMarket={changeMarket} autoRollover={account.autoRollover} setAutoRollover={(on) => updateAccount(marketCode, (current) => ({ ...current, autoRollover: on }))} monthlyTopUp={account.monthlyTopUp} stopMonthly={() => updateAccount(marketCode, (current) => ({ ...current, monthlyTopUp: null }))} free={free} cashOut={cashOut} showProfile={hydrated && !onboarded} startProfile={() => go("onboarding")} email={userEmail} openAuth={() => setShowAuth(true)} signOut={() => void createClient().auth.signOut()} />}
        </main>
        {screen === "add" && <StickyAction><button type="button" onClick={addMoney} disabled={busy || depositMax < 50 || pricesLoading} className={`${primaryButton} w-full`}>{addCta}</button></StickyAction>}
        {screen === "pay" && activeLock && <StickyAction><button type="button" onClick={startFill} disabled={busy || fillVolume <= 0} className={`${primaryButton} w-full`}>{busy ? "Filling…" : `Start fill · ${formatVolume(fillVolume, unit)} (simulated)`}</button></StickyAction>}
        <TabBar screen={screen} go={go} />
        {notice && <div role="status" className="absolute inset-x-4 bottom-24 z-[1100] rounded-xl bg-[#0b1b2b] px-4 py-3 text-center text-sm font-semibold text-white shadow-xl">{notice}</div>}
        {presenter && <button type="button" onClick={() => setPresenterSheet(true)} aria-label="Open presenter controls" className="absolute right-4 top-20 z-[1100] grid size-11 place-items-center rounded-full bg-[#0b1b2b] text-white shadow-lg lg:hidden"><SlidersHorizontal size={18} /></button>}
      </div>
      {presenter && <div className="hidden max-w-[640px] flex-1 pt-2 lg:block">{panel()}</div>}
      {presenter && presenterSheet && <div role="dialog" aria-modal="true" aria-label="Presenter controls" className="fixed inset-0 z-[1200] overflow-y-auto bg-[#e7eeea] p-5 lg:hidden">{panel(() => setPresenterSheet(false))}</div>}
      {showAuth && <AuthDialog close={() => setShowAuth(false)} />}
    </div>
  );
}
