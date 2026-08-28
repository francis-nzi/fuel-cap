export type RenderDeployStatus = "queued" | "build_in_progress" | "update_in_progress" | "live" | "build_failed" | "update_failed" | "deactivated" | "canceled";
export type DeploymentSnapshot = { readonly deployId: string; readonly commit: string; readonly status: RenderDeployStatus; readonly createdAt: string; readonly updatedAt: string };
export type DeploymentDecision =
  | { readonly action: "WAIT"; readonly reason: string; readonly activeDeployIds: readonly string[] }
  | { readonly action: "TRIGGER_CACHE_CLEAR"; readonly reason: string; readonly activeDeployIds: readonly [] }
  | { readonly action: "SMOKE"; readonly reason: string; readonly deployId: string; readonly activeDeployIds: readonly [] }
  | { readonly action: "REVIEW_FAILURE"; readonly reason: string; readonly deployId: string; readonly activeDeployIds: readonly [] };

const activeStatuses = new Set<RenderDeployStatus>(["queued", "build_in_progress", "update_in_progress"]);
const terminalFailureStatuses = new Set<RenderDeployStatus>(["build_failed", "update_failed", "canceled"]);

export function decideSingleFlightDeployment(input: Readonly<{ expectedCommit: string; deployments: readonly DeploymentSnapshot[]; cacheClearDeployId: string | null; automaticDeployGraceExpired: boolean }>): DeploymentDecision {
  if (!/^[a-f0-9]{40}$/.test(input.expectedCommit)) throw new Error("Expected commit must be a full SHA-1 identifier.");
  if (new Set(input.deployments.map(({ deployId }) => deployId)).size !== input.deployments.length) throw new Error("Deployment identifiers must be unique.");
  if (input.deployments.some(({ commit, createdAt, updatedAt }) => !/^[a-f0-9]{40}$/.test(commit) || !Number.isFinite(Date.parse(createdAt)) || !Number.isFinite(Date.parse(updatedAt)))) throw new Error("Deployment provenance is invalid.");
  const active = input.deployments.filter(({ status }) => activeStatuses.has(status));
  if (active.length) return { action: "WAIT", reason: active.some(({ commit }) => commit !== input.expectedCommit) ? "another release is active" : "expected release is still active", activeDeployIds: active.map(({ deployId }) => deployId) };
  if (input.cacheClearDeployId) {
    const cacheClear = input.deployments.find(({ deployId }) => deployId === input.cacheClearDeployId);
    if (!cacheClear) return { action: "REVIEW_FAILURE", reason: "cache-clear deployment disappeared", deployId: input.cacheClearDeployId, activeDeployIds: [] };
    if (cacheClear.commit !== input.expectedCommit || terminalFailureStatuses.has(cacheClear.status)) return { action: "REVIEW_FAILURE", reason: "cache-clear deployment failed provenance", deployId: cacheClear.deployId, activeDeployIds: [] };
    if (cacheClear.status === "live") return { action: "SMOKE", reason: "cache-clear deployment is the stable live release", deployId: cacheClear.deployId, activeDeployIds: [] };
    return { action: "REVIEW_FAILURE", reason: `unexpected cache-clear status ${cacheClear.status}`, deployId: cacheClear.deployId, activeDeployIds: [] };
  }
  const automatic = input.deployments.find(({ commit, status }) => commit === input.expectedCommit && status === "live");
  if (automatic || input.automaticDeployGraceExpired) return { action: "TRIGGER_CACHE_CLEAR", reason: automatic ? "automatic deployment settled" : "automatic deployment grace expired", activeDeployIds: [] };
  return { action: "WAIT", reason: "waiting for automatic deployment discovery", activeDeployIds: [] };
}

export const singleFlightDeploymentRunbook = {
  runbookId: "RB-RELEASE-SINGLE-FLIGHT",
  invariant: "At most one Render deployment may be active before cache-clear deployment or smoke verification.",
  pollIntervalSeconds: 10,
  automaticDiscoveryGraceSeconds: 300,
  stabilizationSeconds: 20,
  failureAction: "Stop, preserve the last healthy release, and require operator review before rollback.",
  liveActivationAuthorised: false,
} as const;
