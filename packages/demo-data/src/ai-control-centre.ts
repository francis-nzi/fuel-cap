export type CopilotQuestionId = "PRICE_INTEGRITY" | "SPREAD_BREAKDOWN" | "BOUNDARY_EXPOSURE" | "LEDGER_BALANCE" | "CASE_PRIORITY" | "ALERT_STATUS" | "CONFIG_CHANGE" | "DEMO_LIMITATIONS";
export type CopilotAnswer = Readonly<{ questionId: CopilotQuestionId; status: "SUPPORTED" | "VERIFY" | "ABSTAIN" | "BLOCKED"; answer: string; confidenceBps: number; citations: readonly string[]; facts: readonly string[]; inference: string | null; recommendation: string | null; humanRoute: string | null; readOnly: true; policyVersion: "ai-policy@1.0.0" }>;

export const approvedInvestorQuestions: readonly Readonly<{ questionId: CopilotQuestionId; question: string; expectedEvidence: readonly string[] }>[] = [
  { questionId: "PRICE_INTEGRITY", question: "Why is the current fuel price eligible?", expectedEvidence: ["OBS-TX-ACTUAL-0837", "pricing-data@1.4"] },
  { questionId: "SPREAD_BREAKDOWN", question: "What makes up the 2.30% protection charge?", expectedEvidence: ["spread-calm-2.30-v1", "DEC-014"] },
  { questionId: "BOUNDARY_EXPOSURE", question: "Where is reserve exposure concentrated?", expectedEvidence: ["EXP-2026-08-25-1600", "STRESS-BREACH"] },
  { questionId: "LEDGER_BALANCE", question: "Does the demonstrator ledger reconcile?", expectedEvidence: ["JRN-DEMO-00842", "RECON-DEMO-00842"] },
  { questionId: "CASE_PRIORITY", question: "Which case needs human review first?", expectedEvidence: ["CASE-FRAUD-0102", "MODEL-FAIRNESS-001"] },
  { questionId: "ALERT_STATUS", question: "What unresolved alert needs attention?", expectedEvidence: ["ALERT-OPS-0201", "CASE-OPS-0101"] },
  { questionId: "CONFIG_CHANGE", question: "Can the pending configuration change execute?", expectedEvidence: ["GA-INT-CONFIG-0092", "sha256:evidence-ga-0092-v1"] },
  { questionId: "DEMO_LIMITATIONS", question: "What is simulated rather than live?", expectedEvidence: ["platform-release@demo", "no-live-partner"] },
];

const answerText: Record<CopilotQuestionId, string> = {
  PRICE_INTEGRITY: "The selected observation is fresh, licence-eligible and corroborated; the conflicting candidate remains excluded.",
  SPREAD_BREAKDOWN: "The governed 2.30% total is composed of 1.30% modelled protection cost, 0.70% FuelCap margin and 0.30% reserve/pool buffer.",
  BOUNDARY_EXPOSURE: "Texas boundary and correlation stress are the clearest simulated reserve sensitivities; no live hedge is executed.",
  LEDGER_BALANCE: "The cited journal projection balances and the reconciliation record has no unexplained residue.",
  CASE_PRIORITY: "The suspicious-transaction case warrants prompt human review, but statistical signals do not establish guilt.",
  ALERT_STATUS: "The settlement reconciliation alert is unresolved and requires governed human acknowledgement, ownership and recovery evidence.",
  CONFIG_CHANGE: "The change cannot execute until exact-version different-checker approval, step-up and bound evidence all pass.",
  DEMO_LIMITATIONS: "Provider adapters, incidents, alerts, hedges and money movement are synthetic, simulated or mock; no live partner action is claimed.",
};

export const modelRegistry = [{ modelId: "fc-copilot-demo-1", version: "1.0.0", status: "ACTIVE", tasks: ["EXPLAIN", "SUMMARISE", "COMPARE"], regions: ["GLOBAL"], classifications: ["INTERNAL", "CONFIDENTIAL"], latencyBudgetMs: 1200, costBudgetUsdMicros: 2500, fallbackModelId: "deterministic-search@1.0", driftBps: 120, overrideCount: 0, killSwitch: false }] as const;

const injectionPatterns = [/ignore (all|previous) instructions/i, /system prompt/i, /execute (a |the )?tool/i, /reveal (a |the )?secret/i, /cross[- ]tenant/i, /approve (it|this)/i];
export function answerInvestorQuestion(input: Readonly<{ questionId: CopilotQuestionId; organisationId: string; visibleEvidenceIds: readonly string[]; untrustedText?: string; confidenceBps?: number; killSwitch?: boolean }>): CopilotAnswer {
  const definition = approvedInvestorQuestions.find(({ questionId }) => questionId === input.questionId)!;
  if (input.organisationId !== "org-fuelcap-global") return { questionId: input.questionId, status: "BLOCKED", answer: "No authorised tenant-scoped evidence is available.", confidenceBps: 0, citations: [], facts: [], inference: null, recommendation: null, humanRoute: "Switch to an authorised organisation.", readOnly: true, policyVersion: "ai-policy@1.0.0" };
  if (input.killSwitch) return { questionId: input.questionId, status: "BLOCKED", answer: "Copilot capability is disabled; deterministic evidence search remains available.", confidenceBps: 0, citations: [], facts: [], inference: null, recommendation: null, humanRoute: "Use deterministic evidence search.", readOnly: true, policyVersion: "ai-policy@1.0.0" };
  if (input.untrustedText && injectionPatterns.some((pattern) => pattern.test(input.untrustedText!))) return { questionId: input.questionId, status: "BLOCKED", answer: "Untrusted instruction-like content was isolated and not followed.", confidenceBps: 0, citations: [], facts: [], inference: null, recommendation: null, humanRoute: "Review the source field safely.", readOnly: true, policyVersion: "ai-policy@1.0.0" };
  const citations = definition.expectedEvidence.filter((id) => input.visibleEvidenceIds.includes(id)); const confidenceBps = input.confidenceBps ?? (citations.length === definition.expectedEvidence.length ? 9400 : citations.length ? 7200 : 0);
  if (!citations.length || confidenceBps < 6000) return { questionId: input.questionId, status: "ABSTAIN", answer: "The available evidence is insufficient for a reliable answer.", confidenceBps, citations, facts: [], inference: null, recommendation: null, humanRoute: "Route to deterministic search or human review.", readOnly: true, policyVersion: "ai-policy@1.0.0" };
  const status = confidenceBps < 8500 ? "VERIFY" : "SUPPORTED"; return { questionId: input.questionId, status, answer: answerText[input.questionId], confidenceBps, citations, facts: citations.map((id) => `Visible evidence ${id}`), inference: status === "VERIFY" ? "Partial evidence supports the answer with uncertainty." : null, recommendation: null, humanRoute: status === "VERIFY" ? "Verify missing evidence before action." : null, readOnly: true, policyVersion: "ai-policy@1.0.0" };
}

export const goldenAiEvaluations = approvedInvestorQuestions.map((question) => ({ evaluationId: `EVAL-${question.questionId}`, questionId: question.questionId, minimumConfidenceBps: 8500, requiredCitations: question.expectedEvidence, expectedStatus: "SUPPORTED" as const }));
export function runGoldenAiEvaluations() { const results = goldenAiEvaluations.map((evaluation) => { const answer = answerInvestorQuestion({ questionId: evaluation.questionId, organisationId: "org-fuelcap-global", visibleEvidenceIds: evaluation.requiredCitations }); return { evaluationId: evaluation.evaluationId, passed: answer.status === evaluation.expectedStatus && answer.confidenceBps >= evaluation.minimumConfidenceBps && evaluation.requiredCitations.every((id) => answer.citations.includes(id)) }; }); return { passed: results.every(({ passed }) => passed), passedCount: results.filter(({ passed }) => passed).length, totalCount: results.length, results }; }
