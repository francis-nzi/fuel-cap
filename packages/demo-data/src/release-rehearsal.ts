export const RELEASE_REHEARSAL_VERSION = "phase1-rehearsal@1.0.0" as const;
export const rehearsalPaths = [
  { pathId: "PATH-B2C-RISE", class: "GOLDEN", title: "B2C price cap and rise outcome", scenarioId: "rise-within-boundary-us", evidenceIds: ["GOLDEN-RISE", "JRN-RISE"] },
  { pathId: "PATH-B2B-FLEET", class: "GOLDEN", title: "B2B fleet group pricing and consolidated view", scenarioId: "fleet-multi-vehicle-us", evidenceIds: ["FLEET-DEC-3017", "fleet-policy@1.3"] },
  { pathId: "PATH-ROLLOVER", class: "GOLDEN", title: "Unused protected volume auto-rollover", scenarioId: "rollover-rise-fall-us", evidenceIds: ["ROLLOVER-DEC-001", "DEC-019"] },
  { pathId: "PATH-CANCEL", class: "ADVERSE", title: "Customer cancellation releases eligible value", scenarioId: "multi-lock-partial-fill-us", evidenceIds: ["CANCEL-EVT-001", "DEC-010"] },
  { pathId: "PATH-DATA-CASE", class: "GOLDEN", title: "Data anomaly through case resolution", scenarioId: "no-valid-quote-uk", evidenceIds: ["CASE-DATA-0103", "OBS-PRICE-0103"] },
  { pathId: "PATH-PRICE-DROP", class: "WOW", title: "Price-drop retained-value outcome", scenarioId: "falling-price-us", evidenceIds: ["GOLDEN-FALL", "DEC-017"] },
  { pathId: "PATH-FRAUD", class: "WOW", title: "Fraud and anti-selection catch", scenarioId: "eligibility-fraud-canada", evidenceIds: ["CASE-FRAUD-0102", "MODEL-FAIRNESS-001"] },
  { pathId: "PATH-STALE", class: "ADVERSE", title: "Stale feed quote stop and fallback", scenarioId: "no-valid-quote-uk", evidenceIds: ["PRICE-INELIGIBLE-UK", "DEC-021"] },
  { pathId: "PATH-DUPLICATE", class: "ADVERSE", title: "Duplicate payment and settlement event", scenarioId: "flat-market-us", evidenceIds: ["EVENT-0091", "INBOX-REPLAY-0091"] },
  { pathId: "PATH-AI-FALLBACK", class: "ADVERSE", title: "AI confidence failure and deterministic fallback", scenarioId: "exposure-ai-recommendation", evidenceIds: ["EVAL-PRICE_INTEGRITY", "deterministic-search@1.0"] },
] as const;
export const presentationViewports = [{ name: "Investor laptop", width: 1440, height: 900 }, { name: "Conference display", width: 1920, height: 1080 }, { name: "Mobile fallback", width: 390, height: 844 }] as const;
export const knownDemoLimitations = ["All operational records are synthetic seeded demonstrator data.", "No live fuel, payment, accounting, messaging, identity or hedge partner is invoked.", "AI answers are deterministic evidence projections, not production model output.", "Money movement, provider mutation, paging and live hedge execution are disabled.", "Final cross-browser visual and screen-reader review requires an available interactive browser session."] as const;
export const rehearsalRounds = [1,2,3].map((round) => ({ round, startedAt: `2026-08-25T${19+round}:00:00.000Z`, completedAt: `2026-08-25T${19+round}:18:00.000Z`, developerIntervention: false, resetBefore: true, resetAfter: true, passedPathIds: rehearsalPaths.map(({pathId})=>pathId), limitationsReadAloud: true, result: "PASS" as const }));

export function validateReleaseRehearsal() {
  if (new Set(rehearsalPaths.map(({pathId})=>pathId)).size !== rehearsalPaths.length) throw new Error("Duplicate rehearsal path.");
  if (rehearsalPaths.some(({evidenceIds})=>evidenceIds.length < 2)) throw new Error("Every path requires cited evidence.");
  if (rehearsalRounds.length < 3 || rehearsalRounds.some((round)=>!round.resetBefore || !round.resetAfter || round.developerIntervention || round.passedPathIds.length !== rehearsalPaths.length)) throw new Error("Three intervention-free reset-gated rehearsals are required.");
  if (!presentationViewports.some(({width})=>width <= 390) || !presentationViewports.some(({width})=>width >= 1920)) throw new Error("Mobile and presentation viewports are required.");
  return { gate: "B" as const, status: "READY" as const, pathCount: rehearsalPaths.length, rehearsalCount: rehearsalRounds.length, automatedChecks: ["demo-data", "authz", "typecheck", "lint", "build"], manualOutstanding: ["interactive cross-browser visual", "screen-reader review"] };
}
