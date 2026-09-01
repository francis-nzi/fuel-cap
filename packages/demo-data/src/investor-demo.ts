export const INVESTOR_DEMO_VERSION = "investor-demo@1.0.0" as const;

export const investorDemoSteps = [
  { stepId: "operating-picture", title: "The operating picture", durationMinutes: 2, workspace: "control-room", scenarioKey: "exposure", principalId: "principal-presenter", organisationId: "org-fuelcap-global", cue: "Start with the customer promise, then show that pricing, ledger, settlement and risk reconcile in one operating view.", evidence: "Living Operations Map · safeguarded-value invariant · cited AI brief" },
  { stepId: "trusted-pricing", title: "Trusted pricing inputs", durationMinutes: 2, workspace: "pricing-data", scenarioKey: "ukQuote", principalId: "principal-data", organisationId: "org-fuelcap-global", cue: "Show that stale or ineligible observations stop a quote instead of silently becoming a commercial price.", evidence: "Canonical decision lineage · freshness and licence controls" },
  { stepId: "governed-spread", title: "Governed spread decision", durationMinutes: 3, workspace: "spread-fx", scenarioKey: "exposure", principalId: "principal-risk", organisationId: "org-fuelcap-global", cue: "Run the spread rehearsal: simulate, approve, schedule, publish, supersede and withdraw while preserving accepted quotes.", evidence: "Maker-checker lifecycle · portfolio impact · quote immutability" },
  { stepId: "ledger-outcome", title: "Customer-to-ledger outcome", durationMinutes: 2, workspace: "transactions-ledger", scenarioKey: "normal", principalId: "principal-finance", organisationId: "org-fuelcap-global", cue: "Follow the protected purchase into balanced journals and safeguarding reconciliation; distinguish customer value from FuelCap economics.", evidence: "Double-entry journal · settlement allocation · safeguarding proof" },
  { stepId: "risk-boundary", title: "Risk without autonomous execution", durationMinutes: 2, workspace: "risk-hedging", scenarioKey: "exposure", principalId: "principal-risk", organisationId: "org-fuelcap-global", cue: "Show exposure, stress and the paper hedge recommendation, then point out that no bank or broker instruction can execute.", evidence: "Stress suite · paper hedge · zero money movement" },
  { stepId: "release-assurance", title: "Release confidence and honest boundaries", durationMinutes: 2, workspace: "platform-integrations-audit", scenarioKey: "exposure", principalId: "principal-presenter", organisationId: "org-fuelcap-global", initialSelection: "release", cue: "Close on automated quality, browser and rollback evidence, then state clearly that live partners and financial activation remain gated.", evidence: "Release provenance · rollback contract · simulation-only boundary" },
] as const;

export function validateInvestorDemoPlan() {
  if (investorDemoSteps.length < 5) throw new Error("Investor demo must tell a complete end-to-end story.");
  if (new Set(investorDemoSteps.map(({ stepId }) => stepId)).size !== investorDemoSteps.length) throw new Error("Investor demo step identifiers must be unique.");
  if (investorDemoSteps.some(({ durationMinutes, cue, evidence }) => durationMinutes < 1 || !cue.trim() || !evidence.trim())) throw new Error("Every investor demo step needs timing, a presenter cue and evidence.");
  const totalMinutes = investorDemoSteps.reduce((total, { durationMinutes }) => total + durationMinutes, 0);
  if (totalMinutes > 15) throw new Error("Investor demo must fit within fifteen minutes.");
  const finalStep = investorDemoSteps.at(-1);
  if (finalStep?.stepId !== "release-assurance" || !finalStep.cue.includes("live partners")) throw new Error("Investor demo must close with honest activation boundaries.");
  return { version: INVESTOR_DEMO_VERSION, stepCount: investorDemoSteps.length, totalMinutes, resetRequired: true as const, liveActivationAuthorised: false as const };
}
