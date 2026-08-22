import { describe, expect, it } from "vitest";
import { InjectedClock, createScenarioRuntime, scenarioManifests } from "./index";

describe("scenario runtime", () => {
  it("produces the same ScenarioReady evidence for repeated resets", () => {
    const runtime = createScenarioRuntime("demo", "flat-market-us");
    const first = runtime.reset("boundary-breach-us");
    const second = runtime.reset("boundary-breach-us");

    expect(second).toEqual(first);
    expect(first.scenarioTime).toBe(scenarioManifests["boundary-breach-us"].clock.startsAt);
  });

  it("prohibits reset in production", () => {
    const runtime = createScenarioRuntime("production", "flat-market-us");
    expect(() => runtime.reset("flat-market-us")).toThrow("prohibited in production");
  });

  it("advances only through the injected clock", () => {
    const clock = new InjectedClock("2026-08-21T09:30:00.000Z");
    clock.advance(60_000);
    expect(clock.now()).toBe("2026-08-21T09:31:00.000Z");
    expect(() => clock.advance(-1)).toThrow("non-negative");
  });
});
