import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { InjectedClock, canonicalScenarioJson, createScenarioRuntime, scenarioGoldenSha256, scenarioManifests, scenarioOrder } from "./index";

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

  it("matches the locked SHA-256 goldens for the complete library", () => {
    const hashes = Object.fromEntries(scenarioOrder.map((id) => [
      id,
      createHash("sha256").update(canonicalScenarioJson(id)).digest("hex"),
    ]));
    expect(Object.keys(hashes)).toHaveLength(12);
    expect(hashes).toEqual(scenarioGoldenSha256);
  });

  it("gives every scenario governed documentation assertions", () => {
    for (const manifest of Object.values(scenarioManifests)) {
      expect(manifest.documentationAssertions.length).toBeGreaterThan(0);
      expect(new Set(manifest.documentationAssertions.map(({ path }) => path)).size)
        .toBe(manifest.documentationAssertions.length);
    }
  });
});
