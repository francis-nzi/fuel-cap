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
  | "rise-within-boundary-us"
  | "boundary-breach-us"
  | "falling-price-us"
  | "multi-lock-partial-fill-us"
  | "rollover-rise-fall-us"
  | "no-valid-quote-uk"
  | "eligibility-fraud-canada"
  | "insufficient-funding-us"
  | "fleet-multi-vehicle-us"
  | "fx-movement-multi-market"
  | "exposure-ai-recommendation";

export type DocumentationAssertion = Readonly<{
  authority: string;
  path: string;
  equals: string | number | boolean;
  unit?: "USD_MINOR" | "GBP_MINOR" | "US_GALLON_4DP" | "LITRE_4DP" | "PERCENT_4DP";
}>;

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
    country: "US" | "UK" | "CA" | "MULTI";
    region: string;
    legalEntity: "fuelcap-us-demo" | "fuelcap-uk-demo" | "fuelcap-ca-demo" | "fuelcap-global-demo";
    currency: "USD" | "GBP" | "CAD";
    fuelUnit: "US_GALLON" | "LITRE";
  }>;
  provenance: Provenance;
  expectedOutcomeClass: string;
  documentationAssertions: readonly DocumentationAssertion[];
  fixedFxRates?: Readonly<Record<string, string>>;
}>;

export type ScenarioReady = Readonly<{
  eventType: "ScenarioReady";
  scenarioId: ScenarioId;
  scenarioVersion: string;
  contractVersion: typeof CONTRACT_VERSION;
  scenarioTime: string;
  evidenceId: string;
  provenance: Provenance;
  assertionCount: number;
  goldenSha256: string;
}>;

export type GeneratedScenarioRecord = Readonly<{
  scenarioId: ScenarioId;
  scenarioVersion: string;
  contractVersion: typeof CONTRACT_VERSION;
  scenarioTime: string;
  expectedOutcomeClass: string;
  provenance: Provenance;
  market: ScenarioManifest["market"];
  documentationAssertions: readonly DocumentationAssertion[];
  fixedFxRates: Readonly<Record<string, string>>;
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
  expectedOutcomeClass: string,
  market: ScenarioManifest["market"],
  documentationAssertions: readonly DocumentationAssertion[],
  fixedFxRates?: Readonly<Record<string, string>>,
): ScenarioManifest {
  return assertManifest({
    schemaVersion: "1.0.0",
    scenarioId,
    scenarioVersion: "1.0.0",
    compatibleContractVersion: ">=1.0.0 <2.0.0",
    seed: `fuelcap:${scenarioId}:1.0.0`,
    clock: { implementation: "InjectedClock", startsAt, timezone: market.country === "UK" ? "Europe/London" : "America/Chicago" },
    market,
    provenance: "illustrative-fixed",
    expectedOutcomeClass,
    documentationAssertions,
    fixedFxRates,
  });
}

const usMarket = (region: string): ScenarioManifest["market"] => ({
  country: "US", region, legalEntity: "fuelcap-us-demo", currency: "USD", fuelUnit: "US_GALLON",
});

const assertion = (
  authority: string,
  path: string,
  equals: DocumentationAssertion["equals"],
  unit?: DocumentationAssertion["unit"],
): DocumentationAssertion => ({ authority, path, equals, unit });

export const scenarioManifests: Readonly<Record<ScenarioId, ScenarioManifest>> = {
  "flat-market-us": manifest("flat-market-us", "2026-08-21T09:30:00.000Z", "PROTECTED_FLAT_MARKET", usMarket("US-NY"), [
    assertion("DEC-014", "quote.chargeRate", 0.023, "PERCENT_4DP"),
    assertion("DEC-014", "quote.marginRate", 0.007, "PERCENT_4DP"),
  ]),
  "rise-within-boundary-us": manifest("rise-within-boundary-us", "2026-08-21T10:15:00.000Z", "SETTLED_WITHIN_BOUNDARY", usMarket("US-NY"), [
    assertion("DEC-015", "settlement.stationAmount", 7800, "USD_MINOR"),
    assertion("DEC-015", "settlement.customerDebit", 7350, "USD_MINOR"),
    assertion("DEC-015", "settlement.fuelcapContribution", 450, "USD_MINOR"),
  ]),
  "boundary-breach-us": manifest("boundary-breach-us", "2026-08-21T14:15:00.000Z", "SETTLED_AT_BOUNDARY", usMarket("US-TX"), [
    assertion("DEC-016", "settlement.stationAmount", 8400, "USD_MINOR"),
    assertion("DEC-016", "settlement.customerDebit", 7700, "USD_MINOR"),
    assertion("DEC-016", "settlement.fuelcapContribution", 700, "USD_MINOR"),
  ]),
  "falling-price-us": manifest("falling-price-us", "2026-08-21T11:30:00.000Z", "SETTLED_BELOW_REFERENCE", usMarket("US-NY"), [
    assertion("DEC-017", "settlement.stationAmount", 6800, "USD_MINOR"),
    assertion("DEC-017", "settlement.fuelcapContribution", 0, "USD_MINOR"),
    assertion("DEC-017", "position.retainedValue", 550, "USD_MINOR"),
  ]),
  "multi-lock-partial-fill-us": manifest("multi-lock-partial-fill-us", "2026-08-21T12:00:00.000Z", "PARTIAL_FILL_ALLOCATED", usMarket("US-CA"), [
    assertion("DEC-018", "allocation.order", "SOONEST_EXPIRY_FIRST"),
    assertion("DEC-018", "allocation.protectionRecharge", false),
    assertion("DEC-018", "allocation.gradeMatch", "EXACT"),
  ]),
  "rollover-rise-fall-us": manifest("rollover-rise-fall-us", "2026-08-22T09:00:00.000Z", "ROLLOVER_REPRICED", usMarket("US-TX"), [
    assertion("DEC-019", "rollover.riseQuantity", 4.506, "US_GALLON_4DP"),
    assertion("DEC-020", "rollover.fallQuantity", 5, "US_GALLON_4DP"),
    assertion("DEC-020", "rollover.fallReleasedSurplus", 121, "USD_MINOR"),
  ]),
  "no-valid-quote-uk": manifest("no-valid-quote-uk", "2026-08-22T10:00:00.000Z", "ROLLOVER_QUOTE_UNAVAILABLE", {
    country: "UK", region: "GB-ENG", legalEntity: "fuelcap-uk-demo", currency: "GBP", fuelUnit: "LITRE",
  }, [
    assertion("DEC-021", "rollover.newCharge", 0, "GBP_MINOR"),
    assertion("DEC-021", "rollover.retroactiveDebitAllowed", false),
    assertion("DEC-021", "rollover.reasonClass", "AVAILABILITY"),
  ]),
  "eligibility-fraud-canada": manifest("eligibility-fraud-canada", "2026-08-22T11:00:00.000Z", "ELIGIBILITY_REVIEW_REQUIRED", {
    country: "CA", region: "CA-ON", legalEntity: "fuelcap-ca-demo", currency: "CAD", fuelUnit: "LITRE",
  }, [
    assertion("DEC-038", "risk.outcome", "HUMAN_REVIEW"),
    assertion("DEC-021", "rollover.reasonClass", "ELIGIBILITY"),
  ]),
  "insufficient-funding-us": manifest("insufficient-funding-us", "2026-08-22T12:00:00.000Z", "PARTIAL_ROLLOVER_AFFORDABLE_VOLUME", usMarket("US-FL"), [
    assertion("DEC-023", "funding.overdraftAllowed", false),
    assertion("DEC-024", "rollover.roundingDirection", "DOWN"),
    assertion("DEC-024", "rollover.minimumQuantity", 1, "US_GALLON_4DP"),
  ]),
  "fleet-multi-vehicle-us": manifest("fleet-multi-vehicle-us", "2026-08-22T13:00:00.000Z", "FLEET_LIMITS_APPLIED", usMarket("US-TX"), [
    assertion("DEC-009", "fleet.vehicleCount", 3),
    assertion("DEC-009", "fleet.vehicleLimitQuantity", 50, "US_GALLON_4DP"),
    assertion("DEC-031", "tenant.crossOrganisationAccess", false),
  ]),
  "fx-movement-multi-market": manifest("fx-movement-multi-market", "2026-08-22T14:00:00.000Z", "FX_CONVERSIONS_BALANCED", {
    country: "MULTI", region: "GLOBAL", legalEntity: "fuelcap-global-demo", currency: "USD", fuelUnit: "US_GALLON",
  }, [
    assertion("DEC-035", "fx.directionExplicit", true),
    assertion("DEC-035", "ledger.balancedPerCurrency", true),
  ], { "USD/CAD": "1.371200", "GBP/USD": "1.286400", "EUR/USD": "1.092500" }),
  "exposure-ai-recommendation": manifest(
    "exposure-ai-recommendation",
    "2026-08-21T16:45:00.000Z",
    "SIMULATED_HEDGE_RECOMMENDED",
    usMarket("US-TX"),
    [
      assertion("DEC-036", "hedge.executionType", "SIMULATED"),
      assertion("DEC-036", "hedge.quantity", 25000, "US_GALLON_4DP"),
      assertion("DEC-060", "approval.selfApprovalAllowed", false),
    ],
  ),
};

export const scenarioOrder = Object.freeze(Object.keys(scenarioManifests) as ScenarioId[]);

export function generatedScenarioRecord(scenarioId: ScenarioId): GeneratedScenarioRecord {
  const selected = scenarioManifests[scenarioId];
  return {
    scenarioId: selected.scenarioId,
    scenarioVersion: selected.scenarioVersion,
    contractVersion: CONTRACT_VERSION,
    scenarioTime: selected.clock.startsAt,
    expectedOutcomeClass: selected.expectedOutcomeClass,
    provenance: selected.provenance,
    market: selected.market,
    documentationAssertions: selected.documentationAssertions,
    fixedFxRates: selected.fixedFxRates ?? {},
  };
}

export function canonicalScenarioJson(scenarioId: ScenarioId) {
  return JSON.stringify(generatedScenarioRecord(scenarioId));
}

export const scenarioGoldenSha256: Readonly<Record<ScenarioId, string>> = {
  "flat-market-us": "1fcb1b2d3203ffde94261546bfac584e53b6f49d104819de206b7b559ffe7d0a",
  "rise-within-boundary-us": "1523b0a78df8ef567718011c58957c672e5e3ea17f8cd4129161218f01f7566d",
  "boundary-breach-us": "36216633dfd5af87222a989c819d5816e00be73f68138ab26d213d26add7ea25",
  "falling-price-us": "be21aad8737d1c9d43f0c0a41ec018aa1bdd39b923a9683eb808af9aecd23f42",
  "multi-lock-partial-fill-us": "80ef900c252446866311360ed3eb52b615e770f63b2cacdbaa7c9809e3f5eded",
  "rollover-rise-fall-us": "4588708b5c6c45f5212f3dc8753ec95c84c190488a0625a7404c9997df045b75",
  "no-valid-quote-uk": "568d997b5ebaa08eabe5ec8d89a29a317126d1001415cbfe271254c052958909",
  "eligibility-fraud-canada": "ae7232ec63401d4e9ed5f5ac1e9fd0270c98f974de6815483a9992cc63805b72",
  "insufficient-funding-us": "f2513d66519ef227e14b8bdcd32c663a76c78e1e6264407bc9b251f900d6c210",
  "fleet-multi-vehicle-us": "d8e2e214a28848d3d744bc8bfc5e167de0f20ae55b05efd946e9b09ab665c99d",
  "fx-movement-multi-market": "a94b2febf06b8ee83581c435e67088fce2ef133b75408685dafcb9d30f5b04a7",
  "exposure-ai-recommendation": "46fd318f07742fc1cf70c8ede6d814c44c9dfa192ac6d2ef42195a096b76da58",
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
    const goldenSha256 = scenarioGoldenSha256[selected.scenarioId];
    if (!/^[a-f0-9]{64}$/.test(goldenSha256)) throw new Error("Scenario golden SHA-256 is missing or invalid.");
    this.clock.reset(selected.clock.startsAt);
    return {
      eventType: "ScenarioReady",
      scenarioId: selected.scenarioId,
      scenarioVersion: selected.scenarioVersion,
      contractVersion: CONTRACT_VERSION,
      scenarioTime: this.clock.now(),
      evidenceId: stableEvidenceId(selected.seed),
      provenance: selected.provenance,
      assertionCount: selected.documentationAssertions.length,
      goldenSha256,
    };
  }
}

export function createScenarioRuntime(environment: DemoEnvironment, initialScenarioId: ScenarioId) {
  return new ScenarioRuntime(environment, initialScenarioId);
}
