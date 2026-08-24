"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowRight, BadgeCheck, CircleDollarSign, FileCheck2, LockKeyhole, MailCheck, ShieldCheck, Sparkles, UserRoundSearch, Users, X } from "lucide-react";
import { authorize, type Environment, type Principal } from "@fuelcap/authz";
import { customerDirectoryTotals, customerOwedMinor, customersForOrganisation, type CustomerRecord } from "@fuelcap/demo-data/customers";

type ReviewState = "idle" | "denied" | "submitted";
type EvidenceSection = "eligibility" | "funds" | "protection" | "communications" | "ai";

function money(minor: number, currency: CustomerRecord["currency"]) {
  return new Intl.NumberFormat(currency === "CAD" ? "en-CA" : "en-US", { style: "currency", currency }).format(minor / 100);
}

export function CustomerWorkspace({ organisationId, principal, environment }: { organisationId: string; principal: Principal; environment: Environment }) {
  const customers = useMemo(() => customersForOrganisation(organisationId), [organisationId]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(customers[0]?.customerId ?? null);
  const [reviewState, setReviewState] = useState<ReviewState>("idle");
  const [evidenceSection, setEvidenceSection] = useState<EvidenceSection | null>(null);
  const drawerRef = useRef<HTMLElement | null>(null);
  const evidenceTriggerRef = useRef<HTMLElement | null>(null);
  const selectedCustomer = customers.find(({ customerId }) => customerId === selectedCustomerId) ?? customers[0] ?? null;
  const totals = customerDirectoryTotals(customers);

  function requestReview() {
    const decision = authorize({ principal, environment, activeOrganisationId: organisationId, workspace: "customers", verb: "initiate" });
    setReviewState(decision.allowed ? "submitted" : "denied");
  }

  function openEvidence(section: EvidenceSection) {
    if (document.activeElement instanceof HTMLElement) evidenceTriggerRef.current = document.activeElement;
    setEvidenceSection(section);
  }

  function closeEvidence() {
    setEvidenceSection(null);
    requestAnimationFrame(() => evidenceTriggerRef.current?.focus());
  }

  useEffect(() => {
    if (!evidenceSection) return;
    const drawer = drawerRef.current;
    const previousOverflow = document.body.style.overflow;
    const focusable = () => Array.from(drawer?.querySelectorAll<HTMLElement>('button, [href], [tabindex]:not([tabindex="-1"])') ?? []);
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => focusable()[0]?.focus());
    function containFocus(event: KeyboardEvent) {
      if (event.key === "Escape") { event.preventDefault(); closeEvidence(); return; }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", containFocus);
    return () => { document.removeEventListener("keydown", containFocus); document.body.style.overflow = previousOverflow; };
  }, [evidenceSection]);

  if (!selectedCustomer) {
    return <div className="workspace-wrap"><div className="workspace-empty"><UserRoundSearch size={26} /><h1>Select a customer organisation</h1><p>The FuelCap service organisation does not silently aggregate customer records. Switch to Alex Morgan, Mina Laurent or Northstar Fleet Services to inspect an organisation-scoped customer view.</p><span>Tenant context enforced · cross-organisation records excluded</span></div></div>;
  }

  const eligiblePercentage = totals.customerCount ? Math.round(totals.eligibleCount / totals.customerCount * 100) : 0;
  const evidenceHeading = evidenceSection === "eligibility" ? selectedCustomer.eligibilityReason
    : evidenceSection === "funds" ? "Customer-owned value is fully accounted for"
      : evidenceSection === "protection" ? (selectedCustomer.evidence.protectionId ? "Protection terms and lifecycle" : "No active protection while review is open")
        : evidenceSection === "communications" ? selectedCustomer.lastCommunication
          : selectedCustomer.eligibility === "ELIGIBLE" ? "No intervention recommended" : "Open an evidence-backed eligibility review";

  return <div className="workspace-wrap customer-workspace">
    <section className="workspace-heading"><div><span className="demo-badge"><ShieldCheck size={13} /> Demonstrator data</span><h1>Customers</h1><p>Identity, eligibility, customer funds, protection, cases and communications in one organisation-scoped operational view.</p></div><div className="workspace-version">Scenario {selectedCustomer.scenarioId} · v{selectedCustomer.scenarioVersion}</div></section>
    <section className="customer-summary">
      <article><Users size={17} /><span>Customers</span><strong>{totals.customerCount}</strong><small>{selectedCustomer.segment === "B2C" ? "Personal organisation" : "Fleet-associated members"}</small></article>
      <article><BadgeCheck size={17} /><span>Eligible</span><strong>{eligiblePercentage}%</strong><small>{totals.attentionCount} need attention</small></article>
      <article><CircleDollarSign size={17} /><span>Customer owed</span><strong>{money(totals.customerOwedMinor, selectedCustomer.currency)}</strong><small>Available + reserved + refund payable</small></article>
      <article><AlertTriangle size={17} /><span>Open cases</span><strong>{totals.openCases}</strong><small>{totals.protectedVolumeGallons} gal protected</small></article>
    </section>
    <div className="customer-layout">
      <section className="customer-directory-panel"><div className="section-heading"><div><span className="section-kicker">Customer directory</span><h2>Organisation members</h2></div><span className="tenant-chip">{organisationId}</span></div><div className="customer-list">{customers.map((customer) => <button key={customer.customerId} type="button" className={`customer-list-item ${customer.customerId === selectedCustomer.customerId ? "customer-list-item--active" : ""}`} onClick={() => { setSelectedCustomerId(customer.customerId); setReviewState("idle"); setEvidenceSection(null); }}><span className="customer-avatar">{customer.name.split(" ").map((part) => part[0]).join("")}</span><span><strong>{customer.name}</strong><small>{customer.email}</small><small>{customer.membership}</small></span><span className={`customer-state customer-state--${customer.accountState.toLowerCase()}`}>{customer.accountState}</span><ArrowRight size={15} /></button>)}</div></section>
      <section className="customer-detail-panel">
        <div className="customer-detail-heading"><div><span className="section-kicker">Customer profile</span><h2>{selectedCustomer.name}</h2><p>{selectedCustomer.customerId} · {selectedCustomer.market} · {selectedCustomer.segment}</p></div><span className={`eligibility-pill eligibility-pill--${selectedCustomer.eligibility.toLowerCase()}`}>{selectedCustomer.eligibility === "ELIGIBLE" ? <BadgeCheck size={14} /> : <AlertTriangle size={14} />}{selectedCustomer.eligibility.replaceAll("_", " ")}</span></div>
        <div className="customer-detail-grid">
          <button type="button" onClick={() => openEvidence("eligibility")}><span>Eligibility evidence</span><strong>{selectedCustomer.eligibilityReason}</strong><small>Freshness · {selectedCustomer.freshness}</small></button>
          <button type="button" onClick={() => openEvidence("protection")}><span>Protected volume</span><strong>{selectedCustomer.protectedVolumeGallons} gal</strong><small>Exact product/scope matching</small></button>
          <button type="button" onClick={() => openEvidence("funds")}><span>Available balance</span><strong>{money(selectedCustomer.availableMinor, selectedCustomer.currency)}</strong><small>Unprotected and available</small></button>
          <button type="button" onClick={() => openEvidence("funds")}><span>Reserved balance</span><strong>{money(selectedCustomer.reservedMinor, selectedCustomer.currency)}</strong><small>Locked cost for active protection</small></button>
          <button type="button" onClick={() => openEvidence("funds")}><span>Refund payable</span><strong>{money(selectedCustomer.refundPayableMinor, selectedCustomer.currency)}</strong><small>Customer liability</small></button>
          <button type="button" onClick={() => openEvidence("funds")}><span>In flight</span><strong>{money(selectedCustomer.inFlightMinor, selectedCustomer.currency)}</strong><small>Safeguarding reconciliation input</small></button>
        </div>
        <button type="button" className="customer-invariant" onClick={() => openEvidence("funds")}><FileCheck2 size={17} /><span><strong>Customer value accounted for</strong>{money(customerOwedMinor(selectedCustomer), selectedCustomer.currency)} customer owed · no value disappears</span></button>
        <button type="button" className="customer-communication" onClick={() => openEvidence("communications")}><MailCheck size={17} /><span><strong>{selectedCustomer.lastCommunication}</strong>{selectedCustomer.communicationState.replaceAll("_", " ")} · simulated delivery evidence</span></button>
        <section className="customer-ai-brief"><Sparkles size={18} /><button type="button" className="customer-ai-copy" onClick={() => openEvidence("ai")}><span className="section-kicker">Customer Resolution Copilot · cited</span><strong>{selectedCustomer.eligibility === "ELIGIBLE" ? "No intervention recommended" : "Open an evidence-backed eligibility review"}</strong><p>{selectedCustomer.eligibility === "ELIGIBLE" ? "Identity, funds and communications are current. Continue monitoring under the selected scenario." : "Customer value is available and no protection was silently repurchased. Route the evidence to a different Compliance approver."}</p></button><span>Confidence {selectedCustomer.eligibility === "ELIGIBLE" ? "94%" : "89%"} · inspect citations</span></section>
        {reviewState !== "idle" && <div className={`customer-review-result customer-review-result--${reviewState}`} role="status"><strong>{reviewState === "submitted" ? "Review request submitted" : "Permission denied"}</strong><span>{reviewState === "submitted" ? "A different Compliance approver is required; no eligibility or funds changed." : `${principal.roles.join("/")} cannot initiate this action under the active policy.`}</span></div>}
        <div className="customer-actions"><button type="button" onClick={requestReview}>{selectedCustomer.eligibility === "ELIGIBLE" ? "Request profile review" : "Request eligibility review"}</button><span>No direct profile, eligibility or ledger mutation</span></div>
      </section>
    </div>
    {evidenceSection && <><button className="evidence-backdrop" type="button" aria-label="Close customer evidence" onClick={closeEvidence} /><aside ref={drawerRef} className="evidence-drawer customer-evidence-drawer" role="dialog" aria-modal="true" aria-label={`${selectedCustomer.name} ${evidenceSection} evidence`}>
      <div className="evidence-drawer__heading"><div><span className="section-kicker">Customer evidence · read only</span><h2>{selectedCustomer.name}</h2></div><button className="icon-button" type="button" onClick={closeEvidence} aria-label="Close customer evidence"><X size={18} /></button></div>
      <div className="customer-evidence-context"><span>{evidenceSection}</span><strong>{evidenceHeading}</strong><p>{selectedCustomer.customerId} · {selectedCustomer.organisationId}</p></div>
      <dl className="evidence-facts"><div><dt>Decision</dt><dd>{selectedCustomer.evidence.eligibilityDecisionId}</dd></div><div><dt>Decision version</dt><dd>{selectedCustomer.evidence.eligibilityDecisionVersion}</dd></div><div><dt>Rule version</dt><dd>{selectedCustomer.evidence.ruleVersion}</dd></div><div><dt>Control owner</dt><dd>{selectedCustomer.evidence.controlOwner}</dd></div><div><dt>Observed at</dt><dd>{selectedCustomer.evidence.observedAt}</dd></div><div><dt>Provenance</dt><dd>{selectedCustomer.provenance} · demonstrator</dd></div></dl>
      {evidenceSection === "eligibility" && <section className="customer-evidence-section"><span className="section-kicker">Reason codes</span>{selectedCustomer.evidence.reasonCodes.map((code) => <code key={code}>{code}</code>)}</section>}
      {evidenceSection === "funds" && <section className="customer-evidence-section customer-funds-evidence"><span className="section-kicker">Safeguarding components</span><div><span>Available</span><strong>{money(selectedCustomer.availableMinor, selectedCustomer.currency)}</strong></div><div><span>Reserved</span><strong>{money(selectedCustomer.reservedMinor, selectedCustomer.currency)}</strong></div><div><span>Refund payable</span><strong>{money(selectedCustomer.refundPayableMinor, selectedCustomer.currency)}</strong></div><div><span>In flight</span><strong>{money(selectedCustomer.inFlightMinor, selectedCustomer.currency)}</strong></div></section>}
      {evidenceSection === "protection" && <section className="customer-evidence-section customer-protection-evidence"><span className="section-kicker">Protection record</span><div><span>Protection ID</span><strong>{selectedCustomer.evidence.protectionId ?? "No active protection"}</strong></div><div><span>Reference price</span><strong>{selectedCustomer.evidence.referencePriceMinorPerGallon === null ? "Not applicable" : `${money(selectedCustomer.evidence.referencePriceMinorPerGallon, selectedCustomer.currency)}/gal`}</strong></div><div><span>Quantity</span><strong>{selectedCustomer.evidence.protectedQuantity4dp} gal</strong></div><div><span>Protection charge</span><strong>{money(selectedCustomer.evidence.protectionChargeMinor, selectedCustomer.currency)}</strong></div><div><span>Expiry</span><strong>{selectedCustomer.evidence.protectionExpiresAt ?? "Not applicable"}</strong></div><div><span>Rollover</span><strong>{selectedCustomer.evidence.rolloverState.replaceAll("_", " ")}</strong></div><p>{selectedCustomer.evidence.productScope}</p></section>}
      {evidenceSection === "communications" && <section className="customer-evidence-section"><span className="section-kicker">Communication evidence</span><strong>{selectedCustomer.lastCommunication}</strong><p>{selectedCustomer.communicationState.replaceAll("_", " ")} · simulated delivery only · no live provider dependency</p></section>}
      {evidenceSection === "ai" && <section className="customer-evidence-section"><span className="section-kicker">Cited recommendation inputs</span><code>{selectedCustomer.evidence.eligibilityDecisionId}</code><code>{selectedCustomer.evidence.ruleVersion}</code>{selectedCustomer.evidence.caseId && <code>{selectedCustomer.evidence.caseId}</code>}<p>Recommendation only. Confidence floor passed; no autonomous customer change or contact.</p></section>}
      <div className="evidence-drawer__lineage"><FileCheck2 size={16} /><span>Scenario manifest → customer contract → decision → case/action → audit record</span><strong>{selectedCustomer.evidence.auditRecordId}</strong></div>
      <section className="customer-audit"><div className="section-heading"><div><span className="section-kicker">Immutable history</span><h3>Audit trail</h3></div><LockKeyhole size={17} /></div><ol className="timeline">{selectedCustomer.evidence.auditTrail.map((event) => <li key={event.eventId}><span className="timeline-mark timeline-mark--done">✓</span><div><strong>{event.event}</strong><span>{event.actor} · {event.outcome}</span><time>{event.occurredAt}</time></div></li>)}{reviewState === "submitted" && <li><span className="timeline-mark">4</span><div><strong>Review requested</strong><span>{principal.name} · awaiting a different Compliance approver</span><time>Deterministic scenario clock</time></div></li>}</ol></section>
      <div className="customer-evidence-boundary"><LockKeyhole size={15} /><span>Read only · no evidence deletion, pricing fabrication or eligibility override</span></div>
    </aside></>}
    <footer className="demo-footer"><span>Provenance · {selectedCustomer.provenance}</span><span>Organisation-scoped · {organisationId}</span><span>Scenario contract · {selectedCustomer.scenarioId}@{selectedCustomer.scenarioVersion}</span></footer>
  </div>;
}
