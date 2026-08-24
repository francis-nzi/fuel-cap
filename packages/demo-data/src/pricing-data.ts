export type PricingUse = "DISPLAY" | "QUOTE" | "SETTLE" | "SIMULATE";
export type LicenceClass = "STATION_ACTUAL" | "BENCHMARK_ONLY" | "ILLUSTRATIVE_ONLY";
export type CandidateDecision = "SELECTED" | "REJECTED" | "CORROBORATING" | "EXCLUDED";

type ObservationBase = Readonly<{
  observationId: string;
  source: string;
  observedAt: string;
  market: "US-TX";
  grade: "REGULAR";
  currency: "USD";
  unit: "US_GALLON";
  priceMinor4dp: number;
  licenceClass: LicenceClass;
  permittedUses: readonly PricingUse[];
  provenance: "synthetic-seeded" | "historically-derived" | "illustrative-fixed";
  freshnessSeconds: number;
  decision: CandidateDecision;
  reason: string;
}>;

export type ActualPumpObservation = ObservationBase & Readonly<{ observationType: "ACTUAL_PUMP"; stationCount: number }>;
export type ReferencePrice = ObservationBase & Readonly<{ observationType: "REFERENCE"; benchmarkRegion: string }>;
export type SimulatedPumpObservation = ObservationBase & Readonly<{ observationType: "SIMULATED_PUMP"; simulationMethod: string }>;
export type PricingObservation = ActualPumpObservation | ReferencePrice | SimulatedPumpObservation;

export type CanonicalPriceDecision = Readonly<{
  decisionId: string;
  decisionVersion: "pricing-data@1.5";
  algorithmVersion: "canonical-selection@1.3";
  scenarioId: "pricing-observation-conflict-us";
  scenarioVersion: "1.0.0";
  decidedAt: string;
  market: "US-TX";
  grade: "REGULAR";
  currency: "USD";
  unit: "US_GALLON";
  canonicalPriceMinor4dp: number;
  selectedObservationId: string;
  quoteEligible: true;
  settlementEligible: true;
  displayEligible: true;
  coveragePercent: 98.1;
  provenance: "synthetic-seeded";
  observations: readonly PricingObservation[];
}>;

export const canonicalPricingDecision: CanonicalPriceDecision = {
  decisionId: "PRICE-DEC-TX-0842",
  decisionVersion: "pricing-data@1.5",
  algorithmVersion: "canonical-selection@1.3",
  scenarioId: "pricing-observation-conflict-us",
  scenarioVersion: "1.0.0",
  decidedAt: "2026-08-21T16:45:03Z",
  market: "US-TX",
  grade: "REGULAR",
  currency: "USD",
  unit: "US_GALLON",
  canonicalPriceMinor4dp: 35800,
  selectedObservationId: "OBS-TX-ACTUAL-0842",
  quoteEligible: true,
  settlementEligible: true,
  displayEligible: true,
  coveragePercent: 98.1,
  provenance: "synthetic-seeded",
  observations: [
    { observationId: "OBS-TX-ACTUAL-0842", observationType: "ACTUAL_PUMP", source: "Texas eligible station set", observedAt: "2026-08-21T16:44:21Z", market: "US-TX", grade: "REGULAR", currency: "USD", unit: "US_GALLON", priceMinor4dp: 35800, licenceClass: "STATION_ACTUAL", permittedUses: ["DISPLAY", "QUOTE", "SETTLE", "SIMULATE"], provenance: "synthetic-seeded", freshnessSeconds: 42, stationCount: 41, decision: "SELECTED", reason: "Fresh, exact-grade actual observations with sufficient eligible coverage." },
    { observationId: "OBS-TX-ACTUAL-0837", observationType: "ACTUAL_PUMP", source: "Secondary station contributor", observedAt: "2026-08-21T16:43:54Z", market: "US-TX", grade: "REGULAR", currency: "USD", unit: "US_GALLON", priceMinor4dp: 37490, licenceClass: "STATION_ACTUAL", permittedUses: ["DISPLAY", "QUOTE", "SETTLE", "SIMULATE"], provenance: "synthetic-seeded", freshnessSeconds: 69, stationCount: 7, decision: "REJECTED", reason: "Preserved as a conflicting candidate; outside the governed regional tolerance." },
    { observationId: "OBS-EIA-GC-0801", observationType: "REFERENCE", source: "EIA Gulf Coast benchmark", observedAt: "2026-08-21T16:41:03Z", market: "US-TX", grade: "REGULAR", currency: "USD", unit: "US_GALLON", priceMinor4dp: 35560, licenceClass: "BENCHMARK_ONLY", permittedUses: ["DISPLAY", "SIMULATE"], provenance: "historically-derived", freshnessSeconds: 240, benchmarkRegion: "US Gulf Coast", decision: "CORROBORATING", reason: "Corroborates direction only; licence class prohibits quote and settlement use." },
    { observationId: "OBS-SIM-TX-0700", observationType: "SIMULATED_PUMP", source: "Deterministic scenario generator", observedAt: "2026-08-21T16:40:00Z", market: "US-TX", grade: "REGULAR", currency: "USD", unit: "US_GALLON", priceMinor4dp: 36100, licenceClass: "ILLUSTRATIVE_ONLY", permittedUses: ["SIMULATE"], provenance: "illustrative-fixed", freshnessSeconds: 303, simulationMethod: "seeded-regional-curve@1.0", decision: "EXCLUDED", reason: "Visible demonstrator evidence; never eligible for a real quote or settlement." },
  ],
};

export function observationSupports(observation: PricingObservation, use: PricingUse) {
  return observation.permittedUses.includes(use);
}

export function selectedPricingObservation(decision: CanonicalPriceDecision) {
  return decision.observations.find(({ observationId }) => observationId === decision.selectedObservationId);
}

export function pricingDecisionIsInternallyValid(decision: CanonicalPriceDecision) {
  const selected = selectedPricingObservation(decision);
  return selected?.observationType === "ACTUAL_PUMP"
    && selected.decision === "SELECTED"
    && observationSupports(selected, "QUOTE")
    && observationSupports(selected, "SETTLE")
    && selected.priceMinor4dp === decision.canonicalPriceMinor4dp;
}
