export type BillingKind = "CUSTOMER_FUNDING" | "SUBSCRIPTION" | "FLEET_INVOICE" | "PROTECTION_CHARGE" | "REFUND" | "PROCESSOR_FEE" | "TAX";
export const billingRecords = [
  { id: "BILL-FUND-101", kind: "CUSTOMER_FUNDING" as BillingKind, amountMinor: 25000, currency: "USD", journalId: "JRN-FUND-101", status: "RECONCILED" },
  { id: "BILL-SUB-202", kind: "SUBSCRIPTION" as BillingKind, amountMinor: 1299, currency: "USD", journalId: "JRN-SUB-202", status: "RECONCILED" },
  { id: "BILL-INV-303", kind: "FLEET_INVOICE" as BillingKind, amountMinor: 184500, currency: "USD", journalId: "JRN-INV-303", status: "PENDING_XERO_ACK" },
  { id: "BILL-CHARGE-404", kind: "PROTECTION_CHARGE" as BillingKind, amountMinor: 1642, currency: "USD", journalId: "JRN-CHARGE-404", status: "RECONCILED" },
] as const;
export const providerEvents = [
  { eventId: "evt_demo_101", idempotencyKey: "funding:101", signatureValid: true, payloadHash: "sha256:provider-101", state: "PROCESSED", journalId: "JRN-FUND-101" },
  { eventId: "evt_demo_101_dup", idempotencyKey: "funding:101", signatureValid: true, payloadHash: "sha256:provider-101", state: "DEDUPLICATED", journalId: "JRN-FUND-101" },
  { eventId: "evt_demo_bad", idempotencyKey: "funding:bad", signatureValid: false, payloadHash: "sha256:provider-bad", state: "REJECTED", journalId: null },
] as const;
export const xeroProjection = { projectionId: "XERO-DEMO-303", invoiceId: "BILL-INV-303", version: "xero-projection@1.0", status: "PENDING_ACK", taxCode: "OUTPUT-DEMO", amountMinor: 184500, retryCount: 1, simulated: true } as const;
export const billingBreak = { breakId: "BILL-BREAK-009", differenceMinor: 325, reason: "Processor fee awaiting typed account match", status: "OPEN", blocking: true } as const;
export function processProviderEvent(event: (typeof providerEvents)[number], processedKeys = new Set<string>()) { if (!event.signatureValid) return "REJECTED" as const; if (processedKeys.has(event.idempotencyKey)) return "DEDUPLICATED" as const; processedKeys.add(event.idempotencyKey); return "PROCESSED" as const; }
export function approveBillingCorrection(initiatedBy: string, approvedBy: string, evidenceId: string) { if (initiatedBy === approvedBy) throw new Error("Self-approval is prohibited."); if (!evidenceId.trim()) throw new Error("Reconciled evidence is required."); return { correctionId: "BILL-CORR-009", status: "APPROVED" as const, initiatedBy, approvedBy, evidenceId, liveMovement: false }; }
