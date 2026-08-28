import { describe, expect, it } from "vitest";
import { knownDemoLimitations, latestVerifiedRelease, presentationViewports, rehearsalPaths, rehearsalRounds, validateReleaseCandidate, validateReleaseRehearsal } from "./release-rehearsal";

describe("Phase 1 release rehearsal", () => {
  it("covers every required golden adverse and wow path", () => { expect(rehearsalPaths).toHaveLength(10); expect(new Set(rehearsalPaths.map(({class: pathClass})=>pathClass))).toEqual(new Set(["GOLDEN","ADVERSE","WOW"])); expect(rehearsalPaths.every(({evidenceIds})=>evidenceIds.length >= 2)).toBe(true); });
  it("records three intervention-free reset-gated rounds", () => { expect(rehearsalRounds).toHaveLength(3); expect(rehearsalRounds.every(({resetBefore,resetAfter,developerIntervention,result})=>resetBefore&&resetAfter&&!developerIntervention&&result==="PASS")).toBe(true); });
  it("covers presentation and mobile dimensions", () => { expect(presentationViewports.some(({width,height})=>width===1920&&height===1080)).toBe(true); expect(presentationViewports.some(({width})=>width===390)).toBe(true); });
  it("keeps honest limitations explicit", () => { expect(knownDemoLimitations.some((text)=>text.includes("No live"))).toBe(true); expect(knownDemoLimitations.some((text)=>text.includes("non-Chromium"))).toBe(true); });
  it("reports Gate B ready with the remaining manual boundary explicit", () => expect(validateReleaseRehearsal()).toMatchObject({ gate: "B", status: "READY", pathCount: 10, rehearsalCount: 3, manualOutstanding: ["non-Chromium visual review", "assistive-technology screen-reader sign-off"] }));
  it("reconciles quality, deployment, smoke and rollback evidence to one commit", () => expect(validateReleaseCandidate()).toMatchObject({ gate: "C", status: "DEPLOYED", releaseId: "RC-001", shortCommit: "1ca3cb7", passedGateCount: 6, browserJourneyCount: 8, rollbackReady: true }));
  it("fails closed when deployed provenance diverges", () => expect(() => validateReleaseCandidate({ ...latestVerifiedRelease, deployment: { ...latestVerifiedRelease.deployment, commit: latestVerifiedRelease.previousHealthyCommit } })).toThrow("deployment provenance"));
  it("fails closed without a previously healthy rollback target", () => expect(() => validateReleaseCandidate({ ...latestVerifiedRelease, rollback: { ...latestVerifiedRelease.rollback, targetWasHealthy: false } })).toThrow("Rollback evidence"));
});
