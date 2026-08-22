import { Building2, CarFront, CircleAlert, Gauge, ShieldCheck, Users } from "lucide-react";
import { fleetForOrganisation, fleetProtectedGallons } from "@fuelcap/demo-data/fleet";

export function FleetWorkspace({ organisationId }: { organisationId: string }) {
  const fleet = fleetForOrganisation(organisationId);

  if (!fleet) {
    return (
      <div className="workspace-wrap">
        <div className="workspace-empty">
          <Building2 size={24} />
          <h1>No fleet in this organisation</h1>
          <p>Switch to Northstar Fleet Services to inspect the governed multi-vehicle scenario. Personal organisations never inherit fleet records.</p>
          <span>Tenant boundary enforced · guessed identifiers return no records</span>
        </div>
      </div>
    );
  }

  const protectedGallons = fleetProtectedGallons(fleet);
  const headroom = fleet.aggregateLimitGallons - protectedGallons;

  return (
    <div className="workspace-wrap fleet-workspace">
      <section className="workspace-heading">
        <div>
          <span className="demo-badge"><ShieldCheck size={13} /> Demonstrator data</span>
          <h1>{fleet.organisationName}</h1>
          <p>Fleet protection, policy groups, assigned drivers and aggregate exposure in one organisation-scoped view.</p>
        </div>
        <div className="workspace-version">Scenario {fleet.scenarioId} · v{fleet.scenarioVersion}</div>
      </section>

      <section className="fleet-summary">
        <article><CarFront size={17} /><span>Vehicles</span><strong>{fleet.vehicles.length}</strong><small>Across {fleet.groups.length} policy groups</small></article>
        <article><Users size={17} /><span>Assigned drivers</span><strong>{fleet.drivers.length}</strong><small>All assignments effective</small></article>
        <article><Gauge size={17} /><span>Protected volume</span><strong>{protectedGallons} gal</strong><small>{headroom} gal organisation headroom</small></article>
        <article><CircleAlert size={17} /><span>Needs review</span><strong>{fleet.vehicles.filter(({ status }) => status === "REVIEW").length}</strong><small>Premium-grade policy check</small></article>
      </section>

      <div className="fleet-layout">
        <section className="fleet-table-panel">
          <div className="section-heading"><div><span className="section-kicker">Vehicles and drivers</span><h2>Current assignments</h2></div><span className="tenant-chip">{fleet.organisationId}</span></div>
          <div className="fleet-table-wrap">
            <table className="fleet-table">
              <thead><tr><th>Vehicle</th><th>Driver</th><th>Policy group</th><th>Protected</th><th>Status</th></tr></thead>
              <tbody>{fleet.vehicles.map((vehicle) => {
                const driver = fleet.drivers.find(({ driverId }) => driverId === vehicle.assignedDriverId)!;
                const group = fleet.groups.find(({ groupId }) => groupId === vehicle.groupId)!;
                return <tr key={vehicle.vehicleId}><td><strong>{vehicle.description}</strong><span>{vehicle.registration}</span></td><td><strong>{driver.name}</strong><span>{driver.email}</span></td><td><strong>{group.name}</strong><span>{group.fuelGrade} · {group.costCentre}</span></td><td><strong>{vehicle.protectedGallons} gal</strong><span>of {group.perVehicleLimitGallons} gal</span></td><td><span className={`fleet-status fleet-status--${vehicle.status.toLowerCase()}`}>{vehicle.status}</span></td></tr>;
              })}</tbody>
            </table>
          </div>
        </section>

        <aside className="fleet-policy-panel">
          <span className="section-kicker">Group policies</span><h2>Protection controls</h2>
          {fleet.groups.map((group) => <article key={group.groupId}><div><strong>{group.name}</strong><span>{group.costCentre}</span></div><dl><div><dt>Exact grade</dt><dd>{group.fuelGrade}</dd></div><div><dt>Vehicle limit</dt><dd>{group.perVehicleLimitGallons} gal</dd></div><div><dt>Auto-Rollover</dt><dd>{group.rolloverPolicy === "DEFAULT_ON_WITH_NOTICE" ? "On · notice required" : "Off"}</dd></div></dl></article>)}
          <div className="aggregate-limit"><span>Organisation aggregate</span><strong>{protectedGallons} / {fleet.aggregateLimitGallons} gal</strong><div><i style={{ width: `${protectedGallons / fleet.aggregateLimitGallons * 100}%` }} /></div><small>Limits are illustrative and governed; no live exposure.</small></div>
        </aside>
      </div>

      <footer className="demo-footer"><span>Provenance · {fleet.provenance}</span><span>Exact grade matching · no cross-tenant records</span><span>Organisation aggregate limit enforced</span></footer>
    </div>
  );
}
