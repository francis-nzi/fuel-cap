export type JournalLine = Readonly<{ lineId: string; account: string; side: "DEBIT" | "CREDIT"; amountMinor: number; currency: "USD" }>;
export type PositionMovement = Readonly<{ movementId: string; positionId: string; type: "PROTECT" | "ALLOCATE" | "REDEEM" | "REMAIN"; quantity4dp: number }>;
export type DemoJournal = Readonly<{ journalId: string; sequence: number; transactionId: string; eventType: string; postedAt: string; lines: readonly JournalLine[]; movements: readonly PositionMovement[]; previousHash: string; integrityHash: string; correctionOf: string | null }>;

export const settlementJournal: DemoJournal = {
  journalId: "JRN-SETTLE-TX-0842", sequence: 842, transactionId: "TXN-TX-0842", eventType: "FUEL_SETTLED", postedAt: "2026-08-21T16:46:00.000Z", correctionOf: null,
  previousHash: "sha256:sequence-841", integrityHash: "sha256:journal-842-demo",
  lines: [
    { lineId: "LINE-842-1", account: "customer-protected-liability", side: "DEBIT", amountMinor: 7700, currency: "USD" },
    { lineId: "LINE-842-2", account: "fuelcap-claims-expense", side: "DEBIT", amountMinor: 700, currency: "USD" },
    { lineId: "LINE-842-3", account: "station-payable", side: "CREDIT", amountMinor: 8400, currency: "USD" },
  ],
  movements: [{ movementId: "MOV-842-1", positionId: "POS-TX-FLEET-001", type: "REDEEM", quantity4dp: 200_000 }],
};

export const safeguardingProjection = { safeguardedMinor: 2_126_940_00, customerLiabilityMinor: 2_108_104_00, authorisedInFlightMinor: 1_883_600, invariant: "HOLDS" as const };
export const reconciliationBreak = { breakId: "BREAK-DEMO-017", status: "OPEN" as const, journalId: settlementJournal.journalId, differenceMinor: 125, reason: "External station reference pending match", originalMutable: false };

export function journalBalance(journal: DemoJournal) { const debit = journal.lines.filter((line) => line.side === "DEBIT").reduce((sum, line) => sum + line.amountMinor, 0); const credit = journal.lines.filter((line) => line.side === "CREDIT").reduce((sum, line) => sum + line.amountMinor, 0); return { debit, credit, balanced: debit === credit }; }
export function safeguardingHolds(projection = safeguardingProjection) { return projection.safeguardedMinor === projection.customerLiabilityMinor + projection.authorisedInFlightMinor; }
export function createCorrectionJournal(original: DemoJournal, initiatedBy: string, approvedBy: string, evidenceId: string): DemoJournal {
  if (initiatedBy === approvedBy) throw new Error("Self-approval is prohibited for reconciliation correction.");
  if (!evidenceId.trim()) throw new Error("Valid matching evidence is required.");
  return { ...original, journalId: `${original.journalId}-CORR-01`, sequence: original.sequence + 1, eventType: "RECONCILIATION_CORRECTION", postedAt: "2026-08-21T16:50:00.000Z", correctionOf: original.journalId, previousHash: original.integrityHash, integrityHash: "sha256:journal-843-correction-demo" };
}
