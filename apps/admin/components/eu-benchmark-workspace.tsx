"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, FileCheck2, Globe2, LockKeyhole, RotateCcw, ShieldCheck } from "lucide-react";
import { authorize, type Environment, type Principal } from "@fuelcap/authz";
import { EU_COUNTRIES, EU_CURRENCY_BY_COUNTRY, seededEuBenchmarkConfiguration, seededEuBenchmarkMonitoring, seededEuBenchmarkRelease, syntheticEuWeeklyBulletinDecision, type EuBulletinProduct, type EuCountryCode, type TaxBasis } from "@fuelcap/eu-pricing-source";

const countryNames = new Intl.DisplayNames(["en"], { type: "region" });
const money = (value: number, currency: string) => new Intl.NumberFormat("en", { style: "currency", currency, maximumFractionDigits: 3 }).format(value / 10_000 / 1_000);

export function EuBenchmarkWorkspace({ organisationId, principal, environment }: { organisationId: string; principal: Principal; environment: Environment }) {
  const [country, setCountry] = useState<EuCountryCode>("DE");
  const [product, setProduct] = useState<EuBulletinProduct>("PETROL_95");
  const [taxBasis, setTaxBasis] = useState<TaxBasis>("WITH_TAXES");
  const [presentation, setPresentation] = useState<"NATIONAL" | "EUR">("NATIONAL");
  const [action, setAction] = useState<"idle" | "drafted" | "denied">("idle");
  const observations = useMemo(() => syntheticEuWeeklyBulletinDecision.observations.filter((item)=>item.country === country && item.product === product && item.taxBasis === taxBasis), [country,product,taxBasis]);
  const selected = observations.find((item)=>item.presentation === presentation)!;
  const nonEuro = EU_COUNTRIES.filter((code)=>EU_CURRENCY_BY_COUNTRY[code] !== "EUR").length;

  function draftRollback() {
    const permission = authorize({ principal, environment, activeOrganisationId: organisationId, workspace: "pricing-data", verb: "initiate" });
    setAction(permission.allowed ? "drafted" : "denied");
  }

  return <section className="eu-benchmark" aria-labelledby="eu-benchmark-title">
    <div className="section-heading eu-benchmark__heading"><div><span className="section-kicker">European benchmark control</span><h2 id="eu-benchmark-title">EU official weekly benchmark</h2><p>Country-level synthetic fixture projection — not station pump price.</p></div><span className="pricing-blocked">Not quote eligible</span></div>
    <div className="eu-benchmark__metrics">
      <article><Globe2 size={17}/><span>Market coverage</span><strong>27</strong><small>21 EUR · {nonEuro} national currencies</small></article>
      <article><FileCheck2 size={17}/><span>Published observations</span><strong>{seededEuBenchmarkRelease.observationCount}</strong><small>2 products · 2 tax bases · 2 views</small></article>
      <article><CheckCircle2 size={17}/><span>Release health</span><strong>{seededEuBenchmarkRelease.health}</strong><small>{seededEuBenchmarkMonitoring.activeReleaseId}</small></article>
      <article><AlertTriangle size={17}/><span>Exceptions</span><strong>{seededEuBenchmarkMonitoring.quarantined}</strong><small>{seededEuBenchmarkMonitoring.alerts.length ? seededEuBenchmarkMonitoring.alerts.join(" · ") : "No active alerts"}</small></article>
    </div>
    <div className="eu-benchmark__layout">
      <div className="eu-benchmark__explorer">
        <div className="eu-benchmark__filters">
          <label>Country<select value={country} onChange={(event)=>setCountry(event.target.value as EuCountryCode)}>{EU_COUNTRIES.map((code)=><option key={code} value={code}>{countryNames.of(code) ?? code} · {EU_CURRENCY_BY_COUNTRY[code]}</option>)}</select></label>
          <label>Product<select value={product} onChange={(event)=>setProduct(event.target.value as EuBulletinProduct)}><option value="PETROL_95">Euro-super 95</option><option value="ROAD_DIESEL">Road diesel</option></select></label>
          <label>Tax basis<select value={taxBasis} onChange={(event)=>setTaxBasis(event.target.value as TaxBasis)}><option value="WITH_TAXES">With taxes</option><option value="WITHOUT_TAXES">Without taxes</option></select></label>
          <label>Presentation<select value={presentation} onChange={(event)=>setPresentation(event.target.value as "NATIONAL"|"EUR")}><option value="NATIONAL">National currency</option><option value="EUR">Commission EUR view</option></select></label>
        </div>
        <div className="eu-benchmark__value"><div><span>{countryNames.of(country)} · {product.replaceAll("_"," ")}</span><strong>{money(selected.pricePer1000LMinor4, selected.currency)} / litre</strong><small>{taxBasis.replaceAll("_"," ")} · {presentation} presentation</small></div><ShieldCheck size={25}/></div>
        <dl className="eu-benchmark__lineage"><div><dt>Observation</dt><dd>{selected.observationId}</dd></div><div><dt>Geographic scope</dt><dd>COUNTRY</dd></div><div><dt>Source release</dt><dd>{seededEuBenchmarkRelease.releaseId}</dd></div><div><dt>Workbook lineage</dt><dd>{selected.rowLineage}</dd></div><div><dt>Permitted uses</dt><dd>{selected.permittedUses.join(" · ")}</dd></div><div><dt>Provenance</dt><dd>{selected.provenance}</dd></div></dl>
      </div>
      <aside className="eu-benchmark__governance"><span className="section-kicker">Publication governance</span><h3>{seededEuBenchmarkConfiguration.state}</h3><dl><div><dt>Configuration</dt><dd>{seededEuBenchmarkConfiguration.configurationId} · v{seededEuBenchmarkConfiguration.version}</dd></div><div><dt>Maker / checker</dt><dd>{seededEuBenchmarkConfiguration.makerId} · {seededEuBenchmarkConfiguration.checkerId}</dd></div><div><dt>Licence evidence</dt><dd>{seededEuBenchmarkConfiguration.licenceApproval}</dd></div><div><dt>Freshness windows</dt><dd>Current ≤10d · expired &gt;17d</dd></div><div><dt>Rollback</dt><dd>{seededEuBenchmarkConfiguration.rollbackReference}</dd></div></dl><div className="eu-benchmark__boundary"><LockKeyhole size={15}/><span>Synthetic fixture only. No network runtime, station identity, quote or settlement path.</span></div><button type="button" onClick={draftRollback}><RotateCcw size={14}/> Draft rollback request</button>{action !== "idle" && <div className={`customer-review-result customer-review-result--${action === "drafted" ? "submitted" : "denied"}`} role="status"><strong>{action === "drafted" ? "Rollback request drafted" : "Permission denied"}</strong><span>{action === "drafted" ? "A different authorised checker and exact evidence digest are required; the release remains active." : "This principal cannot initiate pricing-data governance."}</span></div>}</aside>
    </div>
  </section>;
}
