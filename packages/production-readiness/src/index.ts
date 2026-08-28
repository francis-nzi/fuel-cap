export * from "./deployment-orchestration";
export * from "./service-topology";

export type ReadinessDomain = "SECURITY" | "PRIVACY" | "RESILIENCE" | "OPERATIONS";
export type EvidenceStatus = "PASS" | "FAIL" | "OPEN" | "EXPIRED";
export interface ReadinessControl { readonly controlId: string; readonly domain: ReadinessDomain; readonly title: string; readonly ownerRole: string; readonly externalAttestationRequired: boolean; readonly blocksPilot: boolean; readonly requiredEvidenceKinds: readonly string[]; }
export interface ReadinessEvidence { readonly evidenceId: string; readonly controlId: string; readonly kind: string; readonly status: EvidenceStatus; readonly source: "INTERNAL" | "INDEPENDENT"; readonly issuedAt: string; readonly expiresAt: string; readonly contentHash: string; readonly makerActorId: string; readonly checkerActorId: string; }
export interface RecoveryExercise { readonly exerciseId: string; readonly capability: string; readonly status: "PASS" | "FAIL"; readonly exercisedAt: string; readonly recoveryTimeSeconds: number; readonly recoveryPointSeconds: number; readonly rtoSeconds: number; readonly rpoSeconds: number; readonly projectionRebuildVerified: boolean; readonly evidenceIds: readonly string[]; }
export interface Runbook { readonly runbookId: string; readonly capability: string; readonly owner: string; readonly version: string; readonly approved: boolean; readonly lastRehearsedAt: string; readonly escalationRoute: readonly string[]; readonly rollbackSteps: readonly string[]; readonly verificationSteps: readonly string[]; }
export interface SupportReadiness { readonly rotaId: string; readonly coverage: "BUSINESS_HOURS" | "24X7"; readonly primaryOwner: string; readonly secondaryOwner: string; readonly incidentCommander: string; readonly customerCommunicationOwner: string; readonly severityResponseMinutes: Readonly<Record<"SEV1" | "SEV2" | "SEV3", number>>; readonly handoffRehearsed: boolean; readonly evidenceId: string; }
export interface ReadinessAssessment { readonly decision: "READY_FOR_PILOT" | "BLOCKED"; readonly assessedAt: string; readonly scoreBps: number; readonly domainResults: readonly Readonly<{ domain: ReadinessDomain; passed: number; total: number; status: "PASS" | "BLOCKED" }>[]; readonly blockers: readonly string[]; readonly evidenceIds: readonly string[]; readonly externallyCertified: boolean; readonly pilotMayStart: boolean; }

export const productionReadinessControls: readonly ReadinessControl[] = [
  { controlId: "SEC-PENTEST", domain: "SECURITY", title: "Independent penetration test", ownerRole: "Platform Security", externalAttestationRequired: true, blocksPilot: true, requiredEvidenceKinds: ["scope", "report", "remediation-verification"] },
  { controlId: "SEC-SECRETS", domain: "SECURITY", title: "Secrets and credential isolation", ownerRole: "Platform Operations", externalAttestationRequired: false, blocksPilot: true, requiredEvidenceKinds: ["rotation-test"] },
  { controlId: "PRI-DPIA", domain: "PRIVACY", title: "Jurisdictional privacy impact assessment", ownerRole: "Compliance", externalAttestationRequired: true, blocksPilot: true, requiredEvidenceKinds: ["approved-dpia"] },
  { controlId: "PRI-RETENTION", domain: "PRIVACY", title: "Retention and rights workflow exercise", ownerRole: "Compliance", externalAttestationRequired: false, blocksPilot: true, requiredEvidenceKinds: ["rights-exercise", "deletion-verification"] },
  { controlId: "RES-DR", domain: "RESILIENCE", title: "Independent disaster-recovery assurance", ownerRole: "Platform Operations", externalAttestationRequired: true, blocksPilot: true, requiredEvidenceKinds: ["restore-report"] },
  { controlId: "RES-RESTORE", domain: "RESILIENCE", title: "Ledger-safe restoration exercise", ownerRole: "Finance Operations", externalAttestationRequired: false, blocksPilot: true, requiredEvidenceKinds: ["exercise-result"] },
  { controlId: "OPS-RUNBOOKS", domain: "OPERATIONS", title: "Critical capability runbook coverage", ownerRole: "Operations", externalAttestationRequired: false, blocksPilot: true, requiredEvidenceKinds: ["runbook-catalogue"] },
  { controlId: "OPS-SUPPORT", domain: "OPERATIONS", title: "Support rota and escalation rehearsal", ownerRole: "Operations", externalAttestationRequired: false, blocksPilot: true, requiredEvidenceKinds: ["handoff-rehearsal"] },
] as const;

const currentEvidence = (control: ReadinessControl, evidence: readonly ReadinessEvidence[], assessedAt: number) => evidence.filter((item) => item.controlId === control.controlId && item.status === "PASS" && item.makerActorId !== item.checkerActorId && item.contentHash.startsWith("sha256:") && Number.isFinite(Date.parse(item.expiresAt)) && Date.parse(item.expiresAt) > assessedAt && (!control.externalAttestationRequired || item.source === "INDEPENDENT"));
export function evaluateProductionReadiness(input: Readonly<{ controls: readonly ReadinessControl[]; evidence: readonly ReadinessEvidence[]; exercises: readonly RecoveryExercise[]; runbooks: readonly Runbook[]; support: SupportReadiness; assessedAt: string }>): ReadinessAssessment {
  const assessedAt = Date.parse(input.assessedAt); if (!Number.isFinite(assessedAt)) throw new Error("A valid readiness assessment timestamp is required.");
  const blockers: string[] = []; const passedControls: string[] = [];
  for (const control of input.controls) {
    const items = currentEvidence(control, input.evidence, assessedAt); const kinds = new Set(items.map(({ kind }) => kind));
    if (!control.requiredEvidenceKinds.every((kind) => kinds.has(kind))) { if (control.blocksPilot) blockers.push(`${control.controlId}: required current evidence is incomplete`); continue; }
    passedControls.push(control.controlId);
  }
  for (const exercise of input.exercises) if (exercise.status !== "PASS" || exercise.recoveryTimeSeconds > exercise.rtoSeconds || exercise.recoveryPointSeconds > exercise.rpoSeconds || !exercise.projectionRebuildVerified || !exercise.evidenceIds.length) blockers.push(`${exercise.exerciseId}: recovery objective or verification failed`);
  for (const runbook of input.runbooks) if (!runbook.approved || !runbook.owner.trim() || !runbook.escalationRoute.length || !runbook.rollbackSteps.length || !runbook.verificationSteps.length) blockers.push(`${runbook.runbookId}: operational runbook incomplete`);
  if (!input.support.handoffRehearsed || !input.support.primaryOwner.trim() || input.support.primaryOwner === input.support.secondaryOwner || !input.support.evidenceId.trim()) blockers.push(`${input.support.rotaId}: support handoff or segregation incomplete`);
  const domainResults = (["SECURITY", "PRIVACY", "RESILIENCE", "OPERATIONS"] as const).map((domain) => { const controls = input.controls.filter((item) => item.domain === domain); const passed = controls.filter((item) => passedControls.includes(item.controlId)).length; return { domain, passed, total: controls.length, status: passed === controls.length ? "PASS" as const : "BLOCKED" as const }; });
  const scoreBps = input.controls.length ? Math.round(passedControls.length / input.controls.length * 10_000) : 0;
  const externallyCertified = input.controls.filter(({ externalAttestationRequired }) => externalAttestationRequired).every((control) => passedControls.includes(control.controlId));
  return { decision: blockers.length ? "BLOCKED" : "READY_FOR_PILOT", assessedAt: input.assessedAt, scoreBps, domainResults, blockers, evidenceIds: input.evidence.filter(({ controlId }) => passedControls.includes(controlId)).map(({ evidenceId }) => evidenceId), externallyCertified, pilotMayStart: blockers.length === 0 && externallyCertified };
}

const evidence = (controlId: string, kind: string, source: ReadinessEvidence["source"] = "INTERNAL"): ReadinessEvidence => ({ evidenceId: `EVD-${controlId}-${kind}`, controlId, kind, status: "PASS", source, issuedAt: "2026-08-27T12:00:00Z", expiresAt: "2027-08-27T12:00:00Z", contentHash: `sha256:${controlId}-${kind}`, makerActorId: "readiness-maker", checkerActorId: "readiness-checker" });
export const readinessEvidence: readonly ReadinessEvidence[] = [evidence("SEC-SECRETS", "rotation-test"), evidence("PRI-RETENTION", "rights-exercise"), evidence("PRI-RETENTION", "deletion-verification"), evidence("RES-RESTORE", "exercise-result"), evidence("OPS-RUNBOOKS", "runbook-catalogue"), evidence("OPS-SUPPORT", "handoff-rehearsal")];
export const recoveryExercises: readonly RecoveryExercise[] = [{ exerciseId: "EX-RESTORE-001", capability: "Ledger and safeguarding projections", status: "PASS", exercisedAt: "2026-08-27T13:00:00Z", recoveryTimeSeconds: 1200, recoveryPointSeconds: 60, rtoSeconds: 1800, rpoSeconds: 300, projectionRebuildVerified: true, evidenceIds: ["EVD-RESTORE-001"] }];
export const operationalRunbooks: readonly Runbook[] = ["PRICING", "LEDGER", "PAYMENTS", "IDENTITY", "COMMUNICATIONS"].map((capability) => ({ runbookId: `RB-${capability}`, capability, owner: `${capability} Operations`, version: "1.0.0", approved: true, lastRehearsedAt: "2026-08-27T14:00:00Z", escalationRoute: ["On-call", "Incident Commander"], rollbackSteps: ["Stop new activity", "Restore last verified configuration"], verificationSteps: ["Verify health", "Reconcile evidence"] }));
export const supportReadiness: SupportReadiness = { rotaId: "ROTA-PILOT-001", coverage: "BUSINESS_HOURS", primaryOwner: "operations-primary", secondaryOwner: "operations-secondary", incidentCommander: "incident-commander", customerCommunicationOwner: "customer-operations", severityResponseMinutes: { SEV1: 15, SEV2: 60, SEV3: 240 }, handoffRehearsed: true, evidenceId: "EVD-HANDOFF-001" };
export const productionReadinessAssessment = evaluateProductionReadiness({ controls: productionReadinessControls, evidence: readinessEvidence, exercises: recoveryExercises, runbooks: operationalRunbooks, support: supportReadiness, assessedAt: "2026-08-27T15:00:00Z" });

export type AssuranceEngagementState = "DRAFT" | "SCOPED" | "COMMISSIONED" | "EVIDENCE_SUBMITTED" | "ACCEPTED" | "REJECTED";
export interface AssuranceEngagement { readonly engagementId: string; readonly controlId: string; readonly assessorOrganisation: string; readonly state: AssuranceEngagementState; readonly scopedBy: string; readonly approvedBy: string | null; readonly commissionedAt: string | null; readonly dueAt: string; readonly requiredDeliverables: readonly string[]; readonly submittedEvidenceIds: readonly string[]; readonly acceptedEvidenceIds: readonly string[]; readonly rejectionReason: string | null; }
export interface AssurancePortfolio { readonly status: "ON_TRACK" | "AT_RISK" | "OVERDUE"; readonly commissioned: number; readonly accepted: number; readonly total: number; readonly outstandingDeliverables: number; readonly blockers: readonly string[]; }

export function evaluateAssurancePortfolio(engagements: readonly AssuranceEngagement[], controls: readonly ReadinessControl[], assessedAt: string): AssurancePortfolio {
  const now = Date.parse(assessedAt); if (!Number.isFinite(now)) throw new Error("A valid assurance portfolio timestamp is required.");
  const blockers: string[] = []; let outstandingDeliverables = 0;
  for (const engagement of engagements) {
    const control = controls.find(({ controlId }) => controlId === engagement.controlId);
    if (!control?.externalAttestationRequired) { blockers.push(`${engagement.engagementId}: control is not an independent assurance gate`); continue; }
    if (!engagement.assessorOrganisation.trim()) blockers.push(`${engagement.engagementId}: independent assessor is missing`);
    if (engagement.approvedBy && engagement.approvedBy === engagement.scopedBy) blockers.push(`${engagement.engagementId}: scope self-approval is prohibited`);
    const submitted = new Set(engagement.submittedEvidenceIds); outstandingDeliverables += engagement.requiredDeliverables.filter((item) => !submitted.has(item)).length;
    if (engagement.state !== "ACCEPTED") blockers.push(`${engagement.engagementId}: ${engagement.state.toLowerCase().replaceAll("_", " ")}`);
  }
  const overdue = engagements.some((item) => item.state !== "ACCEPTED" && Date.parse(item.dueAt) < now);
  const accepted = engagements.filter(({ state }) => state === "ACCEPTED").length;
  return { status: overdue ? "OVERDUE" : blockers.length ? "AT_RISK" : "ON_TRACK", commissioned: engagements.filter(({ commissionedAt }) => commissionedAt !== null).length, accepted, total: engagements.length, outstandingDeliverables, blockers };
}

export function acceptAssuranceEvidence(engagement: AssuranceEngagement, evidence: readonly ReadinessEvidence[], reviewerActorId: string): AssuranceEngagement {
  if (engagement.state !== "EVIDENCE_SUBMITTED") throw new Error("Only submitted assurance evidence can be accepted.");
  if (!reviewerActorId.trim() || reviewerActorId === engagement.scopedBy || reviewerActorId === engagement.approvedBy) throw new Error("An independent acceptance reviewer is required.");
  const matching = evidence.filter((item) => item.controlId === engagement.controlId && item.source === "INDEPENDENT" && item.status === "PASS");
  const evidenceKinds = new Set(matching.map(({ kind }) => kind));
  if (!engagement.requiredDeliverables.every((kind) => evidenceKinds.has(kind))) throw new Error("All scoped independent deliverables must pass before acceptance.");
  return { ...engagement, state: "ACCEPTED", acceptedEvidenceIds: matching.map(({ evidenceId }) => evidenceId), rejectionReason: null };
}

export const assuranceEngagements: readonly AssuranceEngagement[] = [
  { engagementId: "ASR-PENTEST-001", controlId: "SEC-PENTEST", assessorOrganisation: "Independent security assessor (unappointed)", state: "SCOPED", scopedBy: "security-lead", approvedBy: "compliance-lead", commissionedAt: null, dueAt: "2026-10-15T17:00:00Z", requiredDeliverables: ["scope", "report", "remediation-verification"], submittedEvidenceIds: [], acceptedEvidenceIds: [], rejectionReason: null },
  { engagementId: "ASR-DPIA-001", controlId: "PRI-DPIA", assessorOrganisation: "Independent privacy assessor (unappointed)", state: "SCOPED", scopedBy: "privacy-lead", approvedBy: "platform-lead", commissionedAt: null, dueAt: "2026-10-22T17:00:00Z", requiredDeliverables: ["approved-dpia"], submittedEvidenceIds: [], acceptedEvidenceIds: [], rejectionReason: null },
  { engagementId: "ASR-DR-001", controlId: "RES-DR", assessorOrganisation: "Independent resilience assessor (unappointed)", state: "SCOPED", scopedBy: "operations-lead", approvedBy: "finance-operations-lead", commissionedAt: null, dueAt: "2026-10-29T17:00:00Z", requiredDeliverables: ["restore-report"], submittedEvidenceIds: [], acceptedEvidenceIds: [], rejectionReason: null },
] as const;
export const assurancePortfolio = evaluateAssurancePortfolio(assuranceEngagements, productionReadinessControls, "2026-08-27T15:00:00Z");

export interface AssuranceCommissioningPack { readonly packId: string; readonly engagementId: string; readonly controlId: string; readonly version: string; readonly objectives: readonly string[]; readonly inScope: readonly string[]; readonly outOfScope: readonly string[]; readonly rulesOfEngagement: readonly string[]; readonly evidenceHandling: readonly string[]; readonly requiredDeliverables: readonly string[]; readonly acceptanceCriteria: readonly string[]; readonly owner: string; readonly approver: string; readonly contentHash: string; }
export interface AssessorAppointment { readonly engagementId: string; readonly assessorOrganisation: string; readonly leadAssessor: string; readonly independenceDeclared: boolean; readonly conflictsDisclosed: readonly string[]; readonly confidentialityAccepted: boolean; readonly dataHandlingAccepted: boolean; readonly appointedBy: string; readonly approvedBy: string; readonly appointedAt: string; }

const packDetails: Readonly<Record<string, Pick<AssuranceCommissioningPack, "objectives" | "inScope" | "outOfScope">>> = {
  "SEC-PENTEST": { objectives: ["Independently test tenant isolation, authentication, authorization and exposed application boundaries", "Verify material findings are remediated and retested"], inScope: ["FuelCap admin and customer HTTP surfaces", "Authentication and role boundaries", "Tenant isolation and evidence access", "Documented API endpoints"], outOfScope: ["Denial-of-service testing", "Social engineering", "Third-party infrastructure not owned by FuelCap"] },
  "PRI-DPIA": { objectives: ["Assess jurisdictional privacy risks and mitigations", "Verify consent, retention, rights and minimisation controls"], inScope: ["Identity and customer profile processing", "Consent and communications evidence", "Retention, correction and deletion workflows", "AI evidence boundaries"], outOfScope: ["Legal opinion outside the selected jurisdictions", "Uncontracted live-provider processing"] },
  "RES-DR": { objectives: ["Independently observe recovery against declared RTO and RPO", "Verify ledger-safe restoration and deterministic projection rebuild"], inScope: ["Application and database recovery procedure", "Ledger and safeguarding reconciliation", "Projection rebuild", "Incident command and customer communications handoff"], outOfScope: ["Destructive testing against production", "Unapproved third-party failover"] },
};

export function createAssuranceCommissioningPack(engagement: AssuranceEngagement): AssuranceCommissioningPack {
  const details = packDetails[engagement.controlId]; if (!details) throw new Error("No approved commissioning pack exists for this control.");
  return { packId: `PACK-${engagement.engagementId}`, engagementId: engagement.engagementId, controlId: engagement.controlId, version: "1.0.0", ...details, rulesOfEngagement: ["Use synthetic or explicitly authorised data only", "Stop and notify on suspected live customer exposure", "Do not alter ledger authority or initiate money movement", "Record timestamps, methods, affected scope and reproducible evidence"], evidenceHandling: ["Encrypt evidence in transit and at rest", "Store secrets and personal data only as redacted references", "Return content-addressed deliverables through the governed evidence intake", "Delete working copies after accepted retention handoff"], requiredDeliverables: engagement.requiredDeliverables, acceptanceCriteria: engagement.requiredDeliverables.map((kind) => `${kind}: independently issued, passing, content-addressed and current`), owner: engagement.scopedBy, approver: engagement.approvedBy ?? "UNAPPROVED", contentHash: `sha256:${engagement.engagementId}-pack-v1` };
}

export function validateAssessorAppointment(appointment: AssessorAppointment, engagement: AssuranceEngagement): Readonly<{ valid: boolean; blockers: readonly string[] }> {
  const blockers: string[] = [];
  if (appointment.engagementId !== engagement.engagementId) blockers.push("Appointment does not match the engagement.");
  if (!appointment.assessorOrganisation.trim() || !appointment.leadAssessor.trim()) blockers.push("Assessor organisation and lead are required.");
  if (!appointment.independenceDeclared || appointment.conflictsDisclosed.length) blockers.push("Assessor independence is not established.");
  if (!appointment.confidentialityAccepted || !appointment.dataHandlingAccepted) blockers.push("Evidence handling terms are not accepted.");
  if (!appointment.appointedBy.trim() || appointment.appointedBy === appointment.approvedBy) blockers.push("Segregated appointment approval is required.");
  if (!Number.isFinite(Date.parse(appointment.appointedAt))) blockers.push("A valid appointment timestamp is required.");
  return { valid: blockers.length === 0, blockers };
}

export const assuranceCommissioningPacks: readonly AssuranceCommissioningPack[] = assuranceEngagements.map(createAssuranceCommissioningPack);

export type EvidenceRoomState = "PREPARED" | "ISSUED" | "SUBMISSION_OPEN" | "UNDER_REVIEW" | "ACCEPTED" | "REJECTED";
export type FindingSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export interface AssuranceFinding { readonly findingId: string; readonly severity: FindingSeverity; readonly title: string; readonly status: "OPEN" | "REMEDIATED" | "ACCEPTED_RISK"; readonly remediationEvidenceId: string | null; readonly acceptedRiskBy: string | null; }
export interface AssuranceSubmission { readonly submissionId: string; readonly engagementId: string; readonly assessorOrganisation: string; readonly submittedAt: string; readonly evidence: readonly ReadinessEvidence[]; readonly findings: readonly AssuranceFinding[]; readonly supersedesSubmissionId: string | null; readonly contentHash: string; }
export interface AssuranceEvidenceRoom { readonly roomId: string; readonly engagementId: string; readonly packId: string; readonly state: EvidenceRoomState; readonly issuedAt: string | null; readonly issuedBy: string | null; readonly assessorOrganisation: string | null; readonly submissionIds: readonly string[]; readonly acceptedSubmissionId: string | null; readonly chainOfCustody: readonly Readonly<{ eventId: string; action: string; actorId: string; occurredAt: string; contentHash: string }>[]; }

export function issueAssuranceEvidenceRoom(room: AssuranceEvidenceRoom, pack: AssuranceCommissioningPack, engagement: AssuranceEngagement, appointment: AssessorAppointment, actorId: string, issuedAt: string): AssuranceEvidenceRoom {
  if (room.state !== "PREPARED" || room.engagementId !== engagement.engagementId || room.packId !== pack.packId) throw new Error("Evidence room is not prepared for this engagement and pack.");
  const appointmentResult = validateAssessorAppointment(appointment, engagement); if (!appointmentResult.valid) throw new Error(`Assessor appointment is invalid: ${appointmentResult.blockers.join(" ")}`);
  if (!actorId.trim() || actorId !== appointment.appointedBy || !Number.isFinite(Date.parse(issuedAt))) throw new Error("Authorised issuer and valid issuance time are required.");
  return { ...room, state: "ISSUED", issuedAt, issuedBy: actorId, assessorOrganisation: appointment.assessorOrganisation, chainOfCustody: [...room.chainOfCustody, { eventId: `CUST-${room.roomId}-ISSUED`, action: "PACK_ISSUED", actorId, occurredAt: issuedAt, contentHash: pack.contentHash }] };
}

export function submitAssuranceEvidence(room: AssuranceEvidenceRoom, submission: AssuranceSubmission): AssuranceEvidenceRoom {
  if (room.state !== "ISSUED" && room.state !== "SUBMISSION_OPEN" && room.state !== "UNDER_REVIEW") throw new Error("Evidence room is not accepting submissions.");
  if (submission.engagementId !== room.engagementId || submission.assessorOrganisation !== room.assessorOrganisation) throw new Error("Submission scope or assessor does not match the evidence room.");
  if (!submission.contentHash.startsWith("sha256:") || !Number.isFinite(Date.parse(submission.submittedAt)) || !submission.evidence.length) throw new Error("Submission integrity, timestamp and evidence are required.");
  if (submission.evidence.some((item) => item.source !== "INDEPENDENT" || item.controlId !== assuranceEngagements.find(({ engagementId }) => engagementId === room.engagementId)?.controlId)) throw new Error("Only matching independent evidence may enter the room.");
  if (room.submissionIds.includes(submission.submissionId)) return room;
  if (room.submissionIds.length && submission.supersedesSubmissionId !== room.submissionIds.at(-1)) throw new Error("A new submission must explicitly supersede the latest immutable submission.");
  return { ...room, state: "UNDER_REVIEW", submissionIds: [...room.submissionIds, submission.submissionId], chainOfCustody: [...room.chainOfCustody, { eventId: `CUST-${submission.submissionId}`, action: "EVIDENCE_SUBMITTED", actorId: submission.assessorOrganisation, occurredAt: submission.submittedAt, contentHash: submission.contentHash }] };
}

export function acceptEvidenceRoomSubmission(room: AssuranceEvidenceRoom, submission: AssuranceSubmission, engagement: AssuranceEngagement, reviewerActorId: string): AssuranceEvidenceRoom {
  if (room.state !== "UNDER_REVIEW" || room.submissionIds.at(-1) !== submission.submissionId) throw new Error("Only the latest reviewed submission can be accepted.");
  const blockingFindings = submission.findings.filter((finding) => (finding.severity === "HIGH" || finding.severity === "CRITICAL") && finding.status !== "REMEDIATED");
  if (blockingFindings.length || submission.findings.some((finding) => finding.status === "REMEDIATED" && !finding.remediationEvidenceId)) throw new Error("Blocking findings or missing remediation evidence prevent acceptance.");
  acceptAssuranceEvidence({ ...engagement, state: "EVIDENCE_SUBMITTED", submittedEvidenceIds: submission.evidence.map(({ kind }) => kind) }, submission.evidence, reviewerActorId);
  const acceptedAt = submission.submittedAt;
  return { ...room, state: "ACCEPTED", acceptedSubmissionId: submission.submissionId, chainOfCustody: [...room.chainOfCustody, { eventId: `CUST-${submission.submissionId}-ACCEPTED`, action: "SUBMISSION_ACCEPTED", actorId: reviewerActorId, occurredAt: acceptedAt, contentHash: submission.contentHash }] };
}

export const assuranceEvidenceRooms: readonly AssuranceEvidenceRoom[] = assuranceCommissioningPacks.map((pack) => ({ roomId: `ROOM-${pack.engagementId}`, engagementId: pack.engagementId, packId: pack.packId, state: "PREPARED", issuedAt: null, issuedBy: null, assessorOrganisation: null, submissionIds: [], acceptedSubmissionId: null, chainOfCustody: [] }));
