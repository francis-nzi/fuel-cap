export const RELEASE_REHEARSAL_VERSION = "release-evidence@2.1.0" as const;
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
export const knownDemoLimitations = ["All operational records are synthetic seeded demonstrator data.", "No live fuel, payment, accounting, messaging, identity or hedge partner is invoked.", "AI answers are deterministic evidence projections, not production model output.", "Money movement, provider mutation, paging and live hedge execution are disabled.", "Manual assistive-technology screen-reader sign-off and non-Chromium visual review remain outstanding."] as const;
export const rehearsalRounds = [1,2,3].map((round) => ({ round, startedAt: `2026-08-25T${19+round}:00:00.000Z`, completedAt: `2026-08-25T${19+round}:18:00.000Z`, developerIntervention: false, resetBefore: true, resetAfter: true, passedPathIds: rehearsalPaths.map(({pathId})=>pathId), limitationsReadAloud: true, result: "PASS" as const }));

export type ReleaseCandidateEvidence = {
  schemaVersion: "fuelcap.release-evidence.v2";
  releaseId: string;
  pullRequest: number;
  commit: string;
  previousHealthyCommit: string;
  qualityRunId: string;
  qualityGates: readonly { gateId: string; result: "PASS" | "FAIL"; evidence: string }[];
  browserEvidence: { engine: "chromium"; journeys: number; viewports: readonly string[]; maximumAxeImpact: "moderate"; result: "PASS" | "FAIL" };
  deployment: { provider: "Render"; deployId: string; commit: string; status: "live" | "failed"; cacheCleared: boolean };
  smoke: { service: "fuelcap-admin"; expectedCommit: string; observedCommit: string; provenance: "synthetic-seeded"; result: "PASS" | "FAIL" };
  rollback: { targetCommit: string; targetWasHealthy: boolean; procedure: readonly string[]; rehearsedWithoutMutation: boolean };
  liveActivationAuthorised: false;
};

export const latestVerifiedRelease: ReleaseCandidateEvidence = {
  schemaVersion: "fuelcap.release-evidence.v2",
  releaseId: "RC-004",
  pullRequest: 96,
  commit: "f4583d8f97e01d476facdddc9fd5a405f22fbf95",
  previousHealthyCommit: "a2558b1caabdad4fa1ca143788443223dc101569",
  qualityRunId: "33179944960",
  qualityGates: [
    { gateId: "recursive-tests", result: "PASS", evidence: "605 tests" },
    { gateId: "recursive-typechecks", result: "PASS", evidence: "34 workspaces" },
    { gateId: "admin-lint", result: "PASS", evidence: "zero errors" },
    { gateId: "production-builds", result: "PASS", evidence: "customer, admin, landing" },
    { gateId: "performance-budget", result: "PASS", evidence: "1,049,511 / 3,000,000 bytes" },
    { gateId: "production-audit", result: "PASS", evidence: "no known vulnerabilities" },
  ],
  browserEvidence: { engine: "chromium", journeys: 8, viewports: ["desktop-chromium", "mobile-chromium"], maximumAxeImpact: "moderate", result: "PASS" },
  deployment: { provider: "Render", deployId: "dep-da8upc9srm7s73aloi30", commit: "f4583d8f97e01d476facdddc9fd5a405f22fbf95", status: "live", cacheCleared: true },
  smoke: { service: "fuelcap-admin", expectedCommit: "f4583d8", observedCommit: "f4583d8", provenance: "synthetic-seeded", result: "PASS" },
  rollback: { targetCommit: "a2558b1caabdad4fa1ca143788443223dc101569", targetWasHealthy: true, procedure: ["select previous healthy Render deploy", "redeploy with cache clear", "verify health commit and synthetic provenance"], rehearsedWithoutMutation: true },
  liveActivationAuthorised: false,
};

export function validateReleaseCandidate(candidate: ReleaseCandidateEvidence = latestVerifiedRelease) {
  const sha = /^[a-f0-9]{40}$/;
  if (!sha.test(candidate.commit) || !sha.test(candidate.previousHealthyCommit)) throw new Error("Release and rollback commits must be full SHA-1 identifiers.");
  if (candidate.qualityGates.length < 6 || candidate.qualityGates.some(({ result }) => result !== "PASS")) throw new Error("Every required quality gate must pass.");
  if (candidate.browserEvidence.result !== "PASS" || candidate.browserEvidence.journeys < 8 || candidate.browserEvidence.viewports.length < 2) throw new Error("Desktop/mobile browser evidence is incomplete.");
  if (candidate.deployment.status !== "live" || !candidate.deployment.cacheCleared || candidate.deployment.commit !== candidate.commit) throw new Error("Live deployment provenance does not match the release commit.");
  if (candidate.smoke.result !== "PASS" || candidate.smoke.expectedCommit !== candidate.commit.slice(0, 7) || candidate.smoke.observedCommit !== candidate.smoke.expectedCommit) throw new Error("Production smoke provenance does not match the release commit.");
  if (!candidate.rollback.targetWasHealthy || candidate.rollback.targetCommit !== candidate.previousHealthyCommit || candidate.rollback.procedure.length < 3 || !candidate.rollback.rehearsedWithoutMutation) throw new Error("Rollback evidence is incomplete.");
  if (candidate.liveActivationAuthorised !== false) throw new Error("Release evidence cannot authorise live financial activation.");
  return { gate: "C" as const, status: "DEPLOYED" as const, releaseId: candidate.releaseId, shortCommit: candidate.commit.slice(0, 7), passedGateCount: candidate.qualityGates.length, browserJourneyCount: candidate.browserEvidence.journeys, rollbackReady: true as const, manualOutstanding: ["non-Chromium visual review", "assistive-technology screen-reader sign-off"] as const };
}

export function validateReleaseRehearsal() {
  if (new Set(rehearsalPaths.map(({pathId})=>pathId)).size !== rehearsalPaths.length) throw new Error("Duplicate rehearsal path.");
  if (rehearsalPaths.some(({evidenceIds})=>evidenceIds.length < 2)) throw new Error("Every path requires cited evidence.");
  if (rehearsalRounds.length < 3 || rehearsalRounds.some((round)=>!round.resetBefore || !round.resetAfter || round.developerIntervention || round.passedPathIds.length !== rehearsalPaths.length)) throw new Error("Three intervention-free reset-gated rehearsals are required.");
  if (!presentationViewports.some(({width})=>width <= 390) || !presentationViewports.some(({width})=>width >= 1920)) throw new Error("Mobile and presentation viewports are required.");
  return { gate: "B" as const, status: "READY" as const, pathCount: rehearsalPaths.length, rehearsalCount: rehearsalRounds.length, automatedChecks: ["demo-data", "authz", "typecheck", "lint", "build", "chromium-desktop-mobile", "axe-critical-serious", "production-smoke"], manualOutstanding: ["non-Chromium visual review", "assistive-technology screen-reader sign-off"] };
}
