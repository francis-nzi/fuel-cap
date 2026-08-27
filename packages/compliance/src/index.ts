export type Market = "UK" | "US" | "CA";
export type ControlDomain = "PRODUCT_CLASSIFICATION" | "FINANCIAL_PROMOTION" | "CUSTOMER_TERMS" | "KYC_KYB_AML" | "PAYMENTS_AND_SAFEGUARDING" | "CARD_PROGRAMME" | "PRIVACY_AND_RETENTION" | "FUEL_DATA_LICENSING" | "MESSAGING_CONSENT" | "ACCOUNTING_AND_TAX" | "SECURITY_AND_RESILIENCE";
export type PartnerKind = "LEGAL_COUNSEL" | "COMPLIANCE_ADVISER" | "KYC_PROVIDER" | "PAYMENT_PROVIDER" | "CARD_PROGRAMME_MANAGER" | "BANKING_PROVIDER" | "FUEL_DATA_PROVIDER" | "MESSAGING_PROVIDER" | "ACCOUNTING_ADVISER";
export type EvidenceStatus = "OPEN" | "IN_REVIEW" | "APPROVED" | "REJECTED" | "EXPIRED";

export interface ControlRequirement {
  readonly controlId: string; readonly market: Market; readonly legalEntityId: string;
  readonly domain: ControlDomain; readonly ownerRole: "PLATFORM_ADMIN" | "OPERATIONS" | "RISK_TREASURY" | "FINANCE_RECONCILIATION" | "DATA_INTEGRATIONS";
  readonly requiredPartnerKind: PartnerKind; readonly requiredEvidence: readonly string[];
  readonly blocksCapabilities: readonly string[]; readonly reviewIntervalDays: number;
}
export interface ApprovalEvidence {
  readonly evidenceId: string; readonly controlId: string; readonly status: EvidenceStatus;
  readonly issuer: string; readonly issuedAt: string; readonly expiresAt: string;
  readonly documentHash: string; readonly makerActorId: string; readonly checkerActorId: string;
  readonly market: Market; readonly legalEntityId: string;
}
export interface PartnerReadiness {
  readonly partnerId: string; readonly kind: PartnerKind; readonly environment: "SANDBOX" | "PRODUCTION";
  readonly contractApproved: boolean; readonly dueDiligenceApproved: boolean; readonly dataProcessingApproved: boolean;
  readonly credentialIsolationVerified: boolean; readonly webhookSecurityVerified: boolean; readonly reconciliationCertified: boolean;
}
export interface LaunchGateResult {
  readonly decision: "READY" | "BLOCKED"; readonly evaluatedAt: string;
  readonly passedControlIds: readonly string[]; readonly blockers: readonly string[];
  readonly productionCredentialsMayBeProvisioned: boolean; readonly auditEvidenceIds: readonly string[];
}

export const phase6ControlRequirements: readonly ControlRequirement[] = [
  { controlId: "UK-PRODUCT-001", market: "UK", legalEntityId: "legal-entity-uk-pending", domain: "PRODUCT_CLASSIFICATION", ownerRole: "RISK_TREASURY", requiredPartnerKind: "LEGAL_COUNSEL", requiredEvidence: ["written-classification", "perimeter-analysis", "customer-disclosure-review"], blocksCapabilities: ["UK_CUSTOMER_LAUNCH", "UK_FINANCIAL_PROMOTION"], reviewIntervalDays: 365 },
  { controlId: "US-PRODUCT-001", market: "US", legalEntityId: "legal-entity-us-pending", domain: "PRODUCT_CLASSIFICATION", ownerRole: "RISK_TREASURY", requiredPartnerKind: "LEGAL_COUNSEL", requiredEvidence: ["federal-analysis", "state-scope-analysis", "customer-disclosure-review"], blocksCapabilities: ["US_CUSTOMER_LAUNCH"], reviewIntervalDays: 365 },
  { controlId: "CA-PRODUCT-001", market: "CA", legalEntityId: "legal-entity-ca-pending", domain: "PRODUCT_CLASSIFICATION", ownerRole: "RISK_TREASURY", requiredPartnerKind: "LEGAL_COUNSEL", requiredEvidence: ["federal-analysis", "province-scope-analysis", "customer-disclosure-review"], blocksCapabilities: ["CA_CUSTOMER_LAUNCH"], reviewIntervalDays: 365 },
  { controlId: "GLOBAL-KYC-001", market: "UK", legalEntityId: "legal-entity-uk-pending", domain: "KYC_KYB_AML", ownerRole: "OPERATIONS", requiredPartnerKind: "KYC_PROVIDER", requiredEvidence: ["risk-assessment", "policy-approval", "provider-due-diligence"], blocksCapabilities: ["LIVE_ONBOARDING"], reviewIntervalDays: 365 },
  { controlId: "GLOBAL-PAY-001", market: "UK", legalEntityId: "legal-entity-uk-pending", domain: "PAYMENTS_AND_SAFEGUARDING", ownerRole: "FINANCE_RECONCILIATION", requiredPartnerKind: "PAYMENT_PROVIDER", requiredEvidence: ["funds-flow-approval", "safeguarding-opinion", "reconciliation-certification"], blocksCapabilities: ["LIVE_MONEY_MOVEMENT"], reviewIntervalDays: 180 },
  { controlId: "GLOBAL-DATA-001", market: "UK", legalEntityId: "legal-entity-uk-pending", domain: "FUEL_DATA_LICENSING", ownerRole: "DATA_INTEGRATIONS", requiredPartnerKind: "FUEL_DATA_PROVIDER", requiredEvidence: ["licence-grant", "permitted-use-matrix", "settlement-use-confirmation"], blocksCapabilities: ["LIVE_FUEL_PRICING"], reviewIntervalDays: 365 },
] as const;

const validDate = (value: string) => Number.isFinite(Date.parse(value));
export function evaluatePhase6Launch(input: Readonly<{ requirements: readonly ControlRequirement[]; evidence: readonly ApprovalEvidence[]; partners: readonly PartnerReadiness[]; evaluatedAt: string }>): LaunchGateResult {
  if (!validDate(input.evaluatedAt)) throw new Error("Launch evaluation requires a valid timestamp");
  const now = Date.parse(input.evaluatedAt); const blockers: string[] = []; const passedControlIds: string[] = []; const auditEvidenceIds: string[] = [];
  for (const requirement of input.requirements) {
    const matches = input.evidence.filter((item) => item.controlId === requirement.controlId);
    const approval = matches.find((item) => item.status === "APPROVED" && item.market === requirement.market && item.legalEntityId === requirement.legalEntityId && item.makerActorId !== item.checkerActorId && validDate(item.expiresAt) && Date.parse(item.expiresAt) > now && item.documentHash.startsWith("sha256:"));
    if (!approval) { blockers.push(`${requirement.controlId}: current independently-approved evidence missing`); continue; }
    const partner = input.partners.find((item) => item.kind === requirement.requiredPartnerKind && item.environment === "PRODUCTION");
    if (!partner || !partner.contractApproved || !partner.dueDiligenceApproved || !partner.dataProcessingApproved || !partner.credentialIsolationVerified || !partner.webhookSecurityVerified || !partner.reconciliationCertified) { blockers.push(`${requirement.controlId}: production partner controls incomplete`); continue; }
    passedControlIds.push(requirement.controlId); auditEvidenceIds.push(approval.evidenceId);
  }
  return { decision: blockers.length ? "BLOCKED" : "READY", evaluatedAt: input.evaluatedAt, passedControlIds, blockers, productionCredentialsMayBeProvisioned: blockers.length === 0, auditEvidenceIds };
}

export function createOpenControlRegister(requirements: readonly ControlRequirement[] = phase6ControlRequirements) {
  return requirements.map((requirement) => ({ controlId: requirement.controlId, market: requirement.market, legalEntityId: requirement.legalEntityId, status: "OPEN" as const, blockedCapabilities: requirement.blocksCapabilities, requiredPartnerKind: requirement.requiredPartnerKind }));
}
