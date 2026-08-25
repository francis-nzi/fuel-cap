export const GROWTH_CONTRACT_VERSION = "growth-dashboard@1.0.0" as const;
export const legacyGrowthFieldMap = [
  { legacy: "pageView.id", canonical: "growthEvent.eventId", classification: "INTERNAL" },
  { legacy: "pageView.createdAt", canonical: "growthEvent.occurredAt", classification: "INTERNAL" },
  { legacy: "submission.sessionId", canonical: "growthJourney.journeyId", classification: "CONFIDENTIAL" },
  { legacy: "submission.furthestStep", canonical: "growthJourney.furthestStep", classification: "INTERNAL" },
  { legacy: "submission.answers.country", canonical: "growthJourney.market", classification: "INTERNAL" },
  { legacy: "submission.answers.email", canonical: "growthContact.emailReference", classification: "RESTRICTED" },
  { legacy: "submission.utm.*", canonical: "growthJourney.acquisition", classification: "INTERNAL" },
] as const;

export const growthSummary = { organisationId: "org-fuelcap-global", schemaVersion: GROWTH_CONTRACT_VERSION, provenance: "synthetic-seeded", scenarioId: "growth-funnel-demo", scenarioVersion: "1.0.0", generatedAt: "2026-08-25T19:00:00.000Z", pageViews: 240, signupStarts: 96, completed: 38, viewToStartRateBps: 4000, startToCompleteRateBps: 3958, viewToCompleteRateBps: 1583 } as const;
export const growthFunnel = [
  { step: "STARTED", label: "Opened signup", count: 96 }, { step: "COUNTRY", label: "Answered country", count: 88 }, { step: "DRIVER_TYPE", label: "Answered driver type", count: 71 }, { step: "FILL_FREQUENCY", label: "Answered fill frequency", count: 59 }, { step: "POSTCODE", label: "Answered postcode", count: 46 }, { step: "EMAIL", label: "Completed", count: 38 },
] as const;
export const growthMarkets = [{ market: "United States", starts: 58, completed: 25 }, { market: "United Kingdom", starts: 23, completed: 9 }, { market: "Canada", starts: 15, completed: 4 }] as const;
export const growthSources = [{ source: "linkedin", campaign: "fleet-protection", starts: 35, completed: 16 }, { source: "google", campaign: "price-cap", starts: 31, completed: 12 }, { source: "direct", campaign: "none", starts: 30, completed: 10 }] as const;
export const growthContacts = [{ contactId: "CONTACT-DEMO-001", createdAt: "2026-08-25T18:45:00.000Z", market: "US", status: "COMPLETED", emailReference: "contact://demo/001", emailDisplayed: false, source: "linkedin" }, { contactId: "CONTACT-DEMO-002", createdAt: "2026-08-25T18:40:00.000Z", market: "UK", status: "DROPPED_AT_POSTCODE", emailReference: null, emailDisplayed: false, source: "google" }, { contactId: "CONTACT-DEMO-003", createdAt: "2026-08-25T18:35:00.000Z", market: "CA", status: "COMPLETED", emailReference: "contact://demo/003", emailDisplayed: false, source: "direct" }] as const;
export const legacyDashboardRetirement = { legacyPath: "landing-page/app/dashboard", targetSurface: "admin/platform-integrations-audit/growth", sharedPasswordRemovedFromTarget: true, legacyReadOnlyAfter: "2026-08-26T08:00:00.000Z", retirementOwner: "Platform Operations", rollbackReference: "ROLLBACK-P1-008-GROWTH" } as const;

export function validateGrowthProjection() {
  if (growthFunnel.some((row, index) => index > 0 && row.count > growthFunnel[index - 1].count)) throw new Error("Funnel counts must be monotonic.");
  if (growthMarkets.reduce((sum, row) => sum + row.starts, 0) !== growthSummary.signupStarts || growthMarkets.reduce((sum, row) => sum + row.completed, 0) !== growthSummary.completed) throw new Error("Market totals do not reconcile.");
  if (growthSources.reduce((sum, row) => sum + row.starts, 0) !== growthSummary.signupStarts || growthSources.reduce((sum, row) => sum + row.completed, 0) !== growthSummary.completed) throw new Error("Source totals do not reconcile.");
  if (growthContacts.some(({ emailDisplayed }) => emailDisplayed)) throw new Error("Restricted contact values cannot be displayed.");
  return { valid: true as const, pageViews: growthSummary.pageViews, starts: growthSummary.signupStarts, completed: growthSummary.completed };
}
export function growthForOrganisation(organisationId: string) { return organisationId === growthSummary.organisationId ? { summary: growthSummary, funnel: growthFunnel, markets: growthMarkets, sources: growthSources, contacts: growthContacts } : null; }
export function createGrowthExport(actorId: string, allowed: boolean) { if (!allowed) throw new Error("Growth export is not authorised."); return { exportId: "EXPORT-GROWTH-001", actorId, rowCount: growthContacts.length, fields: ["contactId", "createdAt", "market", "status", "emailReference", "source"], watermarked: true, expiresAt: "2026-08-25T20:00:00.000Z", simulated: true }; }
