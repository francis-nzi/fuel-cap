const apiKey = process.env.RENDER_API_KEY;
const serviceId = process.env.RENDER_SERVICE_ID;
const expectedCommit = process.env.EXPECTED_COMMIT;
const healthUrl = process.env.HEALTH_URL;
const pollMs = Number(process.env.DEPLOY_POLL_MS ?? 10_000);
const automaticGraceMs = Number(process.env.AUTOMATIC_DEPLOY_GRACE_MS ?? 300_000);
const timeoutMs = Number(process.env.DEPLOY_TIMEOUT_MS ?? 1_200_000);
const stabilizationMs = Number(process.env.DEPLOY_STABILIZATION_MS ?? 20_000);

if (!apiKey || !serviceId || !healthUrl || !expectedCommit || !/^[a-f0-9]{40}$/.test(expectedCommit)) throw new Error("RENDER_API_KEY, RENDER_SERVICE_ID, HEALTH_URL and a full EXPECTED_COMMIT are required.");
if (![pollMs, automaticGraceMs, timeoutMs, stabilizationMs].every((value) => Number.isFinite(value) && value >= 0)) throw new Error("Deployment timing values must be non-negative numbers.");

const headers = { authorization: `Bearer ${apiKey}`, accept: "application/json", "content-type": "application/json" };
const activeStatuses = new Set(["queued", "build_in_progress", "update_in_progress"]);
const terminalFailures = new Set(["build_failed", "update_failed", "canceled"]);
const startedAt = Date.now();
let cacheClearDeployId = null;
let stableSince = null;

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const unwrap = (entry) => entry.deploy ?? entry;
async function request(path, options = {}) {
  const response = await fetch(`https://api.render.com/v1${path}`, { ...options, headers });
  if (!response.ok) throw new Error(`Render API ${options.method ?? "GET"} ${path} returned ${response.status}.`);
  return response.json();
}
async function deployments() { return (await request(`/services/${serviceId}/deploys?limit=20`)).map(unwrap); }
async function smoke() {
  const response = await fetch(healthUrl, { headers: { accept: "application/json" }, cache: "no-store" });
  if (!response.ok) throw new Error(`Health returned ${response.status}.`);
  const body = await response.json();
  if (body.status !== "ok" || body.commit !== expectedCommit.slice(0, 7) || body.provenance !== "synthetic-seeded") throw new Error(`Health provenance mismatch: ${JSON.stringify(body)}`);
  return body;
}

while (Date.now() - startedAt < timeoutMs) {
  const items = await deployments();
  const active = items.filter(({ status }) => activeStatuses.has(status));
  if (active.length) {
    stableSince = null;
    console.log(JSON.stringify({ state: "WAIT", reason: "deployment active", deployIds: active.map(({ id }) => id) }));
    await wait(pollMs);
    continue;
  }
  if (!cacheClearDeployId) {
    const automaticLive = items.find(({ commit, status }) => commit?.id === expectedCommit && status === "live");
    if (!automaticLive && Date.now() - startedAt < automaticGraceMs) {
      console.log(JSON.stringify({ state: "WAIT", reason: "automatic deployment discovery grace" }));
      await wait(pollMs);
      continue;
    }
    await request(`/services/${serviceId}/deploys`, { method: "POST", body: JSON.stringify({ clearCache: "clear" }) });
    await wait(Math.min(pollMs, 5_000));
    const refreshed = await deployments();
    const candidate = refreshed.find(({ commit, status }) => commit?.id === expectedCommit && (activeStatuses.has(status) || status === "live"));
    if (!candidate) throw new Error("Cache-clear deployment was not discoverable after creation.");
    cacheClearDeployId = candidate.id;
    console.log(JSON.stringify({ state: "CACHE_CLEAR_CREATED", deployId: cacheClearDeployId, commit: expectedCommit.slice(0, 7) }));
    continue;
  }
  const cacheClear = items.find(({ id }) => id === cacheClearDeployId);
  if (!cacheClear || cacheClear.commit?.id !== expectedCommit || terminalFailures.has(cacheClear.status)) throw new Error("Cache-clear deployment failed or lost exact-commit provenance.");
  if (cacheClear.status !== "live") throw new Error(`Unexpected terminal cache-clear deployment status: ${cacheClear.status}.`);
  stableSince ??= Date.now();
  if (Date.now() - stableSince < stabilizationMs) {
    console.log(JSON.stringify({ state: "STABILIZE", deployId: cacheClearDeployId }));
    await wait(pollMs);
    continue;
  }
  const body = await smoke();
  console.log(JSON.stringify({ state: "PASS", deployId: cacheClearDeployId, commit: body.commit, service: body.service }));
  process.exit(0);
}

throw new Error("Single-flight deployment timed out without stable exact-commit smoke evidence.");
