export type ExposureCurrency = "USD" | "CAD" | "GBP";
export type AcceptedPosition = Readonly<{ positionId: string; organisationId: string; legalEntityId: string; status: "QUOTED" | "ACCEPTED" | "CLOSED"; remainingQuantity4dp: number; market: string; grade: string; geography: string; currency: ExposureCurrency; strikePrice4dp: number; boundaryPrice4dp: number; expiry: string; customerId: string; fleetId: string | null; basisRiskCategory: string; expectedClaimMinor: number; priceDecisionVersion: string; spreadDecisionVersion: string; fxDecisionVersion: string; rulesVersion: string }>;
export type ExposureDimension = Readonly<{ key: string; quantity4dp: number; concentrationBps: number; valueAtBoundaryMinor: number }>;
export type ExposureSnapshot = Readonly<{ snapshotId: string; version: "exposure-snapshot@1.0"; organisationId: string; legalEntityId: string; currency: ExposureCurrency; asOf: string; acceptedQuantity4dp: number; valueAtBoundaryMinor: number; expectedClaimsMinor: number; reserveAvailableMinor: number; positionIds: readonly string[]; marketGrade: readonly ExposureDimension[]; geography: readonly ExposureDimension[]; expiryBucket: readonly ExposureDimension[]; customerFleet: readonly ExposureDimension[]; basisRisk: readonly ExposureDimension[]; evidenceVersions: readonly string[]; reconciliationStatus: "PASS" | "BREAK"; simulated: true }>;
export type ExposureLimits = Readonly<{ limitVersion: string; maxQuantity4dp: number; maxValueAtBoundaryMinor: number; maxConcentrationBps: number; minimumReserveCoverageBps: number; warningUtilisationBps: number }>;
export type LimitAssessment = Readonly<{ snapshotId: string; limitVersion: string; status: "NORMAL" | "WARNING" | "CRITICAL"; quantityUtilisationBps: number; valueUtilisationBps: number; maximumConcentrationBps: number; reserveCoverageBps: number; reasonCodes: readonly string[]; blocksDownstream: boolean }>;
export type StressKind = "CALM" | "WITHIN_BOUNDARY_RISE" | "BOUNDARY_BREACH" | "VOLATILITY_SHOCK" | "BASIS_DIVERGENCE" | "CORRELATION_BREAKDOWN" | "COUNTERPARTY_FAILURE";
export type StressAssumption = Readonly<{ stressId: string; kind: StressKind; modelVersion: string; assumptionVersion: string; claimBpsOfBoundaryValue: number; payoffBpsOfBoundaryValue: number; basisResidualBpsOfBoundaryValue: number }>;
export type StressResult = Readonly<{ stressId: string; kind: StressKind; snapshotId: string; modelVersion: string; assumptionVersion: string; expectedClaimsMinor: number; simulatedPayoffMinor: number; reserveUseMinor: number; residualExposureMinor: number; reserveCoverageBps: number; outcome: "CONTROLLED" | "WATCH" | "CRITICAL"; simulated: true }>;

const minorAtBoundary = (position: AcceptedPosition) => Math.floor((position.remainingQuantity4dp * (position.boundaryPrice4dp - position.strikePrice4dp) + 500_000) / 1_000_000);
const expiryBucket = (expiry: string, asOf: string) => { const days = Math.ceil((Date.parse(expiry) - Date.parse(asOf)) / 86_400_000); return days <= 7 ? "0-7D" : days <= 30 ? "8-30D" : "31D+"; };
function dimensions(positions: readonly AcceptedPosition[], totalQuantity4dp: number, keyFor: (position: AcceptedPosition) => string): readonly ExposureDimension[] {
  const grouped = new Map<string, AcceptedPosition[]>();
  for (const position of positions) grouped.set(keyFor(position), [...(grouped.get(keyFor(position)) ?? []), position]);
  return [...grouped.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([key, values]) => { const quantity4dp = values.reduce((sum, value) => sum + value.remainingQuantity4dp, 0); return { key, quantity4dp, concentrationBps: Math.round(quantity4dp * 10_000 / totalQuantity4dp), valueAtBoundaryMinor: values.reduce((sum, value) => sum + minorAtBoundary(value), 0) }; });
}

export function createExposureSnapshot(input: Readonly<{ snapshotId: string; organisationId: string; legalEntityId: string; currency: ExposureCurrency; asOf: string; reserveAvailableMinor: number; reconciliationStatus: "PASS" | "BREAK"; positions: readonly AcceptedPosition[] }>): ExposureSnapshot {
  if (!input.snapshotId.trim() || !input.positions.length || !Number.isFinite(Date.parse(input.asOf)) || !Number.isSafeInteger(input.reserveAvailableMinor) || input.reserveAvailableMinor < 0) throw new Error("Snapshot identity, positions, time and reserve are required.");
  if (input.positions.some((position) => position.status !== "ACCEPTED" || position.remainingQuantity4dp <= 0)) throw new Error("Exposure can contain only accepted remaining positions.");
  if (input.positions.some((position) => position.organisationId !== input.organisationId || position.legalEntityId !== input.legalEntityId || position.currency !== input.currency)) throw new Error("Cross-tenant, legal-entity or currency exposure is prohibited.");
  if (input.positions.some((position) => position.boundaryPrice4dp < position.strikePrice4dp || !Number.isSafeInteger(position.expectedClaimMinor) || position.expectedClaimMinor < 0)) throw new Error("Position boundary and expected claim are invalid.");
  const acceptedQuantity4dp = input.positions.reduce((sum, position) => sum + position.remainingQuantity4dp, 0);
  const evidenceVersions = [...new Set(input.positions.flatMap((position) => [position.priceDecisionVersion, position.spreadDecisionVersion, position.fxDecisionVersion, position.rulesVersion]))];
  return { snapshotId: input.snapshotId, version: "exposure-snapshot@1.0", organisationId: input.organisationId, legalEntityId: input.legalEntityId, currency: input.currency, asOf: input.asOf, acceptedQuantity4dp, valueAtBoundaryMinor: input.positions.reduce((sum, position) => sum + minorAtBoundary(position), 0), expectedClaimsMinor: input.positions.reduce((sum, position) => sum + position.expectedClaimMinor, 0), reserveAvailableMinor: input.reserveAvailableMinor, positionIds: input.positions.map(({ positionId }) => positionId), marketGrade: dimensions(input.positions, acceptedQuantity4dp, (position) => `${position.market}:${position.grade}`), geography: dimensions(input.positions, acceptedQuantity4dp, (position) => position.geography), expiryBucket: dimensions(input.positions, acceptedQuantity4dp, (position) => expiryBucket(position.expiry, input.asOf)), customerFleet: dimensions(input.positions, acceptedQuantity4dp, (position) => position.fleetId ?? position.customerId), basisRisk: dimensions(input.positions, acceptedQuantity4dp, (position) => position.basisRiskCategory), evidenceVersions, reconciliationStatus: input.reconciliationStatus, simulated: true };
}

export function assessExposureLimits(snapshot: ExposureSnapshot, limits: ExposureLimits): LimitAssessment {
  if ([limits.maxQuantity4dp, limits.maxValueAtBoundaryMinor, limits.maxConcentrationBps, limits.minimumReserveCoverageBps, limits.warningUtilisationBps].some((value) => !Number.isSafeInteger(value) || value <= 0)) throw new Error("Exposure limits must be positive integers.");
  const quantityUtilisationBps = Math.round(snapshot.acceptedQuantity4dp * 10_000 / limits.maxQuantity4dp);
  const valueUtilisationBps = Math.round(snapshot.valueAtBoundaryMinor * 10_000 / limits.maxValueAtBoundaryMinor);
  const maximumConcentrationBps = Math.max(...snapshot.customerFleet.map(({ concentrationBps }) => concentrationBps));
  const reserveCoverageBps = snapshot.expectedClaimsMinor === 0 ? 10_000 : Math.round(snapshot.reserveAvailableMinor * 10_000 / snapshot.expectedClaimsMinor);
  const reasonCodes: string[] = [];
  if (snapshot.reconciliationStatus === "BREAK") reasonCodes.push("RECONCILIATION_BREAK");
  if (quantityUtilisationBps > 10_000) reasonCodes.push("QUANTITY_LIMIT_EXCEEDED");
  if (valueUtilisationBps > 10_000) reasonCodes.push("BOUNDARY_VALUE_LIMIT_EXCEEDED");
  if (maximumConcentrationBps > limits.maxConcentrationBps) reasonCodes.push("CONCENTRATION_LIMIT_EXCEEDED");
  if (reserveCoverageBps < limits.minimumReserveCoverageBps) reasonCodes.push("RESERVE_COVERAGE_BELOW_MINIMUM");
  const critical = reasonCodes.length > 0;
  const warning = !critical && Math.max(quantityUtilisationBps, valueUtilisationBps) >= limits.warningUtilisationBps;
  return { snapshotId: snapshot.snapshotId, limitVersion: limits.limitVersion, status: critical ? "CRITICAL" : warning ? "WARNING" : "NORMAL", quantityUtilisationBps, valueUtilisationBps, maximumConcentrationBps, reserveCoverageBps, reasonCodes, blocksDownstream: critical };
}

export function runExposureStress(snapshot: ExposureSnapshot, assumption: StressAssumption): StressResult {
  if ([assumption.claimBpsOfBoundaryValue, assumption.payoffBpsOfBoundaryValue, assumption.basisResidualBpsOfBoundaryValue].some((value) => !Number.isSafeInteger(value) || value < 0 || value > 20_000)) throw new Error("Stress assumptions must be bounded basis points.");
  const expectedClaimsMinor = Math.round(snapshot.valueAtBoundaryMinor * assumption.claimBpsOfBoundaryValue / 10_000);
  const simulatedPayoffMinor = assumption.kind === "COUNTERPARTY_FAILURE" ? 0 : Math.min(expectedClaimsMinor, Math.round(snapshot.valueAtBoundaryMinor * assumption.payoffBpsOfBoundaryValue / 10_000));
  const reserveUseMinor = Math.max(0, expectedClaimsMinor - simulatedPayoffMinor);
  const residualExposureMinor = Math.round(snapshot.valueAtBoundaryMinor * assumption.basisResidualBpsOfBoundaryValue / 10_000) + Math.max(0, reserveUseMinor - snapshot.reserveAvailableMinor);
  const reserveCoverageBps = reserveUseMinor === 0 ? 10_000 : Math.round(snapshot.reserveAvailableMinor * 10_000 / reserveUseMinor);
  const outcome = assumption.kind === "COUNTERPARTY_FAILURE" || residualExposureMinor > 0 || reserveCoverageBps < 10_000 ? "CRITICAL" : reserveCoverageBps < 12_500 ? "WATCH" : "CONTROLLED";
  return { stressId: assumption.stressId, kind: assumption.kind, snapshotId: snapshot.snapshotId, modelVersion: assumption.modelVersion, assumptionVersion: assumption.assumptionVersion, expectedClaimsMinor, simulatedPayoffMinor, reserveUseMinor, residualExposureMinor, reserveCoverageBps, outcome, simulated: true };
}

export function runApprovedStressSuite(snapshot: ExposureSnapshot, assumptions: readonly StressAssumption[]): readonly StressResult[] {
  const required: readonly StressKind[] = ["CALM", "WITHIN_BOUNDARY_RISE", "BOUNDARY_BREACH", "VOLATILITY_SHOCK", "BASIS_DIVERGENCE", "CORRELATION_BREAKDOWN", "COUNTERPARTY_FAILURE"];
  if (assumptions.length !== required.length || required.some((kind) => assumptions.filter((item) => item.kind === kind).length !== 1)) throw new Error("The calm state and all six approved adverse stresses are required exactly once.");
  return assumptions.map((assumption) => runExposureStress(snapshot, assumption));
}

export * from "./paper";
