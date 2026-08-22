import type { ScenarioId, ScenarioManifest } from "./index";

export type MockObservation = Readonly<{
  observationId: string;
  kind:
    | "SimulatedPumpObservation"
    | "FixedFXObservation"
    | "PaymentObservation"
    | "AccountingExportObservation"
    | "CommunicationDeliveryObservation"
    | "SimulatedHedgeExecution"
    | "AIRecommendationObservation";
  scenarioId: ScenarioId;
  occurredAt: string;
  provider: "fuelcap-demo-adapter";
  status: "simulated";
  payload: Readonly<Record<string, string | number | boolean>>;
}>;

export interface ScenarioPort {
  observe(manifest: ScenarioManifest): readonly MockObservation[];
}

function deterministicId(seed: string, role: string) {
  let hash = 2166136261;
  for (const character of `${seed}:${role}`) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `OBS-DEMO-${role.toUpperCase()}-${(hash >>> 0).toString(16).toUpperCase().padStart(8, "0")}`;
}

function observation(
  manifest: ScenarioManifest,
  role: string,
  kind: MockObservation["kind"],
  payload: MockObservation["payload"],
): MockObservation {
  return {
    observationId: deterministicId(manifest.seed, role),
    kind,
    scenarioId: manifest.scenarioId,
    occurredAt: manifest.clock.startsAt,
    provider: "fuelcap-demo-adapter",
    status: "simulated",
    payload,
  };
}

export const mockScenarioPorts: Readonly<Record<string, ScenarioPort>> = {
  pricingData: {
    observe: (manifest) => [observation(manifest, "price", "SimulatedPumpObservation", {
      region: manifest.market.region,
      currency: manifest.market.currency,
      fuelUnit: manifest.market.fuelUnit,
      provenance: manifest.provenance,
    })],
  },
  fxRate: {
    observe: (manifest) => Object.entries(manifest.fixedFxRates ?? {}).map(([pair, rate]) =>
      observation(manifest, `fx-${pair}`, "FixedFXObservation", { pair, rate, direction: pair }),
    ),
  },
  payment: {
    observe: (manifest) => [observation(manifest, "payment", "PaymentObservation", {
      movement: "none",
      connectorMode: "contract-shaped-mock",
    })],
  },
  accounting: {
    observe: (manifest) => [observation(manifest, "accounting", "AccountingExportObservation", {
      exportMode: "preview-only",
      postedToXero: false,
    })],
  },
  communications: {
    observe: (manifest) => [observation(manifest, "communication", "CommunicationDeliveryObservation", {
      deliveryMode: "preview-only",
      externallyDelivered: false,
    })],
  },
  hedgeExecution: {
    observe: (manifest) => manifest.scenarioId === "exposure-ai-recommendation"
      ? [observation(manifest, "hedge", "SimulatedHedgeExecution", { quantity: 25000, liveExecution: false })]
      : [],
  },
  aiProvider: {
    observe: (manifest) => [observation(manifest, "ai", "AIRecommendationObservation", {
      mode: "golden-fallback",
      canApprove: false,
      assertionCount: manifest.documentationAssertions.length,
    })],
  },
};

export function collectMockObservations(manifest: ScenarioManifest) {
  return Object.values(mockScenarioPorts).flatMap((port) => port.observe(manifest));
}
