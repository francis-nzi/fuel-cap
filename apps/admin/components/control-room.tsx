"use client";

import {
  Activity,
  Bot,
  Boxes,
  Building2,
  Check,
  CircleDollarSign,
  Database,
  FileCheck2,
  Gauge,
  Globe2,
  LayoutDashboard,
  LockKeyhole,
  Menu,
  Clock3,
  PanelLeftClose,
  ReceiptText,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  Users,
  WalletCards,
  X,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { AUTHZ_POLICY_VERSION, authorize, demoOrganisations, visibleWorkspaces, type Environment as AuthzEnvironment, type Principal, type Workspace } from "@fuelcap/authz";
import { SessionTimer, signOut } from "@/components/auth/session-timer";
import { useStepUp } from "@/components/auth/step-up";
import { createScenarioRuntime, type DemoEnvironment, type ScenarioReady } from "@fuelcap/demo-data";
import { INVESTOR_DEMO_VERSION, investorDemoSteps } from "@fuelcap/demo-data/investor-demo";
import { pricingObservationSets, scenarioOrder, scenarios, type MarketFilter, type ScenarioId } from "@/lib/demo-data";
import { FleetWorkspace } from "@/components/fleet-workspace";
import { PricingDataWorkspace } from "@/components/pricing-data-workspace";
import { SpreadFxWorkspace } from "@/components/spread-fx-workspace";
import { RiskHedgingWorkspace } from "@/components/risk-hedging-workspace";
import { TransactionsLedgerWorkspace } from "@/components/transactions-ledger-workspace";
import { BillingReconciliationWorkspace } from "@/components/billing-reconciliation-workspace";
import { FraudCasesWorkspace } from "@/components/fraud-cases-workspace";
import { RulesAutomationWorkspace } from "@/components/rules-automation-workspace";
import { CommunicationsWorkspace } from "@/components/communications-workspace";
import { PlatformIntegrationsAuditWorkspace } from "@/components/platform-integrations-audit-workspace";
import { CustomerWorkspace } from "@/components/customer-workspace";
import { BusinessOverview } from "@/components/business-overview";

const workspaces: readonly { key: Workspace; label: string; icon: typeof LayoutDashboard; active?: boolean }[] = [
  { key: "control-room", label: "Business Overview", icon: LayoutDashboard, active: true },
  { key: "customers", label: "Customers", icon: Users },
  { key: "fleets-vehicles", label: "Fleets & Vehicles", icon: Building2 },
  { key: "pricing-data", label: "Pricing Data", icon: Database },
  { key: "spread-fx", label: "Spread & FX", icon: RefreshCw },
  { key: "risk-hedging", label: "Risk & Hedging", icon: ShieldCheck },
  { key: "transactions-ledger", label: "Transactions & Ledger", icon: WalletCards },
  { key: "billing-reconciliation", label: "Billing & Reconciliation", icon: ReceiptText },
  { key: "fraud-cases", label: "Fraud & Cases", icon: TriangleAlert },
  { key: "rules-automation", label: "Rules & Automation", icon: Bot },
  { key: "communications", label: "Communications", icon: Activity },
  { key: "platform-integrations-audit", label: "Platform, Integrations & Audit", icon: Globe2 },
];

type ApprovalState = "idle" | "reviewing" | "approved";
type ResetState = "idle" | "resetting" | "ready" | "failed";
type SecurityState = "none" | "permission-denied" | "step-up-required" | "step-up-complete" | "break-glass-denied" | "emergency-granted" | "emergency-denied" | "step-up-cancelled";
type TimeWindow = "24H" | "7D" | "30D";

const marketDefaults: Record<MarketFilter, ScenarioId> = { US: "exposure", UK: "ukQuote", CA: "canadaFraud", MULTI: "fx" };

const flowEvidence: Record<string, { source: string; version: string; owner: string; action: string }> = {
  price: { source: "Canonical price decision", version: "pricing-data@1.4", owner: "Data Operations", action: "Inspect observations" },
  spread: { source: "Pinned spread decision", version: "spread-engine@1.2", owner: "Pricing & Product", action: "Open component ledger" },
  protect: { source: "Protected position", version: "rules-engine@1.2", owner: "Customer Operations", action: "View affected positions" },
  ledger: { source: "Journal projection", version: "ledger@1.0", owner: "Finance & Reconciliation", action: "Rebuild projection" },
  settle: { source: "Settlement decision", version: "settlement@1.1", owner: "Settlement Operations", action: "Open match evidence" },
  risk: { source: "Exposure snapshot", version: "risk-model@0.4-demo", owner: "Risk & Treasury", action: "Review recommendation" },
};

function StatusDot({ state }: { state: "healthy" | "watch" | "controlled" }) {
  return <span className={`status-dot status-dot--${state}`} role="img" aria-label={state} />;
}

/** The control room for the signed-in member of staff; their roles come from the server (admin_staff). */
export function ControlRoom({ principal }: { principal: Principal }) {
  const [scenarioId, setScenarioId] = useState<ScenarioId>("exposure");
  const [marketFilter, setMarketFilter] = useState<MarketFilter>("US");
  const [timeWindow, setTimeWindow] = useState<TimeWindow>("24H");
  const environment: DemoEnvironment = process.env.NEXT_PUBLIC_APP_ENV === "production" ? "production" : "demo";
  const authzEnvironment: AuthzEnvironment = environment;
  const [activeOrganisationId, setActiveOrganisationId] = useState(principal.organisationIds.includes("org-fuelcap-global") ? "org-fuelcap-global" : principal.organisationIds[0]);
  const { governed, dialog: stepUpDialog } = useStepUp();
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace>("control-room");
  const [platformInitialSelection, setPlatformInitialSelection] = useState<"health" | "approvals" | "case" | "catalogue" | "alerts" | "exceptions" | "ai" | "growth" | "release">("health");
  const memberOrganisations = demoOrganisations.filter(({ organisationId }) => principal.organisationIds.includes(organisationId));
  const allowedWorkspaceKeys = visibleWorkspaces(principal, authzEnvironment, activeOrganisationId, workspaces.map(({ key }) => key));
  const visibleNavigation = workspaces.filter(({ key }) => allowedWorkspaceKeys.includes(key));
  const canInitiateHedge = authorize({ principal, environment: authzEnvironment, activeOrganisationId, workspace: "risk-hedging", verb: "initiate" }).allowed;
  const runtime = useMemo(() => createScenarioRuntime(environment, scenarios.exposure.manifestId), [environment]);
  const [scenarioReady, setScenarioReady] = useState<ScenarioReady>(() => runtime.reset(scenarios.exposure.manifestId));
  const [resetState, setResetState] = useState<ResetState>("idle");
  const [approvalState, setApprovalState] = useState<ApprovalState>("idle");
  const [securityState, setSecurityState] = useState<SecurityState>("none");
  const [selectedFlowKey, setSelectedFlowKey] = useState<string | null>(null);
  const [drawerDetailOpen, setDrawerDetailOpen] = useState(false);
  const [traceActive, setTraceActive] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [mobileViewport, setMobileViewport] = useState(false);
  const [demoStepIndex, setDemoStepIndex] = useState<number | null>(null);
  const sidebarRef = useRef<HTMLElement | null>(null);
  const mobileMenuTriggerRef = useRef<HTMLButtonElement | null>(null);
  const drawerRef = useRef<HTMLElement | null>(null);
  const evidenceTriggerRef = useRef<HTMLElement | null>(null);
  const scenario = scenarios[scenarioId];
  const selectedFlowNode = scenario.flow.find((node) => node.key === selectedFlowKey) ?? null;
  const auditId = useMemo(() => `AUD-DEMO-${scenarioId.toUpperCase()}-00842`, [scenarioId]);

  function openEvidence(key: string) {
    if (document.activeElement instanceof HTMLElement) evidenceTriggerRef.current = document.activeElement;
    setDrawerDetailOpen(false);
    setSelectedFlowKey(key);
  }

  function closeEvidence() {
    setSelectedFlowKey(null);
    setDrawerDetailOpen(false);
    requestAnimationFrame(() => evidenceTriggerRef.current?.focus());
  }

  function closeMobileNavigation() {
    setMobileNavOpen(false);
    requestAnimationFrame(() => mobileMenuTriggerRef.current?.focus());
  }

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 900px)");
    const updateViewport = () => {
      setMobileViewport(mediaQuery.matches);
      if (!mediaQuery.matches) setMobileNavOpen(false);
    };
    updateViewport();
    mediaQuery.addEventListener("change", updateViewport);
    return () => mediaQuery.removeEventListener("change", updateViewport);
  }, []);

  useEffect(() => {
    if (!mobileViewport || !mobileNavOpen) return;
    const sidebar = sidebarRef.current;
    const previousOverflow = document.body.style.overflow;
    const focusable = () => Array.from(sidebar?.querySelectorAll<HTMLElement>('button, [href], select, input, [tabindex]:not([tabindex="-1"])') ?? []);
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => focusable()[0]?.focus());
    function containNavigationFocus(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMobileNavigation();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", containNavigationFocus);
    return () => {
      document.removeEventListener("keydown", containNavigationFocus);
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileNavOpen, mobileViewport]);

  useEffect(() => {
    if (!selectedFlowKey) return;
    const drawer = drawerRef.current;
    const previousOverflow = document.body.style.overflow;
    const focusable = () => Array.from(drawer?.querySelectorAll<HTMLElement>('button, [href], select, input, [tabindex]:not([tabindex="-1"])') ?? []);
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => focusable()[0]?.focus());
    function containFocus(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeEvidence();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", containFocus);
    return () => {
      document.removeEventListener("keydown", containFocus);
      document.body.style.overflow = previousOverflow;
    };
  }, [selectedFlowKey]);

  function requestGovernedAction() {
    if (!canInitiateHedge) {
      setSecurityState("permission-denied");
      return;
    }
    setApprovalState("reviewing");
    setSecurityState("step-up-required");
  }

  // The server checks the role and a fresh (≤5 min) authenticator code before the hedge goes ahead.
  async function confirmStepUp() {
    const result = await governed("initiate-hedge", { organisationId: activeOrganisationId });
    if ("cancelled" in result) return setSecurityState("step-up-cancelled");
    if (!result.allowed) {
      setApprovalState("idle");
      return setSecurityState("permission-denied");
    }
    setApprovalState("approved");
    setSecurityState("step-up-complete");
  }

  // Break-glass can never force a price to "valid": the server refuses after a step-up, and audits the attempt.
  async function demonstrateBreakGlassBoundary() {
    const result = await governed("validate-price", { organisationId: activeOrganisationId });
    if ("cancelled" in result) return setSecurityState("step-up-cancelled");
    setSecurityState("break-glass-denied");
  }

  async function requestEmergencyAccess() {
    const result = await governed("emergency-access", { organisationId: activeOrganisationId });
    if ("cancelled" in result) return setSecurityState("step-up-cancelled");
    setSecurityState(result.allowed ? "emergency-granted" : "emergency-denied");
  }

  function changeScenario(id: ScenarioId) {
    setScenarioId(id);
    setMarketFilter(scenarios[id].market);
    setScenarioReady(runtime.reset(scenarios[id].manifestId));
    setResetState("idle");
    setApprovalState("idle");
    setSelectedFlowKey(null);
    setDrawerDetailOpen(false);
    setTraceActive(false);
  }

  function changeMarket(market: MarketFilter) {
    changeScenario(marketDefaults[market]);
  }

  async function resetScenario() {
    setResetState("resetting");
    try {
      const response = await fetch("/api/demo/scenarios/reset", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": `control-room:${scenario.manifestId}:1.0.0`,
        },
        body: JSON.stringify({ scenarioId: scenario.manifestId }),
      });
      if (!response.ok) throw new Error("Scenario reset was rejected.");
      const result = await response.json() as { ready: ScenarioReady };
      setScenarioReady(result.ready);
      setApprovalState("idle");
      setResetState("ready");
    } catch {
      setResetState("failed");
    }
  }

  function openDemoStep(index: number) {
    const step = investorDemoSteps[index];
    const nextScenarioId = step.scenarioKey as ScenarioId;
    setDemoStepIndex(index);
    // Acts no longer switch person: they run as whoever is signed in, within that person's organisations.
    if (principal.organisationIds.includes(step.organisationId)) setActiveOrganisationId(step.organisationId);
    setScenarioId(nextScenarioId);
    setMarketFilter(scenarios[nextScenarioId].market);
    setScenarioReady(runtime.reset(scenarios[nextScenarioId].manifestId));
    setResetState("idle");
    setApprovalState("idle");
    setSecurityState("none");
    setSelectedFlowKey(null);
    setDrawerDetailOpen(false);
    setTraceActive(false);
    if ("initialSelection" in step) setPlatformInitialSelection(step.initialSelection);
    setActiveWorkspace(step.workspace as Workspace);
    closeMobileNavigation();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="admin-shell">
      <aside
        ref={sidebarRef}
        id="admin-navigation"
        className={`sidebar ${mobileNavOpen ? "sidebar--open" : ""}`}
        role={mobileViewport && mobileNavOpen ? "dialog" : undefined}
        aria-modal={mobileViewport && mobileNavOpen ? true : undefined}
        aria-label={mobileViewport && mobileNavOpen ? "Admin navigation" : undefined}
        aria-hidden={mobileViewport && !mobileNavOpen ? true : undefined}
        inert={mobileViewport && !mobileNavOpen ? true : undefined}
      >
        <div className="brand-row">
          <div className="brand-mark"><Image src="/fuelcap-mark.svg" width={26} height={28} alt="FuelCap" priority /></div>
          <div>
            <strong>FuelCap</strong>
            <span>Operations</span>
          </div>
          <button className="icon-button sidebar-close" onClick={closeMobileNavigation} aria-label="Close navigation"><X size={18} /></button>
        </div>

        <div className="environment-card">
          <div className="environment-card__top">
            <span className="pulse-dot" />
            <strong>Sandbox environment</strong>
          </div>
          <span>Simulated operations · v1.0</span>
        </div>

        <nav aria-label="Admin workspaces">
          <p className="nav-label">Workspaces</p>
          <div className="nav-list">
            {visibleNavigation.map(({ key, label, icon: Icon }) => (
              <button className={`nav-item ${activeWorkspace === key ? "nav-item--active" : ""}`} key={label} type="button" onClick={() => { if (key === "platform-integrations-audit") setPlatformInitialSelection("health"); setActiveWorkspace(key); closeMobileNavigation(); }}>
                <Icon size={17} />
                <span>{label}</span>
                {key !== "control-room" && key !== "customers" && key !== "fleets-vehicles" && key !== "pricing-data" && key !== "spread-fx" && key !== "risk-hedging" && key !== "transactions-ledger" && key !== "billing-reconciliation" && key !== "fraud-cases" && key !== "rules-automation" && key !== "communications" && key !== "platform-integrations-audit" && <span className="nav-soon">Soon</span>}
              </button>
            ))}
          </div>
        </nav>

        <div className="sidebar-footer">
          <div className="avatar">{principal.name.split(" ").map((part) => part[0]).join("")}</div>
          <div><strong>{principal.name}</strong><span>{principal.roles.join(" · ")} · {AUTHZ_POLICY_VERSION}</span></div>
          <Settings2 size={17} />
        </div>
        <div className="sidebar-account" role="group" aria-label="Account">
          {(principal.roles.includes("PA") || principal.roles.includes("AU")) && <a href="/staff">Staff &amp; audit</a>}
          <a href="/account">Security</a>
          <button type="button" onClick={() => void signOut()}>Sign out</button>
        </div>
      </aside>

      {mobileNavOpen && <button className="nav-backdrop" aria-label="Close navigation" onClick={closeMobileNavigation} />}

      <main className="main-canvas">
        <header className="topbar">
          <button ref={mobileMenuTriggerRef} className="icon-button mobile-menu" onClick={() => setMobileNavOpen(true)} aria-label="Open navigation" aria-expanded={mobileNavOpen} aria-controls="admin-navigation"><Menu size={20} /></button>
          <div className="breadcrumb"><span>FuelCap Operations</span><span>/</span><strong>{workspaces.find(({ key }) => key === activeWorkspace)?.label}</strong></div>
          <div className="topbar-actions">
            <button className="search-button" type="button"><Search size={17} /><span>Search operations</span><kbd>⌘ K</kbd></button>
            <div className="context-switcher"><Building2 size={15} /><select aria-label="Active organisation" value={activeOrganisationId} onChange={(event) => setActiveOrganisationId(event.target.value)}>{memberOrganisations.map((organisation) => <option value={organisation.organisationId} key={organisation.organisationId}>{organisation.name}</option>)}</select></div>
            <div className="signed-in" role="group" aria-label="Signed-in account">
              <div className="top-avatar" aria-hidden="true">{principal.name.split(" ").map((part) => part[0]).join("")}</div>
              <span className="signed-in__who"><strong>{principal.name}</strong><small>{principal.roles.join(" · ")}</small></span>
              {(principal.roles.includes("PA") || principal.roles.includes("AU")) && <a className="signed-in__link" href="/staff">Staff &amp; audit</a>}
              <a className="signed-in__link" href="/account">Security</a>
              <button type="button" className="signed-in__link" onClick={() => void signOut()}>Sign out</button>
            </div>
          </div>
        </header>

        {demoStepIndex !== null && <section className="demo-guide" aria-label="Investor demo guide">
          <div className="demo-guide__progress"><span>{INVESTOR_DEMO_VERSION}</span><strong>Act {demoStepIndex + 1} of {investorDemoSteps.length} · {investorDemoSteps[demoStepIndex].title}</strong><progress aria-label="Investor demo progress" max={investorDemoSteps.length} value={demoStepIndex + 1}>{demoStepIndex + 1} of {investorDemoSteps.length}</progress></div>
          <div className="demo-guide__cue"><span>Presenter cue · {investorDemoSteps[demoStepIndex].durationMinutes} min</span><p>{investorDemoSteps[demoStepIndex].cue}</p><small>{investorDemoSteps[demoStepIndex].evidence}</small></div>
          <div className="demo-guide__actions">
            <button type="button" onClick={() => openDemoStep(demoStepIndex - 1)} disabled={demoStepIndex === 0}>Previous</button>
            {demoStepIndex < investorDemoSteps.length - 1 ? <button type="button" onClick={() => openDemoStep(demoStepIndex + 1)}>Next act</button> : <button type="button" onClick={() => setDemoStepIndex(null)}>Finish demo</button>}
            <button type="button" className="demo-guide__exit" onClick={() => setDemoStepIndex(null)}>Exit guide</button>
          </div>
        </section>}

        <div className="mobile-organisation-switcher">
          <Building2 size={15} aria-hidden="true" />
          <label htmlFor="mobile-active-organisation">Organisation</label>
          <select id="mobile-active-organisation" value={activeOrganisationId} onChange={(event) => setActiveOrganisationId(event.target.value)}>{memberOrganisations.map((organisation) => <option value={organisation.organisationId} key={organisation.organisationId}>{organisation.name}</option>)}</select>
        </div>

        {activeWorkspace === "customers" ? <CustomerWorkspace key={activeOrganisationId} organisationId={activeOrganisationId} principal={principal} environment={authzEnvironment} /> : activeWorkspace === "fleets-vehicles" ? <FleetWorkspace key={activeOrganisationId} organisationId={activeOrganisationId} principal={principal} environment={authzEnvironment} /> : activeWorkspace === "pricing-data" ? <PricingDataWorkspace key={activeOrganisationId} organisationId={activeOrganisationId} principal={principal} environment={authzEnvironment} /> : activeWorkspace === "spread-fx" ? <SpreadFxWorkspace key={activeOrganisationId} organisationId={activeOrganisationId} principal={principal} environment={authzEnvironment} /> : activeWorkspace === "risk-hedging" ? <RiskHedgingWorkspace key={activeOrganisationId} organisationId={activeOrganisationId} principal={principal} environment={authzEnvironment} /> : activeWorkspace === "transactions-ledger" ? <TransactionsLedgerWorkspace key={activeOrganisationId} organisationId={activeOrganisationId} principal={principal} environment={authzEnvironment} /> : activeWorkspace === "billing-reconciliation" ? <BillingReconciliationWorkspace key={activeOrganisationId} organisationId={activeOrganisationId} principal={principal} environment={authzEnvironment} /> : activeWorkspace === "fraud-cases" ? <FraudCasesWorkspace key={activeOrganisationId} organisationId={activeOrganisationId} principal={principal} environment={authzEnvironment} /> : activeWorkspace === "rules-automation" ? <RulesAutomationWorkspace key={activeOrganisationId} organisationId={activeOrganisationId} principal={principal} environment={authzEnvironment} /> : activeWorkspace === "communications" ? <CommunicationsWorkspace key={activeOrganisationId} organisationId={activeOrganisationId} principal={principal} environment={authzEnvironment} /> : activeWorkspace === "platform-integrations-audit" ? <PlatformIntegrationsAuditWorkspace key={`${activeOrganisationId}-${platformInitialSelection}`} organisationId={activeOrganisationId} principal={principal} environment={authzEnvironment} initialSelection={platformInitialSelection} /> : <>
        <BusinessOverview />
        <details className="advanced-operations"><summary>Advanced operations and technical controls</summary>
        <section className="operating-strip" aria-label="Operating status" tabIndex={0}>
          <div className="operating-strip__intro"><Activity size={15} /><strong>Operating state</strong><span className={`state-pill state-pill--${scenario.status.toLowerCase().replaceAll(" ", "-")}`}>{scenario.status}</span></div>
          <div className="strip-item"><StatusDot state="healthy" /><span>Pricing</span><strong>Eligible</strong></div>
          <div className="strip-item"><StatusDot state="healthy" /><span>Ledger</span><strong>Balanced</strong></div>
          <div className="strip-item"><StatusDot state={scenarioId === "boundary" ? "watch" : "healthy"} /><span>Settlement</span><strong>{scenarioId === "boundary" ? "11 breaks" : "Clear"}</strong></div>
          <div className="strip-item"><StatusDot state={scenarioId === "normal" ? "healthy" : "watch"} /><span>Risk</span><strong>{scenarioId === "normal" ? "In envelope" : "Review"}</strong></div>
          <div className="strip-item"><Sparkles size={14} /><span>AI monitor</span><strong>Evidence ready</strong></div>
          <time>{scenario.clock}</time>
        </section>

        <div className="content-wrap">
          <section className="page-heading">
            <div>
              <div className="eyebrow-row"><span className="demo-badge"><Boxes size={13} /> Demonstrator data</span><span>Scenario library v1.0.0</span></div>
              <h1>FuelCap Operating System</h1>
              <p>{scenario.summary}</p>
            </div>
            <div className="scenario-control">
              <label htmlFor="scenario">Rehearsed scenario</label>
              <select id="scenario" value={scenarioId} onChange={(event) => changeScenario(event.target.value as ScenarioId)}>
                {scenarioOrder.map((id) => <option value={id} key={id}>{scenarios[id].label}</option>)}
              </select>
              <button className={`scenario-reset scenario-reset--${resetState}`} type="button" onClick={resetScenario} disabled={resetState === "resetting"}><RefreshCw size={14} /> {resetState === "resetting" ? "Resetting…" : resetState === "ready" ? "Scenario ready" : resetState === "failed" ? "Reset failed · retry" : "Reset scenario"}</button>
            </div>
          </section>

          <section className="global-filter-bar" aria-label="Global operating filters">
            <div className="global-filter-bar__intro"><Globe2 size={16} /><div><strong>Operating lens</strong><span>Filters switch canonical scenario context; figures are never relabelled across markets.</span></div></div>
            <label><span>Market</span><select aria-label="Market filter" value={marketFilter} onChange={(event) => changeMarket(event.target.value as MarketFilter)}><option value="US">United States</option><option value="UK">United Kingdom</option><option value="CA">Canada</option><option value="MULTI">Multi-market / FX</option></select></label>
            <label><span>Time window</span><select aria-label="Time window" value={timeWindow} onChange={(event) => setTimeWindow(event.target.value as TimeWindow)}><option value="24H">Last 24 hours</option><option value="7D">Last 7 days</option><option value="30D">Last 30 days</option></select></label>
            <div className="filter-clock"><Clock3 size={14} /><span>Point-in-time values</span><strong>{scenario.clock}</strong></div>
          </section>

          <section className={`pricing-health pricing-health--${scenario.pricingHealth.status}`} aria-label="Pricing feed health">
            <div className="pricing-health__title"><Database size={17} /><div><span>Pricing signal health</span><strong>{scenario.pricingHealth.eligibility}</strong></div></div>
            <div className="pricing-health__fact"><span>Freshest observation</span><strong>{scenario.pricingHealth.freshestObservation}</strong></div>
            <div className="pricing-health__fact"><span>Eligible coverage</span><strong>{scenario.pricingHealth.coverage}</strong></div>
            <div className="pricing-health__fact"><span>Anomaly state</span><strong>{scenario.pricingHealth.anomaly}</strong></div>
            <div className="pricing-health__fact"><span>Conflicts</span><strong>{scenario.pricingHealth.conflicts}</strong></div>
            <button type="button" onClick={() => openEvidence("price")}><Search size={14} />Inspect pricing evidence</button>
          </section>

          <section className="metric-grid" aria-label="Executive metrics">
            {scenario.metrics.map((metric) => (
              <article className="metric-card" key={metric.label}>
                <div className="metric-card__label"><span>{metric.label}</span><Gauge size={15} /></div>
                <strong>{metric.value}</strong>
                <span className={`metric-delta metric-delta--${metric.tone}`}>{metric.delta}</span>
              </article>
            ))}
          </section>

          <section className="operations-panel">
            <div className="section-heading">
              <div><span className="section-kicker">Living Operations Map</span><h2>From market signal to controlled outcome</h2></div>
              <div className="map-heading-actions">
                <button className={`trace-button ${traceActive ? "trace-button--active" : ""}`} type="button" onClick={() => setTraceActive((active) => !active)}><Activity size={14} />{traceActive ? "Pause transaction trace" : "Trace selected transaction"}</button>
                <div className="lineage-chip"><LockKeyhole size={14} /><span>Lineage complete</span><strong>DEC-021 · RULE-09</strong></div>
              </div>
            </div>

            <div className={`flow-grid ${traceActive ? "flow-grid--tracing" : ""}`}>
              {scenario.flow.map((node, index) => (
                <button className={`flow-node flow-node--${node.state} ${selectedFlowKey === node.key ? "flow-node--selected" : ""}`} key={node.key} type="button" onClick={() => openEvidence(node.key)} aria-pressed={selectedFlowKey === node.key}>
                  <div className="flow-node__top"><span>{String(index + 1).padStart(2, "0")}</span><StatusDot state={node.state} /></div>
                  <p>{node.eyebrow}</p>
                  <h3>{node.title}</h3>
                  <strong>{node.value}</strong>
                  <span>{node.detail}</span>
                  {index < scenario.flow.length - 1 && <div className="flow-connector" aria-hidden="true"><span>›</span></div>}
                </button>
              ))}
            </div>

            <div className="map-footer">
              <span><Database size={14} /> Provenance: synthetic-seeded + illustrative-fixed</span>
              <span><RefreshCw size={14} /> Deterministic clock · contract {scenarioReady.contractVersion}</span>
              <span><FileCheck2 size={14} /> Rebuild verified from journal sequence</span>
            </div>
          </section>

          <section className="commercial-lineage" aria-label="Commercial and exposure lineage">
            <div className="commercial-lineage__heading"><div><span className="section-kicker">Commercial lineage</span><h2>Price, protection and exposure reconcile as one outcome</h2></div><span><FileCheck2 size={14} /> Click any value for evidence</span></div>
            <div className="commercial-lineage__steps">
              {scenario.commercialLineage.map((step, index) => <button className={`lineage-step lineage-step--${step.tone}`} type="button" key={`${step.label}-${index}`} onClick={() => openEvidence(step.nodeKey)}>
                <span>{String(index + 1).padStart(2, "0")} · {step.label}</span><strong>{step.value}</strong><small>{step.detail}</small>{index < scenario.commercialLineage.length - 1 && <i aria-hidden="true">→</i>}
              </button>)}
            </div>
          </section>

          <section className="control-evidence-grid" aria-label="Safeguarding and governed operational cases">
            <article className={`safeguarding-card safeguarding-card--${scenario.operationsControl.invariant}`}>
              <div className="control-card__heading"><div><span className="section-kicker">Safeguarding invariant</span><h2>Customer-owed value is fully accounted for</h2></div><span className="control-state"><ShieldCheck size={14} />Invariant {scenario.operationsControl.invariant}</span></div>
              <div className="safeguarding-equation"><div><span>Safeguarded balance</span><strong>{scenario.operationsControl.safeguarded}</strong></div><i>=</i><div><span>Customer owed</span><strong>{scenario.operationsControl.customerOwed}</strong></div><i>+</i><div><span>In flight</span><strong>{scenario.operationsControl.inFlight}</strong></div></div>
              <button type="button" onClick={() => openEvidence("ledger")}>Inspect ledger evidence <span>→</span></button>
            </article>
            <article className={`case-queue case-queue--${scenario.operationsControl.caseClass}`}>
              <div className="control-card__heading"><div><span className="section-kicker">Governed case queue</span><h2>{scenario.operationsControl.caseTitle}</h2></div><span className="case-count">{scenario.operationsControl.caseCount}</span></div>
              <div className="case-facts"><div><span>Reconciliation</span><strong>{scenario.operationsControl.reconciliation}</strong></div><div><span>Open breaks</span><strong>{scenario.operationsControl.breaks}</strong></div><div><span>Downstream control</span><strong>{scenario.operationsControl.downstream}</strong></div></div>
              <div className="case-boundary"><LockKeyhole size={14} /><span>Break-glass cannot clear an unreconciled or invalid state.</span></div>
              <button type="button" onClick={() => openEvidence(scenario.operationsControl.caseClass === "risk" || scenario.operationsControl.caseClass === "eligibility" ? "risk" : scenario.operationsControl.caseClass === "pricing" ? "price" : "settle")}>Open governed evidence <span>→</span></button>
              <button type="button" onClick={() => { setPlatformInitialSelection("approvals"); setActiveWorkspace("platform-integrations-audit"); }}>Open pending approvals <span>→</span></button>
              <button type="button" onClick={() => { setPlatformInitialSelection("case"); setActiveWorkspace("platform-integrations-audit"); }}>Open shared case <span>→</span></button>
              <button type="button" onClick={() => { setPlatformInitialSelection("catalogue"); setActiveWorkspace("platform-integrations-audit"); }}>Open case queue <span>→</span></button>
              <button type="button" onClick={() => { setPlatformInitialSelection("alerts"); setActiveWorkspace("platform-integrations-audit"); }}>Open alert queue <span>→</span></button>
              <button type="button" onClick={() => { setPlatformInitialSelection("exceptions"); setActiveWorkspace("platform-integrations-audit"); }}>Open exception controls <span>→</span></button>
              <button type="button" onClick={() => { setPlatformInitialSelection("ai"); setActiveWorkspace("platform-integrations-audit"); }}>Open AI Control Centre <span>→</span></button>
              <button type="button" onClick={() => { setPlatformInitialSelection("growth"); setActiveWorkspace("platform-integrations-audit"); }}>Open Growth workspace <span>→</span></button>
              <button type="button" onClick={() => { setPlatformInitialSelection("release"); setActiveWorkspace("platform-integrations-audit"); }}>Open release readiness <span>→</span></button>
            </article>
          </section>

          {selectedFlowNode && <><button className="evidence-backdrop" type="button" aria-label="Close evidence drawer" onClick={closeEvidence} /><aside ref={drawerRef} className="evidence-drawer" role="dialog" aria-modal="true" aria-label={`${selectedFlowNode.title} evidence`}>
            <div className="evidence-drawer__heading">
              <div><span className="section-kicker">Node evidence</span><h2>{selectedFlowNode.title}</h2></div>
              <button className="icon-button" type="button" onClick={closeEvidence} aria-label="Close evidence drawer"><X size={18} /></button>
            </div>
            <div className="evidence-drawer__value"><span>{selectedFlowNode.eyebrow}</span><strong>{selectedFlowNode.value}</strong><p>{selectedFlowNode.detail}</p></div>
            <dl className="evidence-facts">
              <div><dt>Source record</dt><dd>{flowEvidence[selectedFlowNode.key].source}</dd></div>
              <div><dt>Decision version</dt><dd>{flowEvidence[selectedFlowNode.key].version}</dd></div>
              <div><dt>Data freshness</dt><dd>{selectedFlowNode.key === "price" ? scenario.pricingHealth.freshestObservation : "Current scenario clock"}</dd></div>
              <div><dt>Control owner</dt><dd>{flowEvidence[selectedFlowNode.key].owner}</dd></div>
              <div><dt>Anomaly state</dt><dd>{selectedFlowNode.key === "price" ? scenario.pricingHealth.anomaly : selectedFlowNode.state === "watch" ? "Governed review" : "None detected"}</dd></div>
              <div><dt>Conflicts</dt><dd>{selectedFlowNode.key === "price" ? scenario.pricingHealth.conflicts : "0 unresolved"}</dd></div>
              <div><dt>Decision eligibility</dt><dd>{selectedFlowNode.key === "price" ? scenario.pricingHealth.eligibility : "Scenario eligible"}</dd></div>
              <div><dt>Provenance</dt><dd>Synthetic-seeded · demonstrator</dd></div>
            </dl>
            <div className="evidence-drawer__lineage"><FileCheck2 size={16} /><span>Scenario manifest → contract → decision → audit record</span><strong>{auditId}</strong></div>
            <button className="drawer-action" type="button" aria-expanded={drawerDetailOpen} onClick={() => setDrawerDetailOpen((open) => !open)}>{drawerDetailOpen ? "Hide detailed evidence" : flowEvidence[selectedFlowNode.key].action}<span>{drawerDetailOpen ? "↑" : "→"}</span></button>
            {drawerDetailOpen && <div className="drawer-detail" role="region" aria-label="Detailed evidence">
              {selectedFlowNode.key === "price" ? pricingObservationSets[scenarioId].map((observation) => <article className={`observation-row observation-row--${observation.decision.toLowerCase()}`} key={`${observation.source}-${observation.decision}`}><div><strong>{observation.source}</strong><span>{observation.observed} · {observation.licence}</span></div><span>{observation.eligibility}</span><b>{observation.decision}</b><p>{observation.reason}</p></article>) : <>
                <article className="observation-row observation-row--selected"><div><strong>{flowEvidence[selectedFlowNode.key].source}</strong><span>{flowEvidence[selectedFlowNode.key].version}</span></div><span>Pinned input</span><b>Selected</b><p>The scenario record is immutable and linked to this decision.</p></article>
                <article className="observation-row observation-row--corroborating"><div><strong>Policy evaluation</strong><span>RULE-09 · scenario contract 1.0.0</span></div><span>Control evidence</span><b>Corroborating</b><p>Eligibility and integrity checks completed before the projection was displayed.</p></article>
              </>}
            </div>}
          </aside></>}

          <div className="lower-grid">
            <section className="ai-panel">
              <div className="ai-panel__header">
                <div className="ai-orb"><Sparkles size={19} /></div>
                <div><span className="section-kicker">AI morning brief · cited demonstrator</span><h2>{scenario.recommendation.title}</h2></div>
                <div className="confidence"><span>Confidence</span><strong>{scenario.recommendation.confidence}%</strong></div>
              </div>
              <p className="ai-rationale">{scenario.recommendation.rationale}</p>
              <div className="evidence-grid">
                {scenario.recommendation.evidence.map((item) => <button type="button" key={`${item.claim}-${item.source}`} onClick={() => openEvidence(item.nodeKey)}><Check size={14} /><span><strong>{item.claim}</strong><small>Source · {item.source}</small></span><i>↗</i></button>)}
              </div>
              <div className="ai-assurance"><span><FileCheck2 size={13} /> 3/3 claims cited</span><span>Confidence floor · 80%</span><span>Projection assertions · passed</span><span>Action envelope · recommendation only</span></div>
              <div className="policy-box"><ShieldCheck size={18} /><div><strong>Policy boundary</strong><span>{scenario.recommendation.policy}</span></div></div>
              <div className="impact-row"><span>Expected impact</span><strong>{scenario.recommendation.impact}</strong></div>
              {securityState !== "none" && <div className={`security-state security-state--${securityState}`} role="status"><LockKeyhole size={17} /><div><strong>{{
                "permission-denied": "Permission denied",
                "step-up-required": "Step-up authentication required",
                "step-up-complete": "Fresh assurance verified",
                "break-glass-denied": "Break-glass boundary enforced",
                "emergency-granted": "Emergency access granted",
                "emergency-denied": "Emergency access refused",
                "step-up-cancelled": "Step-up cancelled",
              }[securityState]}</strong><span>{{
                "permission-denied": `${principal.roles.join("/")} cannot do this under ${AUTHZ_POLICY_VERSION}.`,
                "step-up-required": "Approval is paused until you confirm with a fresh code from your authenticator app.",
                "step-up-complete": "Your authenticator code was verified by the server; maker-checker and fresh assurance are in the audit log.",
                "break-glass-denied": "Emergency access cannot fabricate a valid price or override an integrity block. The attempt is audited and an incident is opened.",
                "emergency-granted": "Temporary support access is open for this incident and recorded in the audit log.",
                "emergency-denied": "Only a platform administrator can open emergency access. The attempt is recorded in the audit log.",
                "step-up-cancelled": "Nothing happened. The action needs a fresh authenticator code.",
              }[securityState]}</span></div></div>}

              {approvalState === "approved" ? (
                <div className="approval-result" role="status"><div><Check size={18} /></div><span><strong>Simulated action approved</strong>Maker-checker complete · {auditId}</span></div>
              ) : approvalState === "reviewing" ? (
                <div className="approval-review">
                  <div><span>Initiated by</span><strong>R. Singh · Risk Treasury</strong></div>
                  <div><span>Approver</span><strong>{principal.name} (you)</strong></div>
                  <button type="button" onClick={() => void confirmStepUp()}><LockKeyhole size={15} />Confirm with step-up MFA</button>
                  <button className="button-secondary" type="button" onClick={() => setApprovalState("idle")}>Cancel</button>
                </div>
              ) : (
                <div className="ai-actions">
                  <button type="button" onClick={requestGovernedAction}>{canInitiateHedge ? <ShieldCheck size={16} /> : <LockKeyhole size={16} />}{canInitiateHedge ? scenario.recommendation.action : `Test denied action · ${principal.roles.join("/")}`}</button>
                  <button className="button-secondary" type="button">Open evidence pack</button>
                  <span>No action executes without approval</span>
                </div>
              )}
            </section>

            <aside className="audit-panel">
              <div className="section-heading"><div><span className="section-kicker">Control assurance</span><h2>Decision lineage</h2></div><CircleDollarSign size={20} /></div>
              <ol className="timeline">
                <li><span className="timeline-mark timeline-mark--done"><Check size={12} /></span><div><strong>Inputs validated</strong><span>Licence class · freshness · conflicts</span><time>16:45:02</time></div></li>
                <li><span className="timeline-mark timeline-mark--done"><Check size={12} /></span><div><strong>Rules evaluated</strong><span>Policy set RULE-09 v1.2</span><time>16:45:03</time></div></li>
                <li><span className="timeline-mark timeline-mark--ai"><Sparkles size={12} /></span><div><strong>AI recommendation</strong><span>Citations and confidence attached</span><time>16:45:04</time></div></li>
                <li><span className={`timeline-mark ${approvalState === "approved" ? "timeline-mark--done" : ""}`}>{approvalState === "approved" ? <Check size={12} /> : "4"}</span><div><strong>Human governance</strong><span>{approvalState === "approved" ? "Different approver verified" : "Awaiting maker-checker"}</span><time>{approvalState === "approved" ? "16:46:18" : "Pending"}</time></div></li>
              </ol>
              <div className="audit-id"><span>Audit record</span><strong>{auditId}</strong></div>
              <button className="audit-link" type="button">View complete lineage <span>→</span></button>
              <button className="audit-link" type="button" onClick={() => void demonstrateBreakGlassBoundary()}>Test break-glass boundary <span>→</span></button>
              <button className="audit-link" type="button" onClick={() => void requestEmergencyAccess()}>Request emergency access <span>→</span></button>
            </aside>
          </div>

          <footer className="demo-footer"><span><PanelLeftClose size={14} /> Advanced operations</span><span>Sandbox · no live partner dependency or money movement</span><span>{scenarioReady.evidenceId} · {scenarioReady.scenarioId} v{scenarioReady.scenarioVersion}</span></footer>
        </div>
        </details>
        </>}
      </main>
      <SessionTimer />
      {stepUpDialog}
    </div>
  );
}
