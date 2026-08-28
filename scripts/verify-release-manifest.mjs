import { readFile } from "node:fs/promises";

const path = process.env.RELEASE_MANIFEST ?? "release-evidence/release-manifest.json";
const manifest = JSON.parse(await readFile(path, "utf8"));
const requiredGates = new Set(["recursive-tests", "recursive-typechecks", "admin-lint", "production-builds", "performance-budget", "production-audit"]);

if (manifest.schemaVersion !== "fuelcap.release-evidence.v2") throw new Error("Unsupported release evidence schema.");
if (manifest.commit !== "local" && !/^[a-f0-9]{40}$/.test(manifest.commit)) throw new Error("Release commit must be a full SHA-1 identifier.");
if (!Array.isArray(manifest.qualityGates) || manifest.qualityGates.some(({ result }) => result !== "PASS")) throw new Error("Every quality gate must pass.");
for (const gateId of requiredGates) if (!manifest.qualityGates.some((gate) => gate.gateId === gateId)) throw new Error(`Missing required quality gate: ${gateId}.`);
if (!manifest.browserGateRequired || !manifest.deploymentSmokeRequired) throw new Error("Browser and production-smoke evidence must remain required.");
if (!manifest.rollback?.requiresPreviousHealthyCommit || manifest.rollback.procedure?.length < 3) throw new Error("Rollback procedure is incomplete.");
if (manifest.boundaries?.liveActivationAuthorised !== false || manifest.boundaries?.providerConnected !== false || manifest.boundaries?.moneyMovement !== false) throw new Error("Release manifest cannot authorise live activation.");

console.log(JSON.stringify({ status: "PASS", commit: manifest.commit, gates: manifest.qualityGates.length, rollbackReady: true }));
