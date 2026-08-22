import {
  createScenarioRuntime,
  scenarioManifests,
  scenarioOrder,
  type DemoEnvironment,
  type ScenarioId,
  type ScenarioReady,
} from "./index";
import { collectMockObservations, type MockObservation } from "./ports";

export type DemoRole = "demonstrator-presenter";

export type ScenarioResetCommand = Readonly<{
  scenarioId: ScenarioId;
  environment: DemoEnvironment;
  role: string;
  requestedBy: string;
  idempotencyKey: string;
}>;

export type ScenarioResetResult = Readonly<{
  commandType: "ResetDemonstratorScenario";
  idempotencyKey: string;
  requestedBy: string;
  ownershipMarker: string;
  clearedScope: "scenario-owned-records-only";
  ready: ScenarioReady;
  observations: readonly MockObservation[];
}>;

export function isScenarioId(value: unknown): value is ScenarioId {
  return typeof value === "string" && (scenarioOrder as readonly string[]).includes(value);
}

export function resetDemonstratorScenario(command: ScenarioResetCommand): ScenarioResetResult {
  if (command.environment === "production") throw new Error("RESET_PROHIBITED_IN_PRODUCTION");
  if (command.role !== "demonstrator-presenter") throw new Error("RESET_REQUIRES_PRESENTER_SCOPE");
  if (!command.requestedBy.trim()) throw new Error("RESET_REQUIRES_NAMED_PRINCIPAL");
  if (!command.idempotencyKey.trim()) throw new Error("RESET_REQUIRES_IDEMPOTENCY_KEY");

  const manifest = scenarioManifests[command.scenarioId];
  const runtime = createScenarioRuntime(command.environment, command.scenarioId);
  return {
    commandType: "ResetDemonstratorScenario",
    idempotencyKey: command.idempotencyKey,
    requestedBy: command.requestedBy,
    ownershipMarker: `scenario:${manifest.scenarioId}:${manifest.scenarioVersion}`,
    clearedScope: "scenario-owned-records-only",
    ready: runtime.reset(command.scenarioId),
    observations: collectMockObservations(manifest),
  };
}
