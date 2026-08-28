export const ENTERPRISE_PLATFORM_VERSION = "enterprise-platform@0.1.0" as const;

export type EnterpriseScope = "customers:read" | "fleets:read" | "pricing:read" | "transactions:read" | "reports:read";
export type EnterpriseEvent = "fleet.updated" | "price.decision.published" | "transaction.settled";
export type BrandConfiguration = Readonly<{ configurationId: string; organisationId: string; displayName: string; primaryColour: `#${string}`; logoAssetReference: string; supportUrl: string; termsUrl: string; version: number; state: "DRAFT" | "PUBLISHED"; publishedBy: string | null; approvedBy: string | null; evidenceDigest: `sha256:${string}`; liveCustomerSurface: false }>;
export type ApiCredential = Readonly<{ credentialId: string; organisationId: string; label: string; scopes: readonly EnterpriseScope[]; secretReference: string; secretDisplayed: false; issuedAt: string; expiresAt: string; state: "ACTIVE" | "REVOKED"; sandboxOnly: true }>;
export type WebhookSubscription = Readonly<{ subscriptionId: string; organisationId: string; endpointReference: string; events: readonly EnterpriseEvent[]; signingKeyReference: string; signingSecretDisplayed: false; state: "DRAFT" | "ACTIVE" | "SUSPENDED"; sandboxOnly: true; outboundDeliveryEnabled: false }>;
export type ApiDecision = Readonly<{ allowed: boolean; status: 200 | 401 | 403; reasonCode: "ALLOWED" | "TENANT_MISMATCH" | "CREDENTIAL_INACTIVE" | "CREDENTIAL_EXPIRED" | "SCOPE_DENIED"; credentialId: string; organisationId: string; scope: EnterpriseScope; evidenceIds: readonly string[] }>;
export type WebhookDelivery = Readonly<{ deliveryId: string; subscriptionId: string; organisationId: string; event: EnterpriseEvent; payloadDigest: `sha256:${string}`; idempotencyKey: string; attemptedAt: string; status: "SIMULATED" | "DUPLICATE_SUPPRESSED" | "BLOCKED"; reasonCode: "SANDBOX_REHEARSAL" | "DUPLICATE" | "SUBSCRIPTION_INACTIVE"; networkRequestMade: false }>;

const digestPattern = /^sha256:[a-f0-9]{64}$/;
const referencePattern = /^(asset|vault|endpoint):\/[a-z0-9/_-]+$/;
const allowedScopes: readonly EnterpriseScope[] = ["customers:read", "fleets:read", "pricing:read", "transactions:read", "reports:read"];

export function validateBrandConfiguration(configuration: BrandConfiguration): readonly string[] {
  const reasons: string[] = [];
  if (!configuration.configurationId.trim() || !configuration.organisationId.trim() || !configuration.displayName.trim()) reasons.push("IDENTITY_REQUIRED");
  if (!/^#[0-9a-fA-F]{6}$/.test(configuration.primaryColour)) reasons.push("PRIMARY_COLOUR_INVALID");
  if (!referencePattern.test(configuration.logoAssetReference) || !configuration.logoAssetReference.startsWith("asset:/")) reasons.push("LOGO_REFERENCE_INVALID");
  for (const url of [configuration.supportUrl, configuration.termsUrl]) { try { if (new URL(url).protocol !== "https:") reasons.push("HTTPS_URL_REQUIRED"); } catch { reasons.push("HTTPS_URL_REQUIRED"); } }
  if (!digestPattern.test(configuration.evidenceDigest)) reasons.push("EVIDENCE_DIGEST_INVALID");
  return [...new Set(reasons)];
}

export function publishBrandConfiguration(configuration: BrandConfiguration, input: Readonly<{ makerId: string; checkerId: string; assurance: "STEP_UP" }>): BrandConfiguration {
  if (validateBrandConfiguration(configuration).length || configuration.state !== "DRAFT" || !input.makerId.trim() || !input.checkerId.trim() || input.makerId === input.checkerId || input.assurance !== "STEP_UP") throw new Error("Valid draft and different-checker step-up approval are required.");
  return { ...configuration, state: "PUBLISHED", publishedBy: input.makerId, approvedBy: input.checkerId, liveCustomerSurface: false };
}

export function authoriseEnterpriseApi(input: Readonly<{ credential: ApiCredential; requestOrganisationId: string; requiredScope: EnterpriseScope; now: string }>): ApiDecision {
  const base = { credentialId: input.credential.credentialId, organisationId: input.requestOrganisationId, scope: input.requiredScope, evidenceIds: [`CREDENTIAL:${input.credential.credentialId}`, `SCOPE:${input.requiredScope}`] } as const;
  if (input.credential.organisationId !== input.requestOrganisationId) return { ...base, allowed: false, status: 403, reasonCode: "TENANT_MISMATCH" };
  if (input.credential.state !== "ACTIVE") return { ...base, allowed: false, status: 401, reasonCode: "CREDENTIAL_INACTIVE" };
  if (!Number.isFinite(Date.parse(input.now)) || Date.parse(input.now) >= Date.parse(input.credential.expiresAt)) return { ...base, allowed: false, status: 401, reasonCode: "CREDENTIAL_EXPIRED" };
  if (!allowedScopes.includes(input.requiredScope) || !input.credential.scopes.includes(input.requiredScope)) return { ...base, allowed: false, status: 403, reasonCode: "SCOPE_DENIED" };
  return { ...base, allowed: true, status: 200, reasonCode: "ALLOWED" };
}

export function simulateWebhookDelivery(subscription: WebhookSubscription, input: Readonly<{ deliveryId: string; organisationId: string; event: EnterpriseEvent; payloadDigest: `sha256:${string}`; idempotencyKey: string; attemptedAt: string }>, seen: Set<string>): WebhookDelivery {
  const base = { deliveryId: input.deliveryId, subscriptionId: subscription.subscriptionId, organisationId: input.organisationId, event: input.event, payloadDigest: input.payloadDigest, idempotencyKey: input.idempotencyKey, attemptedAt: input.attemptedAt, networkRequestMade: false } as const;
  if (subscription.state !== "ACTIVE" || subscription.organisationId !== input.organisationId || !subscription.events.includes(input.event) || !digestPattern.test(input.payloadDigest) || !input.idempotencyKey.trim() || !Number.isFinite(Date.parse(input.attemptedAt))) return { ...base, status: "BLOCKED", reasonCode: "SUBSCRIPTION_INACTIVE" };
  const replayKey = `${subscription.subscriptionId}:${input.idempotencyKey}`;
  if (seen.has(replayKey)) return { ...base, status: "DUPLICATE_SUPPRESSED", reasonCode: "DUPLICATE" };
  seen.add(replayKey);
  return { ...base, status: "SIMULATED", reasonCode: "SANDBOX_REHEARSAL" };
}

export const seededBrandDraft: BrandConfiguration = { configurationId: "BRAND-NORTHSTAR-2", organisationId: "org-northstar-logistics", displayName: "Northstar Fuel Protection", primaryColour: "#174C3C", logoAssetReference: "asset:/brands/northstar/logo-v2", supportUrl: "https://support.example.invalid/northstar", termsUrl: "https://legal.example.invalid/northstar/terms", version: 2, state: "DRAFT", publishedBy: null, approvedBy: null, evidenceDigest: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", liveCustomerSurface: false };
export const seededPublishedBrand = publishBrandConfiguration(seededBrandDraft, { makerId: "principal-enterprise-maker", checkerId: "principal-platform-checker", assurance: "STEP_UP" });
export const seededApiCredential: ApiCredential = { credentialId: "API-NORTHSTAR-SBX-1", organisationId: "org-northstar-logistics", label: "Northstar reporting sandbox", scopes: ["fleets:read", "pricing:read", "reports:read"], secretReference: "vault:/enterprise/northstar/api-1", secretDisplayed: false, issuedAt: "2026-08-28T09:00:00Z", expiresAt: "2026-11-26T09:00:00Z", state: "ACTIVE", sandboxOnly: true };
export const seededWebhookSubscription: WebhookSubscription = { subscriptionId: "WEBHOOK-NORTHSTAR-SBX-1", organisationId: "org-northstar-logistics", endpointReference: "endpoint:/enterprise/northstar/events", events: ["fleet.updated", "price.decision.published"], signingKeyReference: "vault:/enterprise/northstar/webhook-1", signingSecretDisplayed: false, state: "ACTIVE", sandboxOnly: true, outboundDeliveryEnabled: false };
