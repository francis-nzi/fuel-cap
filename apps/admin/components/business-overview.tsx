import { Activity, ArrowDownRight, ArrowUpRight, CircleDollarSign, Fuel, Gauge, ShieldCheck, WalletCards } from "lucide-react";
import { acceptedExposureSnapshot, stressProjections } from "@fuelcap/demo-data/risk-hedging";
import { safeguardingProjection } from "@fuelcap/demo-data/transactions-ledger";
import { DemoControlBridge } from "@/components/demo-control-bridge";

const dollars = (minor: number) => `$${(minor / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
const gallons = (value4dp: number) => `${(value4dp / 10_000).toLocaleString("en-US")} gal`;

const economics = {
  feesCollectedMinor: 1_684_200,
  protectionCostMinor: 524_000,
  claimsPaidMinor: 708_400,
  insuranceRecoveryMinor: 397_500,
  operatingCostsMinor: 231_600,
};

export function BusinessOverview({ actorId, role }: { actorId: string; role: string }) {
  const grossContribution = economics.feesCollectedMinor + economics.insuranceRecoveryMinor - economics.protectionCostMinor - economics.claimsPaidMinor - economics.operatingCostsMinor;
  return <div className="business-overview">
    <section className="business-hero"><div><span>Business overview · United States</span><h1>Customer funds, fuel exposure and operating performance</h1><p>A commercial view of how customer money becomes protected fuel, retailer settlement and FuelCap margin.</p></div><div className="business-hero__state"><ShieldCheck size={18}/><span>Customer funds</span><strong>Fully accounted for</strong></div></section>

    <section className="business-kpis" aria-label="Business headline metrics">
      <article><WalletCards/><span>Customer funds held</span><strong>{dollars(safeguardingProjection.safeguardedMinor)}</strong><small>{dollars(safeguardingProjection.authorisedInFlightMinor)} settling</small></article>
      <article><Fuel/><span>Protected fuel</span><strong>{gallons(acceptedExposureSnapshot.acceptedQuantity4dp)}</strong><small>Weighted protection price $3.42/gal</small></article>
      <article><Gauge/><span>Current exposure</span><strong>{dollars(acceptedExposureSnapshot.expectedClaimsMinor)}</strong><small>{dollars(acceptedExposureSnapshot.reserveAvailableMinor)} reserve available</small></article>
      <article><CircleDollarSign/><span>Operating contribution</span><strong>{dollars(grossContribution)}</strong><small>36.7% of collected fees</small></article>
    </section>

    <div className="business-grid">
      <section className="business-card"><div className="business-card__heading"><div><span>Funds under management</span><h2>Where customer money is now</h2></div><strong>{dollars(safeguardingProjection.safeguardedMinor)}</strong></div><div className="funds-bar"><i style={{width:"58%"}}/><i style={{width:"31%"}}/><i style={{width:"11%"}}/></div><dl className="business-breakdown"><div><dt>Available wallet funds</dt><dd>$1,233,625</dd></div><div><dt>Allocated to protected fuel</dt><dd>$657,315</dd></div><div><dt>Retailer settlement in flight</dt><dd>$188,360</dd></div><div><dt>Customer refunds pending</dt><dd>$47,640</dd></div></dl></section>
      <section className="business-card"><div className="business-card__heading"><div><span>Coverage stack</span><h2>How price-rise claims are funded</h2></div><strong>1.70×</strong></div><dl className="coverage-stack"><div><dt>Fees collected</dt><dd>{dollars(economics.feesCollectedMinor)}</dd><i style={{width:"70%"}}/></div><div><dt>Protection reserve</dt><dd>{dollars(acceptedExposureSnapshot.reserveAvailableMinor)}</dd><i style={{width:"100%"}}/></div><div><dt>Insurance / paper hedge recovery</dt><dd>{dollars(economics.insuranceRecoveryMinor)}</dd><i style={{width:"32%"}}/></div></dl><p className="business-note"><ShieldCheck size={15}/> Current accepted exposure remains inside the funded envelope.</p></section>
    </div>

    <div className="business-grid">
      <section className="business-card"><div className="business-card__heading"><div><span>Unit economics</span><h2>Revenue, protection cost and profit</h2></div><strong>{dollars(grossContribution)}</strong></div><dl className="profit-bridge"><div><dt><ArrowUpRight/>Fees collected</dt><dd>+{dollars(economics.feesCollectedMinor)}</dd></div><div><dt><ArrowUpRight/>Insurance recovery</dt><dd>+{dollars(economics.insuranceRecoveryMinor)}</dd></div><div><dt><ArrowDownRight/>Protection purchased</dt><dd>−{dollars(economics.protectionCostMinor)}</dd></div><div><dt><ArrowDownRight/>Customer claims funded</dt><dd>−{dollars(economics.claimsPaidMinor)}</dd></div><div><dt><ArrowDownRight/>Operating costs</dt><dd>−{dollars(economics.operatingCostsMinor)}</dd></div></dl></section>
      <section className="business-card"><div className="business-card__heading"><div><span>Price engine</span><h2>Bought, protected and redeemed prices</h2></div><Activity/></div><div className="price-waterfall"><div><span>Reference bought</span><strong>$3.34</strong><small>Wholesale-equivalent input</small></div><b>→</b><div><span>Customer protected</span><strong>$3.42</strong><small>Including approved charge</small></div><b>→</b><div><span>Average redeemed</span><strong>$3.71</strong><small>FuelCap covers $0.29/gal</small></div></div><p className="business-note">68,400 protected gallons · 21,760 gallons redeemed · $6,310 customer benefit delivered.</p></section>
    </div>

    <section className="business-card"><div className="business-card__heading"><div><span>Estimated spread risk</span><h2>What happens if fuel prices move?</h2></div><strong>Accepted positions only</strong></div><div className="scenario-table" role="table" aria-label="Price risk scenarios"><div role="row"><b>Scenario</b><b>Expected claims</b><b>Insurance / hedge</b><b>Reserve use</b><b>Position</b></div>{stressProjections.slice(0,5).map((stress)=><div role="row" key={stress.stressId}><span>{stress.label}</span><strong>{dollars(stress.expectedClaimsMinor)}</strong><span>{dollars(stress.simulatedPayoffMinor)}</span><span>{dollars(stress.reserveUseMinor)}</span><em className={`scenario-outcome scenario-outcome--${stress.outcome.toLowerCase()}`}>{stress.outcome}</em></div>)}</div></section>

    <DemoControlBridge actorId={actorId} role={role}/>
  </div>;
}
