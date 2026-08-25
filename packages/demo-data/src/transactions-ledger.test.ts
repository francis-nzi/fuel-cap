import { describe, expect, it } from "vitest";
import { createCorrectionJournal, journalBalance, reconciliationBreak, safeguardingHolds, settlementJournal } from "./transactions-ledger";

describe("immutable transaction ledger", () => {
  it("balances the boundary settlement journal", () => expect(journalBalance(settlementJournal)).toEqual({ debit: 8400, credit: 8400, balanced: true }));
  it("reconciles safeguarding assets to liabilities plus authorised in-flight movement", () => expect(safeguardingHolds()).toBe(true));
  it("records the redeemed position at four-decimal precision", () => expect(settlementJournal.movements[0]).toMatchObject({ type: "REDEEM", quantity4dp: 200_000 }));
  it("keeps the original journal immutable and links a corrective entry", () => { const correction = createCorrectionJournal(settlementJournal, "principal-fr-maker", "principal-fr-checker", "MATCH-017"); expect(correction.correctionOf).toBe(settlementJournal.journalId); expect(correction.previousHash).toBe(settlementJournal.integrityHash); expect(settlementJournal.correctionOf).toBeNull(); });
  it("denies self-approval", () => expect(() => createCorrectionJournal(settlementJournal, "principal-finance", "principal-finance", "MATCH-017")).toThrow("Self-approval"));
  it("denies correction without valid matching evidence", () => expect(() => createCorrectionJournal(settlementJournal, "maker", "checker", "")).toThrow("evidence"));
  it("preserves the open break without mutating its journal", () => expect(reconciliationBreak).toMatchObject({ status: "OPEN", originalMutable: false, differenceMinor: 125 }));
});
