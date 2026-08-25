export type FraudSignal = Readonly<{ signalId: string; type: "VELOCITY" | "LOCATION" | "PAYMENT_FAILURE" | "FLEET_CARD_MISUSE"; scoreBps: number; modelVersion: string; reasonCode: string; provenance: "synthetic-seeded" }>;
export const ontarioCase = {
  caseId: "CASE-CA-ON-018", scenarioId: "eligibility-fraud-canada", organisationId: "fuelcap-global", market: "CA-ON", status: "HUMAN_REVIEW", severity: "WARNING", reviewCount: 18, heldFromRollover4dp: 48_600_000, retainedCustomerValueMinor: 692_000,
  customerId: "CUS-CA-018", openedAt: "2026-08-22T11:02:00.000Z", owner: "principal-compliance", reasonClass: "ELIGIBILITY", availabilityFailure: false, reviewRoute: "Eligibility review and appeal", aiBoundary: "SUMMARY_ONLY",
  signals: [
    { signalId: "SIG-VELOCITY-018", type: "VELOCITY", scoreBps: 8200, modelVersion: "fraud-signals@1.0", reasonCode: "VELOCITY_CLUSTER", provenance: "synthetic-seeded" },
    { signalId: "SIG-LOCATION-018", type: "LOCATION", scoreBps: 7100, modelVersion: "fraud-signals@1.0", reasonCode: "LOCATION_INCONSISTENT", provenance: "synthetic-seeded" },
  ] as readonly FraudSignal[],
} as const;
export const explicitHold = { holdId: "HOLD-CA-018", caseId: ontarioCase.caseId, capability: "AUTO_ROLLOVER", amountMinor: 0, startsAt: "2026-08-22T11:03:00.000Z", expiresAt: "2026-08-24T11:03:00.000Z", customerBalanceErased: false, status: "PROPOSED" } as const;
export const fairnessSnapshot = { version: "fairness-metrics@1.0", falsePositiveRateBps: 320, medianReviewMinutes: 46, protectedAttributesUsed: false, proxyTestStatus: "PASS", explanationTemplate: "eligibility-review-v1" } as const;
export function approveMaterialRestriction(initiatedBy: string, approvedBy: string, evidenceIds: readonly string[], proportional: boolean) { if (initiatedBy === approvedBy) throw new Error("Self-approval is prohibited."); if (!evidenceIds.length) throw new Error("Case evidence is required."); if (!proportional) throw new Error("Disproportionate restriction is prohibited."); return { actionId: "CASE-ACT-CA-018", status: "APPROVED" as const, initiatedBy, approvedBy, holdId: explicitHold.holdId, reviewRoute: ontarioCase.reviewRoute }; }
