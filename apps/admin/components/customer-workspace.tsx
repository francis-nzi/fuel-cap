"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, BadgeCheck, CircleDollarSign, FileCheck2, MailCheck, ShieldCheck, Sparkles, UserRoundSearch, Users } from "lucide-react";
import { authorize, type Environment, type Principal } from "@fuelcap/authz";
import { customerDirectoryTotals, customerOwedMinor, customersForOrganisation, type CustomerRecord } from "@fuelcap/demo-data/customers";

type ReviewState = "idle" | "denied" | "submitted";

function money(minor: number, currency: CustomerRecord["currency"]) {
  return new Intl.NumberFormat(currency === "CAD" ? "en-CA" : "en-US", { style: "currency", currency }).format(minor / 100);
}

export function CustomerWorkspace({ organisationId, principal, environment }: { organisationId: string; principal: Principal; environment: Environment }) {
  const customers = useMemo(() => customersForOrganisation(organisationId), [organisationId]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(customers[0]?.customerId ?? null);
  const [reviewState, setReviewState] = useState<ReviewState>("idle");
  const selectedCustomer = customers.find(({ customerId }) => customerId === selectedCustomerId) ?? customers[0] ?? null;
  const totals = customerDirectoryTotals(customers);

  function requestReview() {
    const decision = authorize({ principal, environment, activeOrganisationId: organisationId, workspace: "customers", verb: "initiate" });
    setReviewState(decision.allowed ? "submitted" : "denied");
  }

  if (!selectedCustomer) {
    return (
      <div className="workspace-wrap">
        <div className="workspace-empty">
          <UserRoundSearch size={26} />
          <h1>Select a customer organisation</h1>
          <p>The FuelCap service organisation does not silently aggregate customer records. Switch to Alex Morgan, Mina Laurent or Northstar Fleet Services to inspect an organisation-scoped customer view.</p>
          <span>Tenant context enforced · cross-organisation records excluded</span>
        </div>
      </div>
    );
  }

  const eligiblePercentage = totals.customerCount ? Math.round(totals.eligibleCount / totals.customerCount * 100) : 0;

  return (
    <div className="workspace-wrap customer-workspace">
      <section className="workspace-heading">
        <div>
          <span className="demo-badge"><ShieldCheck size={13} /> Demonstrator data</span>
          <h1>Customers</h1>
          <p>Identity, eligibility, customer funds, protection, cases and communications in one organisation-scoped operational view.</p>
        </div>
        <div className="workspace-version">Scenario {selectedCustomer.scenarioId} · v{selectedCustomer.scenarioVersion}</div>
      </section>

      <section className="customer-summary">
        <article><Users size={17} /><span>Customers</span><strong>{totals.customerCount}</strong><small>{selectedCustomer.segment === "B2C" ? "Personal organisation" : "Fleet-associated members"}</small></article>
        <article><BadgeCheck size={17} /><span>Eligible</span><strong>{eligiblePercentage}%</strong><small>{totals.attentionCount} need attention</small></article>
        <article><CircleDollarSign size={17} /><span>Customer owed</span><strong>{money(totals.customerOwedMinor, selectedCustomer.currency)}</strong><small>Available + reserved + refund payable</small></article>
        <article><AlertTriangle size={17} /><span>Open cases</span><strong>{totals.openCases}</strong><small>{totals.protectedVolumeGallons} gal protected</small></article>
      </section>

      <div className="customer-layout">
        <section className="customer-directory-panel">
          <div className="section-heading"><div><span className="section-kicker">Customer directory</span><h2>Organisation members</h2></div><span className="tenant-chip">{organisationId}</span></div>
          <div className="customer-list">
            {customers.map((customer) => <button key={customer.customerId} type="button" className={`customer-list-item ${customer.customerId === selectedCustomer.customerId ? "customer-list-item--active" : ""}`} onClick={() => { setSelectedCustomerId(customer.customerId); setReviewState("idle"); }}>
              <span className="customer-avatar">{customer.name.split(" ").map((part) => part[0]).join("")}</span>
              <span><strong>{customer.name}</strong><small>{customer.email}</small><small>{customer.membership}</small></span>
              <span className={`customer-state customer-state--${customer.accountState.toLowerCase()}`}>{customer.accountState}</span>
              <ArrowRight size={15} />
            </button>)}
          </div>
        </section>

        <section className="customer-detail-panel">
          <div className="customer-detail-heading">
            <div><span className="section-kicker">Customer profile</span><h2>{selectedCustomer.name}</h2><p>{selectedCustomer.customerId} · {selectedCustomer.market} · {selectedCustomer.segment}</p></div>
            <span className={`eligibility-pill eligibility-pill--${selectedCustomer.eligibility.toLowerCase()}`}>{selectedCustomer.eligibility === "ELIGIBLE" ? <BadgeCheck size={14} /> : <AlertTriangle size={14} />}{selectedCustomer.eligibility.replaceAll("_", " ")}</span>
          </div>

          <div className="customer-detail-grid">
            <article><span>Eligibility evidence</span><strong>{selectedCustomer.eligibilityReason}</strong><small>Freshness · {selectedCustomer.freshness}</small></article>
            <article><span>Protected volume</span><strong>{selectedCustomer.protectedVolumeGallons} gal</strong><small>Exact product/scope matching</small></article>
            <article><span>Available balance</span><strong>{money(selectedCustomer.availableMinor, selectedCustomer.currency)}</strong><small>Unprotected and available</small></article>
            <article><span>Reserved balance</span><strong>{money(selectedCustomer.reservedMinor, selectedCustomer.currency)}</strong><small>Locked cost for active protection</small></article>
            <article><span>Refund payable</span><strong>{money(selectedCustomer.refundPayableMinor, selectedCustomer.currency)}</strong><small>Customer liability</small></article>
            <article><span>In flight</span><strong>{money(selectedCustomer.inFlightMinor, selectedCustomer.currency)}</strong><small>Safeguarding reconciliation input</small></article>
          </div>

          <div className="customer-invariant"><FileCheck2 size={17} /><span><strong>Customer value accounted for</strong>{money(customerOwedMinor(selectedCustomer), selectedCustomer.currency)} customer owed · no value disappears</span></div>
          <div className="customer-communication"><MailCheck size={17} /><span><strong>{selectedCustomer.lastCommunication}</strong>{selectedCustomer.communicationState.replaceAll("_", " ")} · simulated delivery evidence</span></div>

          <section className="customer-ai-brief">
            <Sparkles size={18} />
            <div><span className="section-kicker">Customer Resolution Copilot · cited</span><strong>{selectedCustomer.eligibility === "ELIGIBLE" ? "No intervention recommended" : "Open an evidence-backed eligibility review"}</strong><p>{selectedCustomer.eligibility === "ELIGIBLE" ? "Identity, funds and communications are current. Continue monitoring under the selected scenario." : "Customer value is available and no protection was silently repurchased. Route the evidence to a different Compliance approver."}</p></div>
            <span>Confidence {selectedCustomer.eligibility === "ELIGIBLE" ? "94%" : "89%"}</span>
          </section>

          {reviewState !== "idle" && <div className={`customer-review-result customer-review-result--${reviewState}`} role="status"><strong>{reviewState === "submitted" ? "Review request submitted" : "Permission denied"}</strong><span>{reviewState === "submitted" ? "A different Compliance approver is required; no eligibility or funds changed." : `${principal.roles.join("/")} cannot initiate this action under the active policy.`}</span></div>}
          <div className="customer-actions"><button type="button" onClick={requestReview}>{selectedCustomer.eligibility === "ELIGIBLE" ? "Request profile review" : "Request eligibility review"}</button><span>No direct profile, eligibility or ledger mutation</span></div>
        </section>
      </div>

      <footer className="demo-footer"><span>Provenance · {selectedCustomer.provenance}</span><span>Organisation-scoped · {organisationId}</span><span>Scenario contract · {selectedCustomer.scenarioId}@{selectedCustomer.scenarioVersion}</span></footer>
    </div>
  );
}
