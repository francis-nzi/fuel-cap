export type ScenarioId = "normal" | "boundary" | "exposure";

export type Scenario = {
  id: ScenarioId;
  label: string;
  shortLabel: string;
  clock: string;
  status: "Nominal" | "Guarded" | "Action required";
  summary: string;
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
    evidence: string[];
    policy: string;
    impact: string;
  };
};

export const scenarios: Record<ScenarioId, Scenario> = {
  normal: {
    id: "normal",
    label: "Scenario 01 · Normal flat market",
    shortLabel: "Flat market",
    clock: "21 Aug 2026 · 09:30 UTC",
    status: "Nominal",
    summary: "Protection is priced, funded and reconciled inside the default operating envelope.",
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
      evidence: ["30-day realised volatility: 18.4%", "Pool utilisation: 27.8%", "Canonical quote coverage: 98.9%"],
      policy: "AI may recommend; acknowledgement creates no money movement.",
      impact: "No customer price or balance changes",
    },
  },
  boundary: {
    id: "boundary",
    label: "Scenario 03 · Protection boundary breach",
    shortLabel: "Boundary breach",
    clock: "21 Aug 2026 · 14:15 UTC",
    status: "Guarded",
    summary: "Pump prices have moved above the protection boundary; FuelCap pays the capped contribution and preserves audit lineage.",
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
      evidence: ["7-day claim velocity: +62%", "Black-76 calm cost exceeded by 14 bps", "Pool floor after action: 2.4×"],
      policy: "Pricing publication requires Risk initiator and Treasury approver; self-approval denied.",
      impact: "+$0.0064/gal on new US Regular protection only",
    },
  },
  exposure: {
    id: "exposure",
    label: "Scenario 12 · Multi-customer exposure",
    shortLabel: "Exposure cluster",
    clock: "21 Aug 2026 · 16:45 UTC",
    status: "Action required",
    summary: "A regional fleet cluster is concentrating protected gallons; the demonstrator proposes a simulated hedge for human approval.",
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
      evidence: ["Texas concentration: 37%", "Forecast pool coverage: 1.7× → 2.3×", "No reconciliation or quote-integrity blocks"],
      policy: "Treasury approver must differ from Risk initiator. Demonstrator action; zero money movement.",
      impact: "Paper position only · 25,000 gal · expires in 7 days",
    },
  },
};

export const scenarioOrder: ScenarioId[] = ["normal", "boundary", "exposure"];
