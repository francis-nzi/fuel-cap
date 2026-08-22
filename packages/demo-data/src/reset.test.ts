import { describe, expect, it } from "vitest";
import { resetDemonstratorScenario } from "./reset";

const validCommand = {
  scenarioId: "exposure-ai-recommendation" as const,
  environment: "demo" as const,
  role: "demonstrator-presenter",
  requestedBy: "presenter@fuelcap.example",
  idempotencyKey: "reset:exposure-ai-recommendation:1",
};

describe("governed scenario reset", () => {
  it("returns a deterministic production-shaped reset bundle", () => {
    const first = resetDemonstratorScenario(validCommand);
    const second = resetDemonstratorScenario(validCommand);
    expect(second).toEqual(first);
    expect(first.clearedScope).toBe("scenario-owned-records-only");
    expect(first.observations.some(({ kind }) => kind === "SimulatedHedgeExecution")).toBe(true);
    expect(first.observations.every(({ status }) => status === "simulated")).toBe(true);
  });

  it("prohibits all production resets", () => {
    expect(() => resetDemonstratorScenario({ ...validCommand, environment: "production" }))
      .toThrow("RESET_PROHIBITED_IN_PRODUCTION");
  });

  it("requires Presenter scope", () => {
    expect(() => resetDemonstratorScenario({ ...validCommand, role: "risk-treasury" }))
      .toThrow("RESET_REQUIRES_PRESENTER_SCOPE");
  });

  it("requires a named principal and idempotency key", () => {
    expect(() => resetDemonstratorScenario({ ...validCommand, requestedBy: "" }))
      .toThrow("RESET_REQUIRES_NAMED_PRINCIPAL");
    expect(() => resetDemonstratorScenario({ ...validCommand, idempotencyKey: "" }))
      .toThrow("RESET_REQUIRES_IDEMPOTENCY_KEY");
  });

  it("uses fixed FX observations only for the FX scenario", () => {
    const result = resetDemonstratorScenario({
      ...validCommand,
      scenarioId: "fx-movement-multi-market",
      idempotencyKey: "reset:fx:1",
    });
    expect(result.observations.filter(({ kind }) => kind === "FixedFXObservation")).toHaveLength(3);
    expect(result.observations.some(({ kind }) => kind === "SimulatedHedgeExecution")).toBe(false);
  });
});
