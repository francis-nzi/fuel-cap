import { evaluateServiceTopology, renderServiceTopology } from "../packages/production-readiness/src/service-topology.ts";

const apiKey = process.env.RENDER_API_KEY;
if (!apiKey) throw new Error("RENDER_API_KEY is required for the read-only topology check.");

const headers = { authorization: `Bearer ${apiKey}`, accept: "application/json" };
async function request(path) {
  const response = await fetch(`https://api.render.com/v1${path}`, { headers, cache: "no-store" });
  if (!response.ok) throw new Error(`Render API GET ${path} returned ${response.status}.`);
  return response.json();
}

const observations = [];
for (const contract of renderServiceTopology) {
  const [service, deployEntries, envEntries] = await Promise.all([
    request(`/services/${contract.serviceId}`),
    request(`/services/${contract.serviceId}/deploys?limit=20`),
    request(`/services/${contract.serviceId}/env-vars`),
  ]);
  const deploys = deployEntries.map((entry) => entry.deploy ?? entry);
  const latest = deploys[0];
  const live = deploys.find(({ status }) => status === "live");
  const env = new Map(envEntries.map((entry) => [entry.envVar.key, entry.envVar.value]));
  observations.push({
    serviceId: service.id,
    serviceName: service.name,
    publicUrl: service.serviceDetails.url,
    rootDirectory: service.rootDir ?? "",
    buildCommand: service.serviceDetails.envSpecificDetails.buildCommand,
    startCommand: service.serviceDetails.envSpecificDetails.startCommand,
    nodeVersion: env.get("NODE_VERSION") ?? "UNVERIFIED",
    autoDeploy: service.autoDeploy === "yes",
    liveCommit: live?.commit?.id ?? null,
    latestDeployStatus: latest?.status ?? "missing",
  });
}

const assessment = evaluateServiceTopology(renderServiceTopology, observations);
console.log(JSON.stringify({ ...assessment, checkedAt: new Date().toISOString() }, null, 2));
if (assessment.blockers.some((blocker) => !blocker.startsWith("fuel-cap: product ownership"))) process.exitCode = 1;
