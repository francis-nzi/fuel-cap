import { createHash } from "node:crypto";

export type XeroDocumentType = "INVOICE" | "PAYMENT" | "FEE" | "JOURNAL" | "CREDIT_NOTE";
export type XeroProjectionStatus = "PENDING" | "SENT" | "ACKNOWLEDGED" | "FAILED" | "BLOCKED";
export type AccountingMapping = Readonly<{
  mappingId: string;
  version: number;
  fuelCapAccount: string;
  xeroAccountCode: string;
  xeroTaxType: string | null;
  status: "DRAFT" | "APPROVED";
  makerId: string;
  checkerId: string | null;
}>;
export type XeroProjection = Readonly<{
  projectionId: string;
  organisationId: string;
  documentType: XeroDocumentType;
  sourceId: string;
  sourceVersion: number;
  sourceApproved: true;
  mappingId: string;
  mappingVersion: number;
  payloadHash: string;
  status: XeroProjectionStatus;
  simulated: true;
  attemptCount: number;
  xeroId: string | null;
  acknowledgementId: string | null;
  failureReason: string | null;
  correctionOf: string | null;
}>;
export type XeroReconciliationBreak = Readonly<{
  breakId: string;
  organisationId: string;
  projectionId: string;
  status: "OPEN" | "CLEARED";
  reason: string;
  blocksDownstream: boolean;
}>;

const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

export function approveAccountingMapping(mapping: AccountingMapping, checkerId: string): AccountingMapping {
  if (mapping.status !== "DRAFT" || !checkerId.trim() || checkerId === mapping.makerId) throw new Error("Mapping approval requires a different checker.");
  return { ...mapping, status: "APPROVED", checkerId };
}

export function createXeroProjection(input: Readonly<{
  projectionId: string;
  organisationId: string;
  documentType: XeroDocumentType;
  sourceId: string;
  sourceVersion: number;
  sourceApproved: boolean;
  mapping: AccountingMapping;
  payload: unknown;
  correctionOf?: string | null;
}>): XeroProjection {
  if (!input.projectionId.trim() || !input.organisationId.trim() || !input.sourceId.trim() || !Number.isSafeInteger(input.sourceVersion) || input.sourceVersion <= 0) throw new Error("Projection identity and source version are required.");
  if (!input.sourceApproved || input.mapping.status !== "APPROVED") throw new Error("Only approved sources and mappings can be projected.");
  return { projectionId: input.projectionId, organisationId: input.organisationId, documentType: input.documentType, sourceId: input.sourceId, sourceVersion: input.sourceVersion, sourceApproved: true, mappingId: input.mapping.mappingId, mappingVersion: input.mapping.version, payloadHash: hash(input.payload), status: "PENDING", simulated: true, attemptCount: 0, xeroId: null, acknowledgementId: null, failureReason: null, correctionOf: input.correctionOf ?? null };
}

export function sendXeroProjection(projection: XeroProjection): XeroProjection {
  if (projection.status !== "PENDING" && projection.status !== "FAILED") throw new Error("Only pending or failed projections can be sent.");
  return { ...projection, status: "SENT", attemptCount: projection.attemptCount + 1, failureReason: null };
}

export function acknowledgeXeroProjection(projection: XeroProjection, xeroId: string, acknowledgementId: string): XeroProjection {
  if (projection.status !== "SENT" || !xeroId.trim() || !acknowledgementId.trim()) throw new Error("A sent projection and acknowledgement evidence are required.");
  return { ...projection, status: "ACKNOWLEDGED", xeroId, acknowledgementId };
}

export function failXeroProjection(projection: XeroProjection, reason: string): Readonly<{ projection: XeroProjection; reconciliationBreak: XeroReconciliationBreak }> {
  if (projection.status !== "SENT" || !reason.trim()) throw new Error("A sent projection and failure reason are required.");
  const failed = { ...projection, status: "FAILED" as const, failureReason: reason };
  return { projection: failed, reconciliationBreak: { breakId: `XERO-BREAK:${projection.projectionId}:${projection.attemptCount}`, organisationId: projection.organisationId, projectionId: projection.projectionId, status: "OPEN", reason, blocksDownstream: true } };
}

export function blockXeroProjection(projection: XeroProjection, reconciliationBreak: XeroReconciliationBreak): XeroProjection {
  if (reconciliationBreak.projectionId !== projection.projectionId || reconciliationBreak.organisationId !== projection.organisationId || reconciliationBreak.status !== "OPEN") throw new Error("Open tenant-matched reconciliation evidence is required.");
  return { ...projection, status: "BLOCKED" };
}
