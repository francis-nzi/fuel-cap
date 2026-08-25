import { describe, expect, it } from "vitest";
import { approveBillingCorrection, billingBreak, billingRecords, processProviderEvent, providerEvents, xeroProjection } from "./billing-reconciliation";
describe("billing and reconciliation", () => {
  it("keeps billing concepts distinct and journal-linked", () => { expect(new Set(billingRecords.map(({ kind }) => kind)).size).toBe(4); expect(billingRecords.every(({ journalId }) => journalId.startsWith("JRN-"))).toBe(true); });
  it("processes a signed event idempotently", () => { const keys = new Set<string>(); expect(processProviderEvent(providerEvents[0], keys)).toBe("PROCESSED"); expect(processProviderEvent(providerEvents[1], keys)).toBe("DEDUPLICATED"); });
  it("rejects failed signatures without a journal", () => { expect(processProviderEvent(providerEvents[2])).toBe("REJECTED"); expect(providerEvents[2].journalId).toBeNull(); });
  it("labels Xero as a simulated outbound projection", () => expect(xeroProjection).toMatchObject({ simulated: true, status: "PENDING_ACK", retryCount: 1 }));
  it("preserves the blocking fee break", () => expect(billingBreak).toMatchObject({ status: "OPEN", blocking: true, differenceMinor: 325 }));
  it("requires different principals and reconciled evidence", () => { expect(approveBillingCorrection("fr-maker", "fr-checker", "MATCH-009").liveMovement).toBe(false); expect(() => approveBillingCorrection("fr", "fr", "MATCH-009")).toThrow("Self-approval"); expect(() => approveBillingCorrection("maker", "checker", "")).toThrow("evidence"); });
});
