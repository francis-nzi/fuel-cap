"use client";

import {
  Activity,
  BadgeDollarSign,
  Bot,
  Boxes,
  Building2,
  Check,
  CircleDollarSign,
  Database,
  FileCheck2,
  Gauge,
  LayoutDashboard,
  LockKeyhole,
  Menu,
  Network,
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
import { useMemo, useState } from "react";
import { AUTHZ_POLICY_VERSION, authorize, demoOrganisations, demoPrincipals, visibleWorkspaces, type Environment as AuthzEnvironment, type Workspace } from "@fuelcap/authz";
import { createScenarioRuntime, type DemoEnvironment, type ScenarioReady } from "@fuelcap/demo-data";
import { scenarioOrder, scenarios, type ScenarioId } from "@/lib/demo-data";

const workspaces: readonly { key: Workspace; label: string; icon: typeof LayoutDashboard; active?: boolean }[] = [
  { key: "control-room", label: "Control Room", icon: LayoutDashboard, active: true },
  { key: "living-operations", label: "Living Operations", icon: Network },
  { key: "customers-fleets", label: "Customers & Fleets", icon: Users },
  { key: "pricing-data", label: "Pricing Data", icon: Database },
  { key: "spread-engine", label: "Spread Engine", icon: BadgeDollarSign },
  { key: "fx-engine", label: "FX Engine", icon: RefreshCw },
  { key: "protection-hedging", label: "Protection & Hedging", icon: ShieldCheck },
  { key: "ledger-wallet", label: "Ledger & Wallet", icon: WalletCards },
  { key: "settlement-recon", label: "Settlement & Recon", icon: FileCheck2 },
  { key: "billing-xero", label: "Billing & Xero", icon: ReceiptText },
  { key: "risk-fraud-compliance", label: "Risk, Fraud & Compliance", icon: TriangleAlert },
  { key: "rules-ai-governance", label: "Rules & AI Governance", icon: Bot },
];

type ApprovalState = "idle" | "reviewing" | "approved";
type ResetState = "idle" | "resetting" | "ready" | "failed";

function StatusDot({ state }: { state: "healthy" | "watch" | "controlled" }) {
  return <span className={`status-dot status-dot--${state}`} aria-label={state} />;
}

export function ControlRoom() {
  const [scenarioId, setScenarioId] = useState<ScenarioId>("exposure");
  const environment: DemoEnvironment = process.env.NEXT_PUBLIC_APP_ENV === "production" ? "production" : "demo";
  const authzEnvironment: AuthzEnvironment = environment;
  const [principalId, setPrincipalId] = useState("principal-presenter");
  const [activeOrganisationId, setActiveOrganisationId] = useState("org-fuelcap-global");
  const principal = demoPrincipals.find((candidate) => candidate.principalId === principalId) ?? demoPrincipals[0];
  const memberOrganisations = demoOrganisations.filter(({ organisationId }) => principal.organisationIds.includes(organisationId));
  const allowedWorkspaceKeys = visibleWorkspaces(principal, authzEnvironment, activeOrganisationId, workspaces.map(({ key }) => key));
  const visibleNavigation = workspaces.filter(({ key }) => allowedWorkspaceKeys.includes(key));
  const canInitiateHedge = authorize({ principal, environment: authzEnvironment, activeOrganisationId, workspace: "protection-hedging", verb: "initiate" }).allowed;
  const runtime = useMemo(() => createScenarioRuntime(environment, scenarios.exposure.manifestId), [environment]);
  const [scenarioReady, setScenarioReady] = useState<ScenarioReady>(() => runtime.reset(scenarios.exposure.manifestId));
  const [resetState, setResetState] = useState<ResetState>("idle");
  const [approvalState, setApprovalState] = useState<ApprovalState>("idle");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const scenario = scenarios[scenarioId];
  const auditId = useMemo(() => `AUD-DEMO-${scenarioId.toUpperCase()}-00842`, [scenarioId]);

  function changePrincipal(nextPrincipalId: string) {
    const nextPrincipal = demoPrincipals.find((candidate) => candidate.principalId === nextPrincipalId) ?? demoPrincipals[0];
    setPrincipalId(nextPrincipal.principalId);
    if (!nextPrincipal.organisationIds.includes(activeOrganisationId)) setActiveOrganisationId(nextPrincipal.organisationIds[0]);
    setApprovalState("idle");
  }

  function changeScenario(id: ScenarioId) {
    setScenarioId(id);
    setScenarioReady(runtime.reset(scenarios[id].manifestId));
    setResetState("idle");
    setApprovalState("idle");
  }

  async function resetScenario() {
    setResetState("resetting");
    try {
      const response = await fetch("/api/demo/scenarios/reset", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": `control-room:${scenario.manifestId}:1.0.0`,
          "X-FuelCap-Demo-Role": principal.roles.includes("DP") ? "demonstrator-presenter" : principal.roles[0],
          "X-FuelCap-Demo-Principal": principal.email,
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

  return (
    <div className="admin-shell">
      <aside className={`sidebar ${mobileNavOpen ? "sidebar--open" : ""}`}>
        <div className="brand-row">
          <div className="brand-mark"><Image src="/fuelcap-mark.svg" width={26} height={28} alt="FuelCap" priority /></div>
          <div>
            <strong>FuelCap</strong>
            <span>Control Room</span>
          </div>
          <button className="icon-button sidebar-close" onClick={() => setMobileNavOpen(false)} aria-label="Close navigation"><X size={18} /></button>
        </div>

        <div className="environment-card">
          <div className="environment-card__top">
            <span className="pulse-dot" />
            <strong>Investor demonstrator</strong>
          </div>
          <span>Simulated operations · v1.0</span>
        </div>

        <nav aria-label="Admin workspaces">
          <p className="nav-label">Workspaces</p>
          <div className="nav-list">
            {visibleNavigation.map(({ label, icon: Icon, active }) => (
              <button className={`nav-item ${active ? "nav-item--active" : ""}`} key={label} type="button">
                <Icon size={17} />
                <span>{label}</span>
                {!active && <span className="nav-soon">Soon</span>}
              </button>
            ))}
          </div>
        </nav>

        <div className="sidebar-footer">
          <div className="avatar">{principal.name.split(" ").map((part) => part[0]).join("")}</div>
          <div><strong>{principal.name}</strong><span>{principal.roles.join(" · ")} · {AUTHZ_POLICY_VERSION}</span></div>
          <Settings2 size={17} />
        </div>
      </aside>

      {mobileNavOpen && <button className="nav-backdrop" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} />}

      <main className="main-canvas">
        <header className="topbar">
          <button className="icon-button mobile-menu" onClick={() => setMobileNavOpen(true)} aria-label="Open navigation"><Menu size={20} /></button>
          <div className="breadcrumb"><span>FuelCap Operations</span><span>/</span><strong>Control Room</strong></div>
          <div className="topbar-actions">
            <button className="search-button" type="button"><Search size={17} /><span>Search operations</span><kbd>⌘ K</kbd></button>
            <div className="context-switcher"><Users size={15} /><select aria-label="Demo principal" value={principal.principalId} onChange={(event) => changePrincipal(event.target.value)}>{demoPrincipals.map((candidate) => <option value={candidate.principalId} key={candidate.principalId}>{candidate.name} · {candidate.roles.join("/")}</option>)}</select></div>
            <div className="context-switcher"><Building2 size={15} /><select aria-label="Active organisation" value={activeOrganisationId} onChange={(event) => setActiveOrganisationId(event.target.value)}>{memberOrganisations.map((organisation) => <option value={organisation.organisationId} key={organisation.organisationId}>{organisation.name}</option>)}</select></div>
            <div className="top-avatar">{principal.name.split(" ").map((part) => part[0]).join("")}</div>
          </div>
        </header>

        <section className="operating-strip" aria-label="Operating status">
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
              <h1>Good morning. Here is FuelCap operating as one system.</h1>
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
              <div className="lineage-chip"><LockKeyhole size={14} /><span>Lineage complete</span><strong>DEC-021 · RULE-09</strong></div>
            </div>

            <div className="flow-grid">
              {scenario.flow.map((node, index) => (
                <article className={`flow-node flow-node--${node.state}`} key={node.key}>
                  <div className="flow-node__top"><span>{String(index + 1).padStart(2, "0")}</span><StatusDot state={node.state} /></div>
                  <p>{node.eyebrow}</p>
                  <h3>{node.title}</h3>
                  <strong>{node.value}</strong>
                  <span>{node.detail}</span>
                  {index < scenario.flow.length - 1 && <div className="flow-connector" aria-hidden="true"><span>›</span></div>}
                </article>
              ))}
            </div>

            <div className="map-footer">
              <span><Database size={14} /> Provenance: synthetic-seeded + illustrative-fixed</span>
              <span><RefreshCw size={14} /> Deterministic clock · contract {scenarioReady.contractVersion}</span>
              <span><FileCheck2 size={14} /> Rebuild verified from journal sequence</span>
            </div>
          </section>

          <div className="lower-grid">
            <section className="ai-panel">
              <div className="ai-panel__header">
                <div className="ai-orb"><Sparkles size={19} /></div>
                <div><span className="section-kicker">FuelCap intelligence</span><h2>{scenario.recommendation.title}</h2></div>
                <div className="confidence"><span>Confidence</span><strong>{scenario.recommendation.confidence}%</strong></div>
              </div>
              <p className="ai-rationale">{scenario.recommendation.rationale}</p>
              <div className="evidence-grid">
                {scenario.recommendation.evidence.map((item) => <div key={item}><Check size={14} /><span>{item}</span></div>)}
              </div>
              <div className="policy-box"><ShieldCheck size={18} /><div><strong>Policy boundary</strong><span>{scenario.recommendation.policy}</span></div></div>
              <div className="impact-row"><span>Expected impact</span><strong>{scenario.recommendation.impact}</strong></div>

              {approvalState === "approved" ? (
                <div className="approval-result" role="status"><div><Check size={18} /></div><span><strong>Simulated action approved</strong>Maker-checker complete · {auditId}</span></div>
              ) : approvalState === "reviewing" ? (
                <div className="approval-review">
                  <div><span>Initiated by</span><strong>R. Singh · Risk Treasury</strong></div>
                  <div><span>Approver</span><strong>A. Morgan · Treasury Lead</strong></div>
                  <button type="button" onClick={() => setApprovalState("approved")}><LockKeyhole size={15} />Confirm with step-up MFA</button>
                  <button className="button-secondary" type="button" onClick={() => setApprovalState("idle")}>Cancel</button>
                </div>
              ) : (
                <div className="ai-actions">
                  {canInitiateHedge ? <button type="button" onClick={() => setApprovalState("reviewing")}><ShieldCheck size={16} />{scenario.recommendation.action}</button> : <button type="button" disabled><LockKeyhole size={16} />Initiation denied for {principal.roles.join("/")}</button>}
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
            </aside>
          </div>

          <footer className="demo-footer"><span><PanelLeftClose size={14} /> Investor demonstration platform</span><span>No live partner dependency · No live money movement</span><span>{scenarioReady.evidenceId} · {scenarioReady.scenarioId} v{scenarioReady.scenarioVersion}</span></footer>
        </div>
      </main>
    </div>
  );
}
