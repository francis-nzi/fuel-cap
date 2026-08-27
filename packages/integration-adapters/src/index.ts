import type { LaunchGateResult } from "@fuelcap/compliance";
import type { IngestionEnvelope, RawProviderObservation } from "@fuelcap/pricing-ingestion";

export type IntegrationEnvironment = "SANDBOX" | "PRODUCTION";
export interface FuelProviderRecord { readonly eventId: string; readonly providerId: string; readonly environment: IntegrationEnvironment; readonly adapterVersion: string; readonly correlationId: string; readonly receivedAt: string; readonly signatureVerified: boolean; readonly payloadHash: `sha256:${string}`; readonly licenceEvidenceId: string; readonly licenceStatus: "APPROVED" | "OPEN" | "EXPIRED"; readonly raw: RawProviderObservation; }
export interface MessagingPreference { readonly organisationId: string; readonly recipientId: string; readonly version: string; readonly marketingAllowed: boolean; readonly availableChannels: readonly ("EMAIL" | "SMS" | "PUSH" | "IN_APP")[]; }
export interface MessageDispatchRequest { readonly communicationId: string; readonly organisationId: string; readonly recipientId: string; readonly environment: IntegrationEnvironment; readonly communicationClass: "REQUIRED" | "TRANSACTIONAL" | "SECURITY_FRAUD" | "SERVICE_ADVISORY" | "MARKETING"; readonly channel: "EMAIL" | "SMS" | "PUSH" | "IN_APP"; readonly templateId: string; readonly templateVersion: string; readonly templateApproved: boolean; readonly renderedContentHash: `sha256:${string}`; readonly idempotencyKey: string; readonly outboxCommittedAtomically: boolean; readonly preference: MessagingPreference; }
export interface DispatchInstruction { readonly instructionId: string; readonly communicationId: string; readonly organisationId: string; readonly recipientId: string; readonly environment: IntegrationEnvironment; readonly channel: MessageDispatchRequest["channel"]; readonly templateId: string; readonly templateVersion: string; readonly renderedContentHash: `sha256:${string}`; readonly idempotencyKey: string; readonly preferenceVersion: string; readonly canSendDirectly: false; readonly requiresWorkerAuthorization: true; readonly immutable: true; }
export interface DeliveryReceipt { readonly providerEventId: string; readonly communicationId: string; readonly organisationId: string; readonly environment: IntegrationEnvironment; readonly state: "SENT" | "DELIVERED" | "BOUNCED" | "FAILED"; readonly occurredAt: string; readonly signatureVerified: boolean; readonly payloadHash: `sha256:${string}`; readonly providerReference: string; }
export interface NormalizedDeliveryReceipt extends DeliveryReceipt { readonly immutable: true; }

export function authorizeIntegrationEnvironment(environment: IntegrationEnvironment, launchGate: LaunchGateResult, capability: "FUEL_PRICE" | "MESSAGING"): void {
  if (environment === "PRODUCTION" && (launchGate.decision !== "READY" || !launchGate.productionCredentialsMayBeProvisioned)) throw new Error(`Production ${capability} integration is blocked by the P6-001 launch gate.`);
}
const requireProviderEvidence = (input: Readonly<{ signatureVerified: boolean; payloadHash: string; occurredAt: string }>) => {
  if (!input.signatureVerified || !input.payloadHash.startsWith("sha256:") || !Number.isFinite(Date.parse(input.occurredAt))) throw new Error("Authenticated, content-addressed provider evidence with a valid timestamp is required.");
};

export function createFuelIngestionEnvelope(record: FuelProviderRecord, launchGate: LaunchGateResult, seenEventIds?: ReadonlySet<string>): IngestionEnvelope {
  authorizeIntegrationEnvironment(record.environment, launchGate, "FUEL_PRICE");
  requireProviderEvidence({ signatureVerified: record.signatureVerified, payloadHash: record.payloadHash, occurredAt: record.receivedAt });
  if (seenEventIds?.has(record.eventId)) throw new Error("Duplicate fuel-provider event is blocked.");
  if (record.licenceStatus !== "APPROVED" || !record.licenceEvidenceId.trim()) throw new Error("Current approved fuel-data licence evidence is required.");
  if (!record.providerId.trim() || !record.adapterVersion.trim() || !record.correlationId.trim()) throw new Error("Provider, adapter and correlation lineage are required.");
  return { envelopeId: `fuel:${record.eventId}`, providerId: record.providerId as IngestionEnvelope["providerId"], adapterVersion: record.adapterVersion, schemaVersion: "pricing-ingestion@1.0.0", correlationId: record.correlationId, receivedAt: record.receivedAt, rawPayloadHash: record.payloadHash, raw: record.raw };
}

export function createMessageDispatchInstruction(request: MessageDispatchRequest, launchGate: LaunchGateResult, seenIdempotencyKeys?: ReadonlySet<string>): DispatchInstruction {
  authorizeIntegrationEnvironment(request.environment, launchGate, "MESSAGING");
  if (request.organisationId !== request.preference.organisationId || request.recipientId !== request.preference.recipientId) throw new Error("Message preference scope does not match the tenant recipient.");
  if (!request.templateApproved || !request.templateVersion.trim() || !request.renderedContentHash.startsWith("sha256:")) throw new Error("Approved versioned template and immutable rendered evidence are required.");
  if (!request.outboxCommittedAtomically || !request.idempotencyKey.trim()) throw new Error("Atomic outbox intent and idempotency key are required.");
  if (seenIdempotencyKeys?.has(request.idempotencyKey)) throw new Error("Duplicate message dispatch is suppressed.");
  if (!request.preference.availableChannels.includes(request.channel)) throw new Error("Selected channel is unavailable for this recipient.");
  if (request.communicationClass === "MARKETING" && !request.preference.marketingAllowed) throw new Error("Marketing consent is required.");
  return { instructionId: `message:${request.communicationId}`, communicationId: request.communicationId, organisationId: request.organisationId, recipientId: request.recipientId, environment: request.environment, channel: request.channel, templateId: request.templateId, templateVersion: request.templateVersion, renderedContentHash: request.renderedContentHash, idempotencyKey: request.idempotencyKey, preferenceVersion: request.preference.version, canSendDirectly: false, requiresWorkerAuthorization: true, immutable: true };
}

export function normalizeDeliveryReceipt(receipt: DeliveryReceipt, launchGate: LaunchGateResult, expected: Readonly<{ organisationId: string; communicationId: string }>, seenProviderEventIds?: ReadonlySet<string>): NormalizedDeliveryReceipt {
  authorizeIntegrationEnvironment(receipt.environment, launchGate, "MESSAGING");
  requireProviderEvidence({ signatureVerified: receipt.signatureVerified, payloadHash: receipt.payloadHash, occurredAt: receipt.occurredAt });
  if (seenProviderEventIds?.has(receipt.providerEventId)) throw new Error("Duplicate delivery receipt is blocked.");
  if (receipt.organisationId !== expected.organisationId || receipt.communicationId !== expected.communicationId || !receipt.providerReference.trim()) throw new Error("Delivery receipt does not match the tenant communication.");
  return { ...receipt, immutable: true };
}
