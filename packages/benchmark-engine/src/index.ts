import type { NormalizedPriceObservation, ObservationId } from "@fuelcap/pricing-ingestion";

export const BENCHMARK_ENGINE_VERSION = "benchmark-engine@1.0.0" as const;
export type BenchmarkCandidate = Readonly<{ observation: NormalizedPriceObservation; eligibleStationCount: number }>;
export type BenchmarkPolicy = Readonly<{ policyId: string; minimumCandidateCount: number; minimumCoverageBps: number; maximumDispersionBps: number; expectedEligibleStationCount: number }>;
export type CandidateOutcome = "SELECTED" | "CORROBORATING" | "REJECTED";
export type CandidateEvidence = Readonly<{ observationId: ObservationId; outcome: CandidateOutcome; reasonCode: "WEIGHTED_MEDIAN" | "ELIGIBLE_CORROBORATION" | "NOT_QUOTE_LICENSED" | "NON_ACTUAL_INPUT" | "INVALID_WEIGHT"; priceMinor4dp: number; eligibleStationCount: number }>;
export type BenchmarkDecision = Readonly<{
  decisionId: string;
  decisionVersion: typeof BENCHMARK_ENGINE_VERSION;
  policyId: string;
  decidedAt: string;
  status: "PUBLISHED" | "BLOCKED";
  reasonCode: "BENCHMARK_SELECTED" | "INSUFFICIENT_CANDIDATES" | "INSUFFICIENT_COVERAGE" | "EXCESSIVE_DISPERSION";
  benchmarkPriceMinor4dp: number | null;
  selectedObservationId: ObservationId | null;
  coverageBps: number;
  dispersionBps: number | null;
  evidence: readonly CandidateEvidence[];
}>;

const eligible = ({ observation, eligibleStationCount }: BenchmarkCandidate) => observation.kind === "ACTUAL_PUMP" && observation.permittedUses.includes("QUOTE") && eligibleStationCount > 0;
const evidenceForRejected = ({ observation, eligibleStationCount }: BenchmarkCandidate): CandidateEvidence => ({ observationId: observation.observationId, outcome: "REJECTED", reasonCode: observation.kind !== "ACTUAL_PUMP" ? "NON_ACTUAL_INPUT" : !observation.permittedUses.includes("QUOTE") ? "NOT_QUOTE_LICENSED" : "INVALID_WEIGHT", priceMinor4dp: observation.priceMinor4dp, eligibleStationCount });

export function decideBenchmark(decisionId: string, decidedAt: string, candidates: readonly BenchmarkCandidate[], policy: BenchmarkPolicy): BenchmarkDecision {
  if (!Number.isFinite(Date.parse(decidedAt)) || policy.expectedEligibleStationCount <= 0 || policy.minimumCandidateCount <= 0) throw new Error("Invalid benchmark decision input.");
  const accepted = candidates.filter(eligible).sort((a, b) => a.observation.priceMinor4dp - b.observation.priceMinor4dp || a.observation.observationId.localeCompare(b.observation.observationId));
  const acceptedWeight = accepted.reduce((sum, item) => sum + item.eligibleStationCount, 0);
  const coverageBps = Math.min(10_000, Math.floor(acceptedWeight * 10_000 / policy.expectedEligibleStationCount));
  const base = { decisionId, decisionVersion: BENCHMARK_ENGINE_VERSION, policyId: policy.policyId, decidedAt, coverageBps } as const;
  const blocked = (reasonCode: BenchmarkDecision["reasonCode"], dispersionBps: number | null): BenchmarkDecision => ({ ...base, status: "BLOCKED", reasonCode, benchmarkPriceMinor4dp: null, selectedObservationId: null, dispersionBps, evidence: [...accepted.map(({observation,eligibleStationCount}) => ({ observationId: observation.observationId, outcome: "CORROBORATING" as const, reasonCode: "ELIGIBLE_CORROBORATION" as const, priceMinor4dp: observation.priceMinor4dp, eligibleStationCount })), ...candidates.filter((item) => !eligible(item)).map(evidenceForRejected)] });
  if (accepted.length < policy.minimumCandidateCount) return blocked("INSUFFICIENT_CANDIDATES", null);
  if (coverageBps < policy.minimumCoverageBps) return blocked("INSUFFICIENT_COVERAGE", null);
  const threshold = Math.ceil(acceptedWeight / 2); let cumulative = 0; const selected = accepted.find((item) => (cumulative += item.eligibleStationCount) >= threshold)!;
  const min = accepted[0]!.observation.priceMinor4dp; const max = accepted.at(-1)!.observation.priceMinor4dp;
  const dispersionBps = Math.floor((max - min) * 10_000 / selected.observation.priceMinor4dp);
  if (dispersionBps > policy.maximumDispersionBps) return blocked("EXCESSIVE_DISPERSION", dispersionBps);
  return { ...base, status: "PUBLISHED", reasonCode: "BENCHMARK_SELECTED", benchmarkPriceMinor4dp: selected.observation.priceMinor4dp, selectedObservationId: selected.observation.observationId, dispersionBps, evidence: [...accepted.map(({observation,eligibleStationCount}) => ({ observationId: observation.observationId, outcome: observation.observationId === selected.observation.observationId ? "SELECTED" as const : "CORROBORATING" as const, reasonCode: observation.observationId === selected.observation.observationId ? "WEIGHTED_MEDIAN" as const : "ELIGIBLE_CORROBORATION" as const, priceMinor4dp: observation.priceMinor4dp, eligibleStationCount })), ...candidates.filter((item) => !eligible(item)).map(evidenceForRejected)] };
}
