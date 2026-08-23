import { scenarioManifests, type ScenarioId as ManifestScenarioId } from "@fuelcap/demo-data";

export type ScenarioId = "normal" | "boundary" | "exposure" | "ukQuote" | "canadaFraud" | "fx";
export type MarketFilter = "US" | "UK" | "CA" | "MULTI";

export type Scenario = {
  id: ScenarioId;
  manifestId: ManifestScenarioId;
  label: string;
  shortLabel: string;
  market: MarketFilter;
  clock: string;
  status: "Nominal" | "Guarded" | "Action required";
  summary: string;
  pricingHealth: {
    status: "eligible" | "watch" | "ineligible";
    freshestObservation: string;
    coverage: string;
    anomaly: string;
    conflicts: string;
    eligibility: string;
  };
  commercialLineage: Array<{
    label: string;
    value: string;
    detail: string;
    nodeKey: "price" | "spread" | "protect" | "ledger" | "settle" | "risk";
    tone: "base" | "good" | "watch";
  }>;
  operationsControl: {
    safeguarded: string;
    customerOwed: string;
    inFlight: string;
    invariant: "holds" | "review";
    reconciliation: string;
    breaks: number;
    downstream: string;
    caseTitle: string;
    caseCount: number;
    caseClass: "operations" | "pricing" | "eligibility" | "risk";
  };
  metrics: Array<{ label: string; value: string; delta: string; tone: "good" | "neutral" | "warn" }>;
  flow: Array<{
    key: string;
    eyebrow: string;
    title: string;
    value: string;
    detail: string;
    state: "healthy" | "watch" | "controlled";
  }>;
  recommendation: {
    title: string;
    rationale: string;
    confidence: number;
    action: string;
    evidence: Array<{ claim: string; source: string; nodeKey: "price" | "spread" | "protect" | "ledger" | "settle" | "risk" }>;
    policy: string;
    impact: string;
  };
};

export const scenarios: Record<ScenarioId, Scenario> = {
  normal: {
    id: "normal",
    market: "US",
    manifestId: "flat-market-us",
    label: "Scenario 01 · Normal flat market",
    shortLabel: "Flat market",
    clock: "21 Aug 2026 · 09:30 UTC",
    status: "Nominal",
    summary: "Protection is priced, funded and reconciled inside the default operating envelope.",
    pricingHealth: { status: "eligible", freshestObservation: "38 sec", coverage: "98.9%", anomaly: "None detected", conflicts: "0 unresolved", eligibility: "Quote eligible" },
    commercialLineage: [
      { label: "Reference price", value: "$3.58/gal", detail: "Canonical US Regular anchor", nodeKey: "price", tone: "base" },
      { label: "Protection charge", value: "2.30%", detail: "1.30 cost · 0.30 buffer · 0.70 margin", nodeKey: "spread", tone: "base" },
      { label: "Protected volume", value: "42,100 gal", detail: "7-day positions in this scenario", nodeKey: "protect", tone: "good" },
      { label: "Customer/FuelCap", value: "$0 claim", detail: "Flat market · no protection payout", nodeKey: "settle", tone: "good" },
      { label: "Pool exposure", value: "3.6× cover", detail: "Inside operating envelope", nodeKey: "risk", tone: "good" },
    ],
    operationsControl: { safeguarded: "$1,842,615", customerOwed: "$1,839,820", inFlight: "$2,795", invariant: "holds", reconciliation: "99.97%", breaks: 3, downstream: "Non-blocking review", caseTitle: "Processor timing matches", caseCount: 3, caseClass: "operations" },
    metrics: [
      { label: "Protected volume", value: "184,260 gal", delta: "+3.8% vs 7d", tone: "good" },
      { label: "Protection charges", value: "$14,836", delta: "2.30% weighted", tone: "neutral" },
      { label: "Pool coverage", value: "3.6×", delta: "+0.2× headroom", tone: "good" },
      { label: "Reconciliation", value: "99.97%", delta: "3 open breaks", tone: "neutral" },
    ],
    flow: [
      { key: "price", eyebrow: "Pricing data", title: "Reference selected", value: "$3.58/gal", detail: "EIA + station observations · v1.4", state: "healthy" },
      { key: "spread", eyebrow: "Spread + FX", title: "Charge constructed", value: "2.30%", detail: "1.30 cost · 0.30 buffer · 0.70 margin", state: "healthy" },
      { key: "protect", eyebrow: "Protection", title: "Position issued", value: "42,100 gal", detail: "7-day term · 5% ceiling · 15% boundary", state: "healthy" },
      { key: "ledger", eyebrow: "Ledger", title: "Journal balanced", value: "$0.00", detail: "18,420 entries · sequence 008421", state: "healthy" },
      { key: "settle", eyebrow: "Settlement", title: "Pump claims matched", value: "99.97%", detail: "Confirmed fuel gallons only", state: "controlled" },
      { key: "risk", eyebrow: "Risk + pool", title: "Exposure covered", value: "3.6×", detail: "No intervention required", state: "healthy" },
    ],
    recommendation: {
      title: "No pricing intervention recommended",
      rationale: "Observed volatility and pool utilisation remain within the calm-state policy envelope.",
      confidence: 94,
      action: "Acknowledge operating state",
      evidence: [{ claim: "30-day realised volatility: 18.4%", source: "Exposure snapshot", nodeKey: "risk" }, { claim: "Pool utilisation: 27.8%", source: "Pool coverage projection", nodeKey: "risk" }, { claim: "Canonical quote coverage: 98.9%", source: "Pricing decision set", nodeKey: "price" }],
      policy: "AI may recommend; acknowledgement creates no money movement.",
      impact: "No customer price or balance changes",
    },
  },
  boundary: {
    id: "boundary",
    market: "US",
    manifestId: "boundary-breach-us",
    label: "Scenario 03 · Protection boundary breach",
    shortLabel: "Boundary breach",
    clock: "21 Aug 2026 · 14:15 UTC",
    status: "Guarded",
    summary: "Pump prices have moved above the protection boundary; FuelCap pays the capped contribution and preserves audit lineage.",
    pricingHealth: { status: "watch", freshestObservation: "51 sec", coverage: "97.4%", anomaly: "+17.3% pump move", conflicts: "2 preserved · resolved", eligibility: "Settlement eligible" },
    commercialLineage: [
      { label: "Reference / strike", value: "$3.50 / $3.675", detail: "5% protection ceiling", nodeKey: "price", tone: "base" },
      { label: "Maximum boundary", value: "$3.85/gal", detail: "FuelCap contribution capped at $0.35", nodeKey: "protect", tone: "watch" },
      { label: "Protected fill", value: "20.0000 gal", detail: "Confirmed fuel gallons only", nodeKey: "protect", tone: "base" },
      { label: "Station / customer", value: "$84.00 / $77.00", detail: "FuelCap funds the $7.00 difference", nodeKey: "settle", tone: "watch" },
      { label: "Pool claim", value: "$7.00", detail: "Capped contribution · balanced journal", nodeKey: "risk", tone: "watch" },
    ],
    operationsControl: { safeguarded: "$1,916,420", customerOwed: "$1,902,180", inFlight: "$14,240", invariant: "holds", reconciliation: "99.92%", breaks: 11, downstream: "Affected claims held", caseTitle: "Station settlement breaks", caseCount: 11, caseClass: "operations" },
    metrics: [
      { label: "Protected volume", value: "191,840 gal", delta: "+7.9% vs 7d", tone: "neutral" },
      { label: "Claims today", value: "$28,420", delta: "+62% vs plan", tone: "warn" },
      { label: "Pool coverage", value: "2.1×", delta: "Within floor", tone: "warn" },
      { label: "Reconciliation", value: "99.92%", delta: "11 open breaks", tone: "neutral" },
    ],
    flow: [
      { key: "price", eyebrow: "Pricing data", title: "Actual pump confirmed", value: "$4.20/gal", detail: "Eligible station observation · actual", state: "controlled" },
      { key: "spread", eyebrow: "Spread + FX", title: "Original charge traced", value: "$0.0805/gal", detail: "Charge excluded from strike comparison", state: "healthy" },
      { key: "protect", eyebrow: "Protection", title: "Boundary applied", value: "$0.35/gal", detail: "Customer bears excess above $3.85", state: "watch" },
      { key: "ledger", eyebrow: "Ledger", title: "Claim posted", value: "$7.00", detail: "20 gal · balanced four-leg journal", state: "controlled" },
      { key: "settle", eyebrow: "Settlement", title: "Station funded", value: "$84.00", detail: "Customer $77.00 · FuelCap $7.00", state: "controlled" },
      { key: "risk", eyebrow: "Risk + pool", title: "Coverage tightening", value: "2.1×", detail: "AI review threshold reached", state: "watch" },
    ],
    recommendation: {
      title: "Increase new-business cost component by 18 bps",
      rationale: "Short-dated volatility and claim velocity have risen while pool coverage remains above the hard floor.",
      confidence: 88,
      action: "Send pricing change for approval",
      evidence: [{ claim: "7-day claim velocity: +62%", source: "Settlement claim projection", nodeKey: "settle" }, { claim: "Black-76 calm cost exceeded by 14 bps", source: "Risk model v0.4-demo", nodeKey: "risk" }, { claim: "Pool floor after action: 2.4×", source: "Exposure stress snapshot", nodeKey: "risk" }],
      policy: "Pricing publication requires Risk initiator and Treasury approver; self-approval denied.",
      impact: "+$0.0064/gal on new US Regular protection only",
    },
  },
  exposure: {
    id: "exposure",
    market: "US",
    manifestId: "exposure-ai-recommendation",
    label: "Scenario 12 · Multi-customer exposure",
    shortLabel: "Exposure cluster",
    clock: "21 Aug 2026 · 16:45 UTC",
    status: "Action required",
    summary: "A regional fleet cluster is concentrating protected gallons; the demonstrator proposes a simulated hedge for human approval.",
    pricingHealth: { status: "watch", freshestObservation: "42 sec", coverage: "98.1%", anomaly: "Texas +8.4%", conflicts: "0 unresolved", eligibility: "Quote eligible" },
    commercialLineage: [
      { label: "Reference signal", value: "+8.4%", detail: "41 actual Texas observations", nodeKey: "price", tone: "watch" },
      { label: "Weighted charge", value: "2.18%", detail: "Fleet promos reduce margin only", nodeKey: "spread", tone: "base" },
      { label: "Cluster volume", value: "68,400 gal", detail: "14 fleets · 312 vehicles", nodeKey: "protect", tone: "watch" },
      { label: "Value at boundary", value: "$23,940", detail: "Accepted-position exposure", nodeKey: "ledger", tone: "watch" },
      { label: "Simulated hedge", value: "25,000 gal", detail: "Restores forecast cover to 2.3×", nodeKey: "risk", tone: "good" },
    ],
    operationsControl: { safeguarded: "$2,126,940", customerOwed: "$2,108,104", inFlight: "$18,836", invariant: "holds", reconciliation: "100.00%", breaks: 0, downstream: "Hedge approval available", caseTitle: "Texas concentration review", caseCount: 1, caseClass: "risk" },
    metrics: [
      { label: "Cluster exposure", value: "68,400 gal", delta: "37% in Texas", tone: "warn" },
      { label: "Value at boundary", value: "$23,940", delta: "+$8,110 today", tone: "warn" },
      { label: "Pool coverage", value: "1.7×", delta: "0.2× above floor", tone: "warn" },
      { label: "Reconciliation", value: "100.00%", delta: "No blocking breaks", tone: "good" },
    ],
    flow: [
      { key: "price", eyebrow: "Pricing data", title: "Texas rise detected", value: "+8.4%", detail: "41 actual observations · no conflicts", state: "controlled" },
      { key: "spread", eyebrow: "Spread + FX", title: "Group mix analysed", value: "2.18%", detail: "Fleet promos reduce margin component", state: "watch" },
      { key: "protect", eyebrow: "Protection", title: "Exposure clustered", value: "68,400 gal", detail: "14 fleets · 312 vehicles", state: "watch" },
      { key: "ledger", eyebrow: "Ledger", title: "Funds reconciled", value: "$312,806", detail: "Safeguarding invariant holds", state: "healthy" },
      { key: "settle", eyebrow: "Settlement", title: "No blocked claims", value: "100.00%", detail: "All actual gallons confirmed", state: "healthy" },
      { key: "risk", eyebrow: "Risk + pool", title: "Hedge proposed", value: "25,000 gal", detail: "Simulated execution only", state: "watch" },
    ],
    recommendation: {
      title: "Approve a 25,000 gal simulated Texas hedge",
      rationale: "The smallest paper hedge that restores forecast pool coverage above 2.2× while preserving current customer pricing.",
      confidence: 91,
      action: "Approve simulated hedge",
      evidence: [{ claim: "Texas concentration: 37%", source: "Accepted-position exposure", nodeKey: "protect" }, { claim: "Forecast pool coverage: 1.7× → 2.3×", source: "Simulated hedge stress", nodeKey: "risk" }, { claim: "No reconciliation or quote-integrity blocks", source: "Control assurance snapshot", nodeKey: "ledger" }],
      policy: "Treasury approver must differ from Risk initiator. Demonstrator action; zero money movement.",
      impact: "Paper position only · 25,000 gal · expires in 7 days",
    },
  },
  ukQuote: {
    id: "ukQuote",
    market: "UK",
    manifestId: "no-valid-quote-uk",
    label: "Scenario 07 · UK quote unavailable",
    shortLabel: "UK quote unavailable",
    clock: "22 Aug 2026 · 11:00 BST",
    status: "Guarded",
    summary: "The UK pricing feed is unavailable, so rollover releases reserved value without fabricating a quote or creating a later debit.",
    pricingHealth: { status: "ineligible", freshestObservation: "47 min", coverage: "41.2%", anomaly: "Feed availability failure", conflicts: "3 preserved · unresolved", eligibility: "Not quote eligible" },
    commercialLineage: [
      { label: "Reference price", value: "Unavailable", detail: "No eligible canonical decision", nodeKey: "price", tone: "watch" },
      { label: "New charge", value: "£0.00", detail: "No spread without a valid anchor", nodeKey: "spread", tone: "good" },
      { label: "Affected positions", value: "126", detail: "Rollover cannot complete", nodeKey: "protect", tone: "watch" },
      { label: "Released value", value: "£8,412", detail: "Reserved value returned to available tanks", nodeKey: "ledger", tone: "good" },
      { label: "Retroactive debit", value: "Prohibited", detail: "Customer must choose Protect now", nodeKey: "settle", tone: "good" },
    ],
    operationsControl: { safeguarded: "£684,210", customerOwed: "£675,798", inFlight: "£8,412", invariant: "holds", reconciliation: "100.00%", breaks: 0, downstream: "New UK quotes blocked", caseTitle: "Pricing availability incident", caseCount: 1, caseClass: "pricing" },
    metrics: [
      { label: "Affected positions", value: "126", delta: "Availability class", tone: "warn" },
      { label: "Released value", value: "£8,412", delta: "Returned to tanks", tone: "neutral" },
      { label: "New charge", value: "£0.00", delta: "Rule 18", tone: "good" },
      { label: "Retroactive debits", value: "0", delta: "Prohibited", tone: "good" },
    ],
    flow: [
      { key: "price", eyebrow: "Pricing data", title: "Quote unavailable", value: "0 eligible", detail: "Feed health below quote threshold", state: "watch" },
      { key: "spread", eyebrow: "Spread + FX", title: "Decision blocked", value: "No price", detail: "No spread applied without an anchor", state: "controlled" },
      { key: "protect", eyebrow: "Protection", title: "Value released", value: "£8,412", detail: "126 positions · no new charge", state: "controlled" },
      { key: "ledger", eyebrow: "Ledger", title: "Balances restored", value: "£0.00", detail: "Reserved to available · balanced", state: "healthy" },
      { key: "settle", eyebrow: "Settlement", title: "No retro debit", value: "0", detail: "Customer must choose Protect now", state: "healthy" },
      { key: "risk", eyebrow: "Operations", title: "Incident grouped", value: "1 case", detail: "Multi-customer availability alert", state: "watch" },
    ],
    recommendation: {
      title: "Keep UK rollover paused until pricing is eligible",
      rationale: "The deterministic validator rejected the available inputs; preserving customer value is safer than estimating a settlement-eligible quote.",
      confidence: 100,
      action: "Acknowledge availability incident",
      evidence: [{ claim: "Quote eligibility: failed", source: "Canonical pricing decision", nodeKey: "price" }, { claim: "Released balance: £8,412", source: "Journal projection", nodeKey: "ledger" }, { claim: "Retroactive debit permission: false", source: "Rule 18 evaluation", nodeKey: "settle" }],
      policy: "AI may summarise the incident; no operator can override an invalid quote.",
      impact: "126 customers notified · balances remain available",
    },
  },
  canadaFraud: {
    id: "canadaFraud",
    market: "CA",
    manifestId: "eligibility-fraud-canada",
    label: "Scenario 08 · Canada eligibility review",
    shortLabel: "Canada eligibility review",
    clock: "22 Aug 2026 · 07:00 EDT",
    status: "Action required",
    summary: "A Canadian eligibility signal routes affected accounts to human review while customer value remains available and isolated.",
    pricingHealth: { status: "eligible", freshestObservation: "2 min", coverage: "94.6%", anomaly: "No pricing anomaly", conflicts: "1 preserved · resolved", eligibility: "Display eligible" },
    commercialLineage: [
      { label: "Display price", value: "C$1.62/L", detail: "Valid pricing is not the eligibility issue", nodeKey: "price", tone: "good" },
      { label: "Review accounts", value: "18", detail: "Ontario eligibility cluster", nodeKey: "risk", tone: "watch" },
      { label: "Protected volume", value: "4,860 L", detail: "No new rollover protection", nodeKey: "protect", tone: "watch" },
      { label: "Released value", value: "C$6,920", detail: "Customer funds remain available", nodeKey: "ledger", tone: "good" },
      { label: "Decision mode", value: "Human review", detail: "No automated adverse outcome", nodeKey: "risk", tone: "good" },
    ],
    operationsControl: { safeguarded: "C$492,680", customerOwed: "C$485,760", inFlight: "C$6,920", invariant: "holds", reconciliation: "100.00%", breaks: 0, downstream: "Eligibility actions held", caseTitle: "Ontario eligibility reviews", caseCount: 18, caseClass: "eligibility" },
    metrics: [
      { label: "Accounts reviewed", value: "18", delta: "Ontario cluster", tone: "warn" },
      { label: "Protected volume", value: "4,860 L", delta: "Held from rollover", tone: "neutral" },
      { label: "Customer value", value: "C$6,920", delta: "Available · not lost", tone: "good" },
      { label: "Auto-decisions", value: "0", delta: "Human review required", tone: "good" },
    ],
    flow: [
      { key: "price", eyebrow: "Pricing data", title: "Ontario feed valid", value: "C$1.62/L", detail: "Display eligible · simulation provenance", state: "healthy" },
      { key: "spread", eyebrow: "Rules", title: "Eligibility separated", value: "18 cases", detail: "Account attention · not feed outage", state: "controlled" },
      { key: "protect", eyebrow: "Protection", title: "Rollover stopped", value: "4,860 L", detail: "No new protection purchased", state: "watch" },
      { key: "ledger", eyebrow: "Ledger", title: "Value released", value: "C$6,920", detail: "No overdraft or surprise debit", state: "healthy" },
      { key: "settle", eyebrow: "Cases", title: "Review queue opened", value: "18", detail: "Evidence package attached", state: "controlled" },
      { key: "risk", eyebrow: "Fraud + compliance", title: "Human decision", value: "Required", detail: "No automated adverse outcome", state: "watch" },
    ],
    recommendation: {
      title: "Prioritise the Ontario eligibility review cluster",
      rationale: "Shared signals justify grouped investigation, but evidence does not support an automated adverse customer decision.",
      confidence: 86,
      action: "Open governed case batch",
      evidence: [{ claim: "18 linked review cases", source: "Eligibility case graph", nodeKey: "risk" }, { claim: "No cross-tenant context", source: "Tenant retrieval policy", nodeKey: "risk" }, { claim: "Customer funds remain available", source: "Customer-liability projection", nodeKey: "ledger" }],
      policy: "Statistical signals prioritise work; a human makes each eligibility decision.",
      impact: "Review queue only · no automated account restriction",
    },
  },
  fx: {
    id: "fx",
    market: "MULTI",
    manifestId: "fx-movement-multi-market",
    label: "Scenario 11 · Multi-market FX movement",
    shortLabel: "Global FX movement",
    clock: "22 Aug 2026 · 14:00 UTC",
    status: "Nominal",
    summary: "Pinned illustrative FX decisions translate USD, CAD and GBP positions without creating a cross-currency ledger imbalance.",
    pricingHealth: { status: "eligible", freshestObservation: "Fixed clock", coverage: "3 / 3 pairs", anomaly: "None detected", conflicts: "0 unresolved", eligibility: "Simulation eligible" },
    commercialLineage: [
      { label: "USD/CAD", value: "1.371200", detail: "Explicit pair direction", nodeKey: "price", tone: "base" },
      { label: "GBP/USD", value: "1.286400", detail: "Pinned scenario rate", nodeKey: "price", tone: "base" },
      { label: "EUR/USD", value: "1.092500", detail: "Pinned scenario rate", nodeKey: "price", tone: "base" },
      { label: "Ledger residue", value: "$0.00", detail: "Balanced per currency", nodeKey: "ledger", tone: "good" },
      { label: "Execution", value: "Simulation only", detail: "No live FX movement", nodeKey: "settle", tone: "good" },
    ],
    operationsControl: { safeguarded: "$2,184,620 eq.", customerOwed: "$2,166,340 eq.", inFlight: "$18,280 eq.", invariant: "holds", reconciliation: "Balanced", breaks: 0, downstream: "Simulation only", caseTitle: "FX decision monitoring", caseCount: 0, caseClass: "operations" },
    metrics: [
      { label: "USD/CAD", value: "1.371200", delta: "Pinned scenario rate", tone: "neutral" },
      { label: "GBP/USD", value: "1.286400", delta: "Pinned scenario rate", tone: "neutral" },
      { label: "EUR/USD", value: "1.092500", delta: "Pinned scenario rate", tone: "neutral" },
      { label: "Currency imbalance", value: "$0.00", delta: "Balanced per currency", tone: "good" },
    ],
    flow: [
      { key: "price", eyebrow: "FX data", title: "Rates observed", value: "3 pairs", detail: "Illustrative-fixed provenance", state: "healthy" },
      { key: "spread", eyebrow: "FX engine", title: "Direction pinned", value: "Explicit", detail: "Base and quote currency recorded", state: "healthy" },
      { key: "protect", eyebrow: "Positions", title: "Markets translated", value: "US · CA · UK", detail: "Original currency preserved", state: "controlled" },
      { key: "ledger", eyebrow: "Ledger", title: "Conversions balanced", value: "$0.00", detail: "FX gain/loss captures residue", state: "healthy" },
      { key: "settle", eyebrow: "Settlement", title: "No live movement", value: "Demo only", detail: "Provider port remains mocked", state: "healthy" },
      { key: "risk", eyebrow: "Exposure", title: "FX envelope clear", value: "3/3", detail: "No threshold breach", state: "healthy" },
    ],
    recommendation: {
      title: "No FX intervention recommended",
      rationale: "All conversions reconcile per currency using pinned, direction-explicit rates and the scenario remains inside its demonstrator envelope.",
      confidence: 97,
      action: "Acknowledge FX state",
      evidence: [{ claim: "USD/CAD 1.371200", source: "Pinned FX decision", nodeKey: "price" }, { claim: "GBP/USD 1.286400", source: "Pinned FX decision", nodeKey: "price" }, { claim: "Balanced per-currency journals", source: "Journal projection", nodeKey: "ledger" }],
      policy: "Illustrative rates cannot initiate live conversion or money movement.",
      impact: "No pricing or treasury change",
    },
  },
};

export const scenarioOrder: ScenarioId[] = ["normal", "boundary", "exposure", "ukQuote", "canadaFraud", "fx"];

const requiredProjectionValues: Record<ScenarioId, readonly string[]> = {
  normal: ["$3.58/gal", "2.30%", "42,100 gal"],
  boundary: ["$3.50 / $3.675", "$3.85/gal", "$84.00 / $77.00", "$7.00"],
  exposure: ["68,400 gal", "$23,940", "25,000 gal"],
  ukQuote: ["£0.00", "£8,412", "Prohibited"],
  canadaFraud: ["C$1.62/L", "C$6,920", "Human review"],
  fx: ["1.371200", "1.286400", "1.092500", "$0.00"],
};

export function assertScenarioProjections() {
  for (const id of scenarioOrder) {
    const projection = scenarios[id];
    const manifest = scenarioManifests[projection.manifestId];
    if (projection.market !== manifest.market.country) throw new Error(`Market mismatch for ${id}.`);
    const serialized = JSON.stringify(projection);
    for (const expected of requiredProjectionValues[id]) {
      if (!serialized.includes(expected)) throw new Error(`Projection ${id} is missing canonical value ${expected}.`);
    }
  }
  return true;
}

export const scenarioProjectionsVerified = assertScenarioProjections();
