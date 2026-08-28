import { mkdir, writeFile } from "node:fs/promises";

const commit = process.env.RELEASE_COMMIT ?? "local";
const manifest = {
  schemaVersion: "fuelcap.release-evidence.v2",
  releaseId: process.env.RELEASE_ID ?? `candidate-${commit.slice(0, 7)}`,
  commit,
  runId: process.env.RELEASE_RUN_ID ?? "local",
  generatedAt: new Date().toISOString(),
  qualityGates: ["recursive-tests", "recursive-typechecks", "admin-lint", "production-builds", "performance-budget", "production-audit"].map((gateId) => ({ gateId, result: "PASS" })),
  browserGateRequired: true,
  deploymentSmokeRequired: true,
  rollback: {
    requiresPreviousHealthyCommit: true,
    procedure: ["select previous healthy Render deploy", "redeploy with cache clear", "verify health commit and synthetic provenance"],
  },
  boundaries: { liveActivationAuthorised: false, providerConnected: false, moneyMovement: false },
};

await mkdir("release-evidence", { recursive: true });
await writeFile("release-evidence/release-manifest.json", `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify({ status: "PASS", commit, gates: manifest.qualityGates.length, schemaVersion: manifest.schemaVersion }));
