"use client";

import { useEffect, useRef, useState } from "react";
import { Building2, CarFront, CircleAlert, FileCheck2, Gauge, LockKeyhole, ShieldCheck, Sparkles, Users, X } from "lucide-react";
import { authorize, type Environment, type Principal } from "@fuelcap/authz";
import { fleetForOrganisation, fleetProtectedGallons, fleetReservedMinor, fleetRolloversDue } from "@fuelcap/demo-data/fleet";

export function FleetWorkspace({ organisationId, principal, environment }: { organisationId: string; principal: Principal; environment: Environment }) {
  const fleet = fleetForOrganisation(organisationId);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [proposalState, setProposalState] = useState<"idle" | "denied" | "submitted">("idle");
  const drawerRef = useRef<HTMLElement | null>(null);
  const selectedVehicle = fleet?.vehicles.find(({ vehicleId }) => vehicleId === selectedVehicleId) ?? null;

  useEffect(() => {
    if (!selectedVehicle) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => drawerRef.current?.querySelector<HTMLElement>("button")?.focus());
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setSelectedVehicleId(null); };
    document.addEventListener("keydown", close);
    return () => { document.removeEventListener("keydown", close); document.body.style.overflow = previousOverflow; };
  }, [selectedVehicle]);

  if (!fleet) return <div className="workspace-wrap"><div className="workspace-empty"><Building2 size={24} /><h1>No fleet in this organisation</h1><p>Switch to Northstar Fleet Services to inspect the governed multi-vehicle scenario. Personal organisations never inherit fleet records.</p><span>Tenant boundary enforced · guessed identifiers return no records</span></div></div>;

  const protectedGallons = fleetProtectedGallons(fleet);
  const headroom = fleet.aggregateLimitGallons - protectedGallons;
  const reservedMinor = fleetReservedMinor(fleet);
  const rolloversDue = fleetRolloversDue(fleet);
  const money = (minor: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: fleet.currency }).format(minor / 100);
  function proposePolicyChange() {
    const decision = authorize({ principal, environment, activeOrganisationId: organisationId, workspace: "fleets-vehicles", verb: "initiate" });
    setProposalState(decision.allowed ? "submitted" : "denied");
  }

  return <div className="workspace-wrap fleet-workspace">
    <section className="workspace-heading"><div><span className="demo-badge"><ShieldCheck size={13} /> Demonstrator data</span><h1>{fleet.organisationName}</h1><p>Fleet protection, policy groups, assigned drivers and aggregate exposure in one organisation-scoped view.</p></div><div className="workspace-version">Scenario {fleet.scenarioId} · v{fleet.scenarioVersion}</div></section>
    <section className="fleet-summary"><article><CarFront size={17} /><span>Vehicles</span><strong>{fleet.vehicles.length}</strong><small>Across {fleet.groups.length} policy groups</small></article><article><Users size={17} /><span>Eligible vehicles</span><strong>{fleet.vehicles.filter(({ eligibility }) => eligibility === "ELIGIBLE").length}/{fleet.vehicles.length}</strong><small>{fleet.drivers.length} assigned drivers</small></article><article><Gauge size={17} /><span>Protected volume</span><strong>{protectedGallons} gal</strong><small>{headroom} gal organisation headroom</small></article><article><CircleAlert size={17} /><span>Needs review</span><strong>{fleet.vehicles.filter(({ status }) => status === "REVIEW").length}</strong><small>{rolloversDue} rollover due within 72h</small></article></section>
    <div className="fleet-layout">
      <section className="fleet-table-panel"><div className="section-heading"><div><span className="section-kicker">Vehicles and drivers</span><h2>Current assignments</h2></div><span className="tenant-chip">{fleet.organisationId}</span></div><div className="fleet-table-wrap"><table className="fleet-table"><thead><tr><th>Vehicle</th><th>Driver</th><th>Policy group</th><th>Protected</th><th>Status</th><th>Evidence</th></tr></thead><tbody>{fleet.vehicles.map((vehicle) => { const driver = fleet.drivers.find(({ driverId }) => driverId === vehicle.assignedDriverId)!; const group = fleet.groups.find(({ groupId }) => groupId === vehicle.groupId)!; return <tr key={vehicle.vehicleId}><td><strong>{vehicle.description}</strong><span>{vehicle.registration}</span></td><td><strong>{driver.name}</strong><span>{driver.email}</span></td><td><strong>{group.name}</strong><span>{group.fuelGrade} · {group.costCentre}</span></td><td><strong>{vehicle.protectedGallons} gal</strong><span>of {group.perVehicleLimitGallons} gal</span></td><td><span className={`fleet-status fleet-status--${vehicle.status.toLowerCase()}`}>{vehicle.status}</span></td><td><button className="fleet-evidence-link" type="button" onClick={() => setSelectedVehicleId(vehicle.vehicleId)}>Inspect</button></td></tr>; })}</tbody></table></div></section>
      <aside className="fleet-policy-panel"><span className="section-kicker">Group policies</span><h2>Protection controls</h2>{fleet.groups.map((group) => <article key={group.groupId}><div><strong>{group.name}</strong><span>{group.costCentre}</span></div><dl><div><dt>Exact grade</dt><dd>{group.fuelGrade}</dd></div><div><dt>Vehicle limit</dt><dd>{group.perVehicleLimitGallons} gal</dd></div><div><dt>Auto-Rollover</dt><dd>{group.rolloverPolicy === "DEFAULT_ON_WITH_NOTICE" ? "On · notice required" : "Off"}</dd></div><div><dt>Policy version</dt><dd>{group.policyVersion}</dd></div></dl></article>)}<div className="aggregate-limit"><span>Organisation aggregate</span><strong>{protectedGallons} / {fleet.aggregateLimitGallons} gal</strong><div><i style={{ width: `${protectedGallons / fleet.aggregateLimitGallons * 100}%` }} /></div><small>Limits are illustrative and governed; no live exposure.</small></div><div className="fleet-financial"><span>Reserved customer value</span><strong>{money(reservedMinor)}</strong><small>{fleet.openCases} open case · {fleet.communicationFailures} communication failures</small></div></aside>
    </div>
    <section className="fleet-copilot"><Sparkles size={19} /><div><span className="section-kicker">Fleet Protection Copilot · cited</span><h2>Review premium scope before increasing aggregate protection</h2><p>Vehicle TX-FC-3017 is the only eligibility exception. The fleet remains 15 gal below its governed aggregate limit.</p><small>Sources · FLEET-DEC-3017 · fleet-policy@1.3 · Confidence 91%</small></div><button type="button" onClick={proposePolicyChange}>Draft policy change</button></section>
    {proposalState !== "idle" && <div className={`customer-review-result customer-review-result--${proposalState}`} role="status"><strong>{proposalState === "submitted" ? "Policy proposal drafted" : "Permission denied"}</strong><span>{proposalState === "submitted" ? "A different authorised approver and step-up MFA are required; no policy changed." : `${principal.roles.join("/")} cannot initiate this governed action.`}</span></div>}
    {selectedVehicle && <><button className="evidence-backdrop" type="button" aria-label="Close fleet evidence" onClick={() => setSelectedVehicleId(null)} /><aside ref={drawerRef} className="evidence-drawer" role="dialog" aria-modal="true" aria-label={`${selectedVehicle.description} evidence`}><div className="evidence-drawer__heading"><div><span className="section-kicker">Vehicle evidence · read only</span><h2>{selectedVehicle.description}</h2></div><button className="icon-button" type="button" onClick={() => setSelectedVehicleId(null)} aria-label="Close fleet evidence"><X size={18} /></button></div><div className="evidence-drawer__value"><span>{selectedVehicle.registration}</span><strong>{selectedVehicle.protectedGallons} gal</strong><p>{selectedVehicle.eligibility.replaceAll("_", " ")} · {selectedVehicle.status}</p></div><dl className="evidence-facts"><div><dt>Decision</dt><dd>{selectedVehicle.decisionId}</dd></div><div><dt>Case</dt><dd>{selectedVehicle.caseId ?? "No open case"}</dd></div><div><dt>Reserved value</dt><dd>{money(selectedVehicle.reservedMinor)}</dd></div><div><dt>Expiry</dt><dd>{selectedVehicle.expiresAt ?? "Blocked pending review"}</dd></div><div><dt>Organisation</dt><dd>{fleet.organisationId}</dd></div><div><dt>Provenance</dt><dd>{fleet.provenance} · demonstrator</dd></div></dl><div className="evidence-drawer__lineage"><FileCheck2 size={16} /><span>Scenario → fleet contract → group policy → decision → position → audit</span><strong>AUD-{selectedVehicle.decisionId}</strong></div><div className="customer-evidence-boundary"><LockKeyhole size={15} /><span>Invalid pricing, eligibility and reconciliation blocks cannot be overridden.</span></div></aside></>}
    <footer className="demo-footer"><span>Provenance · {fleet.provenance}</span><span>Exact grade matching · no cross-tenant records</span><span>Organisation aggregate limit enforced</span></footer>
  </div>;
}
