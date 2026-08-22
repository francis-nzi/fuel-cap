export const CONTRACT_VERSION = "1.0.0" as const;

export const provenanceValues = [
  "synthetic-seeded",
  "historically-derived",
  "illustrative-fixed",
] as const;

export type Provenance = (typeof provenanceValues)[number];
export type DemoEnvironment = "demo" | "staging" | "production";
export type ScenarioId =
  | "flat-market-us"
  | "boundary-breach-us"
  | "exposure-ai-recommendation";

export type ScenarioManifest = Readonly<{
  schemaVersion: "1.0.0";
  scenarioId: ScenarioId;
  scenarioVersion: "1.0.0";
  compatibleContractVersion: ">=1.0.0 <2.0.0";
  seed: string;
  clock: Readonly<{
    implementation: "InjectedClock";
    startsAt: string;
    timezone: string;
  }>;
  market: Readonly<{
    country: "US";
    region: string;
    legalEntity: "fuelcap-us-demo";
    currency: "USD";
    fuelUnit: "US_GALLON";
  }>;
  provenance: Provenance;
  expectedOutcomeClass: string;
}>;

export type ScenarioReady = Readonly<{
  eventType: "ScenarioReady";
  scenarioId: ScenarioId;
  scenarioVersion: string;
  contractVersion: typeof CONTRACT_VERSION;
  scenarioTime: string;
  evidenceId: string;
  provenance: Provenance;
}>;

export interface Clock {
  now(): string;
  reset(isoTimestamp: string): void;
  advance(milliseconds: number): void;
}

export class InjectedClock implements Clock {
  private instant: number;

  constructor(startsAt: string) {
    this.instant = parseTimestamp(startsAt);
  }

  now() {
    return new Date(this.instant).toISOString();
  }

  reset(isoTimestamp: string) {
    this.instant = parseTimestamp(isoTimestamp);
  }

  advance(milliseconds: number) {
    if (!Number.isFinite(milliseconds) || milliseconds < 0) {
      throw new Error("Clock may only advance by a non-negative finite duration.");
    }
    this.instant += milliseconds;
  }
}

function parseTimestamp(value: string) {
  const instant = Date.parse(value);
  if (!Number.isFinite(instant)) throw new Error(`Invalid scenario timestamp: ${value}`);
  return instant;
}

function stableEvidenceId(seed: string) {
  let hash = 2166136261;
  for (const character of seed) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `EVD-DEMO-${(hash >>> 0).toString(16).toUpperCase().padStart(8, "0")}`;
}

function assertManifest(manifest: ScenarioManifest) {
  if (manifest.schemaVersion !== "1.0.0") throw new Error("Unsupported scenario schema version.");
  if (manifest.compatibleContractVersion !== ">=1.0.0 <2.0.0") {
    throw new Error(`Scenario ${manifest.scenarioId} is incompatible with contracts ${CONTRACT_VERSION}.`);
  }
  if (!provenanceValues.includes(manifest.provenance)) throw new Error("Invalid provenance.");
  parseTimestamp(manifest.clock.startsAt);
  return manifest;
}

function manifest(
  scenarioId: ScenarioId,
  startsAt: string,
  region: string,
  expectedOutcomeClass: string,
): ScenarioManifest {
  return assertManifest({
    schemaVersion: "1.0.0",
    scenarioId,
    scenarioVersion: "1.0.0",
    compatibleContractVersion: ">=1.0.0 <2.0.0",
    seed: `fuelcap:${scenarioId}:1.0.0`,
    clock: { implementation: "InjectedClock", startsAt, timezone: "America/Chicago" },
    market: {
      country: "US",
      region,
      legalEntity: "fuelcap-us-demo",
      currency: "USD",
      fuelUnit: "US_GALLON",
    },
    provenance: "illustrative-fixed",
    expectedOutcomeClass,
  });
}

export const scenarioManifests: Readonly<Record<ScenarioId, ScenarioManifest>> = {
  "flat-market-us": manifest("flat-market-us", "2026-08-21T09:30:00.000Z", "US-NY", "PROTECTED_FLAT_MARKET"),
  "boundary-breach-us": manifest("boundary-breach-us", "2026-08-21T14:15:00.000Z", "US-TX", "SETTLED_AT_BOUNDARY"),
  "exposure-ai-recommendation": manifest(
    "exposure-ai-recommendation",
    "2026-08-21T16:45:00.000Z",
    "US-TX",
    "SIMULATED_HEDGE_RECOMMENDED",
  ),
};

export class ScenarioRuntime {
  private clock: InjectedClock;

  constructor(
    private readonly environment: DemoEnvironment,
    initialScenarioId: ScenarioId,
  ) {
    this.clock = new InjectedClock(scenarioManifests[initialScenarioId].clock.startsAt);
  }

  reset(scenarioId: ScenarioId): ScenarioReady {
    if (this.environment === "production") {
      throw new Error("Scenario reset is prohibited in production.");
    }
    const selected = assertManifest(scenarioManifests[scenarioId]);
    this.clock.reset(selected.clock.startsAt);
    return {
      eventType: "ScenarioReady",
      scenarioId: selected.scenarioId,
      scenarioVersion: selected.scenarioVersion,
      contractVersion: CONTRACT_VERSION,
      scenarioTime: this.clock.now(),
      evidenceId: stableEvidenceId(selected.seed),
      provenance: selected.provenance,
    };
  }
}

export function createScenarioRuntime(environment: DemoEnvironment, initialScenarioId: ScenarioId) {
  return new ScenarioRuntime(environment, initialScenarioId);
}
