"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Database, FileCheck2, Gauge, LockKeyhole, RadioTower, ShieldCheck, Sparkles, X } from "lucide-react";
import { authorize, type Environment, type Principal } from "@fuelcap/authz";
import { canonicalPricingDecision, pricingDecisionIsInternallyValid, type PricingObservation } from "@fuelcap/demo-data/pricing-data";
import { assessPricingControl, governPricingRecommendation, type PricingEngineSnapshot } from "@fuelcap/pricing-control";
import { EuBenchmarkWorkspace } from "@/components/eu-benchmark-workspace";
import { BasisModelWorkspace } from "@/components/basis-model-workspace";

const decision = canonicalPricingDecision;
const price = (minor4dp: number) => `$${(minor4dp / 10000).toFixed(3)}/gal`;
const rejectedObservation = decision.observations.find(({ decision: outcome }) => outcome === "REJECTED")!;
const controlSnapshot: PricingEngineSnapshot = { snapshotId: "PRICING-SNAPSHOT-TX-1400", scenarioVersion: decision.scenarioVersion, observedAt: decision.decidedAt, evidenceReferences: decision.observations.map(({ observationId }) => observationId), ingestion: { version: "pricing-ingestion@1.0.0", acceptedCount: decision.observations.length, quarantinedCount: 0, freshestAgeSeconds: Math.min(...decision.observations.map(({ freshnessSeconds }) => freshnessSeconds)), maximumAgeSeconds: 300 }, benchmark: { version: "benchmark-engine@1.0.0", decisionId: decision.decisionId, status: pricingDecisionIsInternallyValid(decision) ? "PUBLISHED" : "BLOCKED", coverageBps: Math.round(decision.coveragePercent * 100), minimumCoverageBps: 8_000, dispersionBps: 470, maximumDispersionBps: 500 }, quote: { version: "quote-engine@1.0.0", status: pricingDecisionIsInternallyValid(decision) ? "QUOTED" : "UNAVAILABLE", reasonCode: pricingDecisionIsInternallyValid(decision) ? "QUOTE_CREATED" : "BENCHMARK_UNAVAILABLE" }, spread: { version: "spread-engine@1.0.0", componentTotalBps: 230, publishedTotalBps: 230 }, fx: { version: "fx-engine@1.0.0", valid: true, stalePairCount: 0 }, rules: { version: "rules-engine@1.0.0", validationPassed: true, regressionPassed: true } };
const controlAssessment = assessPricingControl("PRICING-ASSESSMENT-TX-1400", controlSnapshot, decision.decidedAt);
const copilotRecommendation = governPricingRecommendation({ recommendationId: "PRICING-REC-TX-1400", summary: "Keep the secondary station candidate rejected", proposedAction: "DRAFT_SOURCE_CHANGE", confidenceBps: 9_400, citations: [decision.selectedObservationId, rejectedObservation.observationId], modelVersion: "pricing-recommender@0.1-demo" }, controlAssessment, controlSnapshot);

export function PricingDataWorkspace({ organisationId, principal, environment }: { organisationId: string; principal: Principal; environment: Environment }) {
  const [selectedObservation, setSelectedObservation] = useState<PricingObservation | null>(null);
  const [proposalState, setProposalState] = useState<"idle" | "denied" | "submitted">("idle");
  const [liveFeed, setLiveFeed] = useState<{ live: boolean; stationCount: number; providerCount: number; freshestObservedAt?: string; freshestAgeMinutes?: number | null; batches?: { prices: number; forecourts: number }; minimumPrice?: { unitPrice: number; label: string }; maximumPrice?: { unitPrice: number; label: string }; leadingProviders?: Array<{ label: string; stationCount: number; unitPrice: number }> } | null>(null);
  const drawerRef = useRef<HTMLElement | null>(null);
  const conflicts = decision.observations.filter(({ decision }) => decision === "REJECTED").length;
  const quoteEligible = pricingDecisionIsInternallyValid(decision);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/live-pricing", { cache: "no-store" }).then(async (response) => response.ok ? response.json() : null).then((feed) => { if (!cancelled && feed) setLiveFeed(feed); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!selectedObservation) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => drawerRef.current?.querySelector<HTMLElement>("button")?.focus());
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setSelectedObservation(null); };
    document.addEventListener("keydown", close);
    return () => { document.removeEventListener("keydown", close); document.body.style.overflow = previousOverflow; };
  }, [selectedObservation]);

  if (organisationId !== "org-fuelcap-global") return <div className="workspace-wrap"><div className="workspace-empty"><Database size={25} /><h1>Pricing decisions are platform-scoped</h1><p>Switch to FuelCap Global to inspect canonical market observations. Customer and fleet tenant contexts never inherit platform configuration records.</p><span>Context boundary enforced · no silent market relabelling</span></div></div>;

  function draftSourceChange() {
    const auth = authorize({ principal, environment, activeOrganisationId: organisationId, workspace: "pricing-data", verb: "initiate" });
    setProposalState(auth.allowed ? "submitted" : "denied");
  }

  return <div className="workspace-wrap pricing-workspace">
    <section className="workspace-heading"><div><span className="demo-badge"><ShieldCheck size={13} /> Demonstrator data</span><h1>Pricing Data</h1><p>Immutable observations become one licence-compliant canonical decision through deterministic validation.</p></div><div className="workspace-version">Scenario {decision.scenarioId} · v{decision.scenarioVersion}</div></section>
    <section className="pricing-summary">
      <article><RadioTower size={17} /><span>UK live feed</span><strong>{liveFeed?.live ? "CONNECTED" : "CHECKING"}</strong><small>{liveFeed ? `${liveFeed.stationCount.toLocaleString()} E10 stations` : "Retrieving governed status"}</small></article>
      <article><Gauge size={17} /><span>Freshest UK observation</span><strong>{liveFeed?.freshestAgeMinutes != null ? `${liveFeed.freshestAgeMinutes} min` : "—"}</strong><small>{liveFeed?.batches ? `${liveFeed.batches.prices} price · ${liveFeed.batches.forecourts} forecourt batches` : "UK Fuel Finder"}</small></article>
      <article><CheckCircle2 size={17} /><span>Quote-eligible coverage</span><strong>{decision.coveragePercent}%</strong><small>Exact grade · tax included</small></article>
      <article><AlertTriangle size={17} /><span>Preserved conflicts</span><strong>{conflicts}</strong><small>Rejected, never overwritten</small></article>
    </section>

    {liveFeed?.live && <section className="canonical-decision-panel" aria-label="Live UK Fuel Finder operating picture">
      <div><span className="section-kicker">Live business pricing · United Kingdom</span><h2>{liveFeed.stationCount.toLocaleString()} reporting forecourts · {liveFeed.providerCount} brands</h2><p>Customer station, brand and nationwide protection now use the same official E10 operating picture exposed to business operations.</p></div>
      <div className="canonical-price"><span>Observed market range</span><strong>£{liveFeed.minimumPrice?.unitPrice.toFixed(3)}–£{liveFeed.maximumPrice?.unitPrice.toFixed(3)}/L</strong><small>{liveFeed.minimumPrice?.label.split(" - ")[0]} to {liveFeed.maximumPrice?.label.split(" - ")[0]}</small></div>
      <div className="eligibility-stack"><span className="pricing-eligible">LIVE SOURCE</span><small>Display · pricing input</small></div>
    </section>}

    <section className="canonical-decision-panel">
      <div><span className="section-kicker">Canonical decision</span><h2>{decision.market} · {decision.grade}</h2><p>Selected from actual pump evidence; benchmark and simulation inputs remain visibly constrained by licence class.</p></div>
      <div className="canonical-price"><span>Reference price</span><strong>{price(decision.canonicalPriceMinor4dp)}</strong><small>{decision.decidedAt.replace("T", " · ").replace("Z", " UTC")}</small></div>
      <div className="eligibility-stack"><span className={quoteEligible ? "pricing-eligible" : "pricing-blocked"}>{quoteEligible ? "Quote eligible" : "Not quote eligible"}</span><small>Display · Quote · Settlement</small></div>
    </section>

    <div className="pricing-layout">
      <section className="pricing-candidates-panel"><div className="section-heading"><div><span className="section-kicker">Decision candidates</span><h2>Observation evidence</h2></div><span className="tenant-chip">{decision.algorithmVersion}</span></div><div className="pricing-candidate-list">{decision.observations.map((observation) => <button type="button" key={observation.observationId} className={`pricing-candidate pricing-candidate--${observation.decision.toLowerCase()}`} onClick={() => setSelectedObservation(observation)}><span><strong>{observation.source}</strong><small>{observation.observationType.replaceAll("_", " ")} · {observation.licenceClass.replaceAll("_", " ")}</small></span><span><strong>{price(observation.priceMinor4dp)}</strong><small>{observation.freshnessSeconds} sec · {observation.provenance}</small></span><b>{observation.decision}</b><i>Inspect</i></button>)}</div></section>
      <aside className="pricing-controls-panel"><span className="section-kicker">Control state</span><h2>Eligibility and use</h2><dl><div><dt>Decision version</dt><dd>{decision.decisionVersion}</dd></div><div><dt>Algorithm</dt><dd>{decision.algorithmVersion}</dd></div><div><dt>Selected input</dt><dd>{decision.selectedObservationId}</dd></div><div><dt>Currency / unit</dt><dd>{decision.currency} / {decision.unit}</dd></div><div><dt>Unresolved conflicts</dt><dd>0</dd></div><div><dt>Rule 18 route</dt><dd>Armed if invalid</dd></div></dl><div className="pricing-integrity"><LockKeyhole size={15} /><span>Deterministic validation decides. No operator or AI can fabricate an eligible quote.</span></div></aside>
    </div>

    <section className="pricing-copilot"><Sparkles size={19} /><div><span className="section-kicker">Pricing Integrity Copilot · {copilotRecommendation.status.toLowerCase()}</span><h2>{copilotRecommendation.summary}</h2><p>The +4.7% variance breaches regional tolerance. Deterministic controls remain authoritative; this recommendation can only draft a governed change.</p><small>Sources · {copilotRecommendation.citations.join(" · ")} · Confidence {(copilotRecommendation.confidenceBps / 100).toFixed(0)}% · {controlAssessment.state}</small></div><button type="button" onClick={draftSourceChange} disabled={copilotRecommendation.status !== "SUPPORTED"}>Draft source change</button></section>
    {proposalState !== "idle" && <div className={`customer-review-result customer-review-result--${proposalState}`} role="status"><strong>{proposalState === "submitted" ? "Source proposal drafted" : "Permission denied"}</strong><span>{proposalState === "submitted" ? "A different authorised approver and step-up MFA are required; no source configuration changed." : `${principal.roles.join("/")} cannot initiate this governed action.`}</span></div>}
    <EuBenchmarkWorkspace organisationId={organisationId} principal={principal} environment={environment} />
    <BasisModelWorkspace organisationId={organisationId} principal={principal} environment={environment} />

    {selectedObservation && <><button className="evidence-backdrop" type="button" aria-label="Close pricing evidence" onClick={() => setSelectedObservation(null)} /><aside ref={drawerRef} className="evidence-drawer" role="dialog" aria-modal="true" aria-label={`${selectedObservation.source} evidence`}><div className="evidence-drawer__heading"><div><span className="section-kicker">Observation evidence · immutable</span><h2>{selectedObservation.source}</h2></div><button className="icon-button" type="button" onClick={() => setSelectedObservation(null)} aria-label="Close pricing evidence"><X size={18} /></button></div><div className="evidence-drawer__value"><span>{selectedObservation.observationType.replaceAll("_", " ")}</span><strong>{price(selectedObservation.priceMinor4dp)}</strong><p>{selectedObservation.decision} · {selectedObservation.market} · {selectedObservation.grade}</p></div><dl className="evidence-facts"><div><dt>Observation</dt><dd>{selectedObservation.observationId}</dd></div><div><dt>Observed at</dt><dd>{selectedObservation.observedAt}</dd></div><div><dt>Licence class</dt><dd>{selectedObservation.licenceClass}</dd></div><div><dt>Permitted uses</dt><dd>{selectedObservation.permittedUses.join(" · ")}</dd></div><div><dt>Normalised shape</dt><dd>{selectedObservation.currency} / {selectedObservation.unit}</dd></div><div><dt>Provenance</dt><dd>{selectedObservation.provenance} · demonstrator</dd></div></dl><div className="pricing-selection-reason"><strong>Selection record</strong><p>{selectedObservation.reason}</p></div><div className="evidence-drawer__lineage"><FileCheck2 size={16} /><span>Provider record → adapter → observation → canonical decision → eligibility → audit</span><strong>AUD-{selectedObservation.observationId}</strong></div><div className="customer-evidence-boundary"><LockKeyhole size={15} /><span>Read only · observations and rejected candidates are never overwritten or deleted.</span></div></aside></>}
    <footer className="demo-footer"><span>Provenance · {decision.provenance}</span><span>Immutable candidates · algorithm version recorded</span><span>DEC-021 integrity path armed</span></footer>
  </div>;
}
