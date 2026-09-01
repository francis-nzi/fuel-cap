export const DEMO_CONTROL_SCHEMA = "fuelcap.demo-control.v1" as const;
export type DemoControlCommandType = "RESET_BASELINE" | "PUBLISH_PRICE_RISE" | "WITHDRAW_NEW_QUOTES";
export type DemoControlState = "BASELINE" | "PRICE_RISE_PUBLISHED" | "NEW_QUOTES_WITHDRAWN";

export type DemoControlAudit = Readonly<{
  eventId: string;
  command: DemoControlCommandType;
  actorId: string;
  role: "DP" | "RT";
  correlationId: string;
  sequence: number;
  outcome: "APPLIED";
  occurredAt: string;
}>;

export type DemoControlSnapshot = Readonly<{
  schemaVersion: typeof DEMO_CONTROL_SCHEMA;
  channelId: "investor-demo-consumer-us";
  sequence: number;
  state: DemoControlState;
  market: "US";
  displayUnitPrice: number;
  quoteAvailability: "AVAILABLE" | "PAUSED";
  customerMessage: string;
  decisionId: string;
  correlationId: string;
  acceptedQuote: Readonly<{ quoteId: "QUOTE-DEMO-ACCEPTED-001"; unitPrice: 3.42; status: "PRESERVED" }>;
  simulationOnly: true;
  liveActivationAuthorised: false;
  updatedAt: string;
  audit: readonly DemoControlAudit[];
}>;

export type DemoControlCommand = Readonly<{
  command: DemoControlCommandType;
  actorId: string;
  role: string;
  idempotencyKey: string;
  occurredAt: string;
}>;

export const initialDemoControlSnapshot: DemoControlSnapshot = {
  schemaVersion: DEMO_CONTROL_SCHEMA,
  channelId: "investor-demo-consumer-us",
  sequence: 0,
  state: "BASELINE",
  market: "US",
  displayUnitPrice: 3.42,
  quoteAvailability: "AVAILABLE",
  customerMessage: "Demo control connected · baseline pricing available",
  decisionId: "SPREAD-DEMO-BASELINE-v1",
  correlationId: "DEMO-CONTROL-BASELINE",
  acceptedQuote: { quoteId: "QUOTE-DEMO-ACCEPTED-001", unitPrice: 3.42, status: "PRESERVED" },
  simulationOnly: true,
  liveActivationAuthorised: false,
  updatedAt: "2026-09-01T12:00:00.000Z",
  audit: [],
};

export function applyDemoControlCommand(current: DemoControlSnapshot, input: DemoControlCommand): DemoControlSnapshot {
  if (input.role !== "DP" && input.role !== "RT") throw new Error("DEMO_CONTROL_REQUIRES_PRESENTER_OR_RISK_ROLE");
  if (!input.actorId.trim()) throw new Error("DEMO_CONTROL_REQUIRES_NAMED_ACTOR");
  if (!input.idempotencyKey.trim()) throw new Error("DEMO_CONTROL_REQUIRES_IDEMPOTENCY_KEY");
  const duplicate = current.audit.find((event) => event.eventId === input.idempotencyKey);
  if (duplicate) return current;
  const sequence = current.sequence + 1;
  const correlationId = `DEMO-CONTROL-${String(sequence).padStart(3, "0")}`;
  const projection = input.command === "RESET_BASELINE"
    ? { state: "BASELINE" as const, displayUnitPrice: 3.42, quoteAvailability: "AVAILABLE" as const, customerMessage: "Demo control connected · baseline pricing available", decisionId: "SPREAD-DEMO-BASELINE-v1" }
    : input.command === "PUBLISH_PRICE_RISE"
      ? { state: "PRICE_RISE_PUBLISHED" as const, displayUnitPrice: 3.67, quoteAvailability: "AVAILABLE" as const, customerMessage: "Admin published a simulated price rise · new protection price available", decisionId: "SPREAD-DEMO-RISE-v2" }
      : { state: "NEW_QUOTES_WITHDRAWN" as const, displayUnitPrice: current.displayUnitPrice, quoteAvailability: "PAUSED" as const, customerMessage: "Admin withdrew new quotes · your accepted quote remains protected", decisionId: "SPREAD-DEMO-WITHDRAWN-v3" };
  const event: DemoControlAudit = { eventId: input.idempotencyKey, command: input.command, actorId: input.actorId, role: input.role, correlationId, sequence, outcome: "APPLIED", occurredAt: input.occurredAt };
  return { ...current, ...projection, sequence, correlationId, updatedAt: input.occurredAt, audit: [...current.audit, event].slice(-10), acceptedQuote: initialDemoControlSnapshot.acceptedQuote, simulationOnly: true, liveActivationAuthorised: false };
}

export function validateDemoControlSnapshot(snapshot: DemoControlSnapshot) {
  if (snapshot.schemaVersion !== DEMO_CONTROL_SCHEMA || snapshot.channelId !== "investor-demo-consumer-us") throw new Error("DEMO_CONTROL_CONTRACT_INVALID");
  if (snapshot.acceptedQuote.status !== "PRESERVED" || snapshot.acceptedQuote.unitPrice !== 3.42) throw new Error("ACCEPTED_QUOTE_MUTATED");
  if (!snapshot.simulationOnly || snapshot.liveActivationAuthorised) throw new Error("LIVE_ACTIVATION_PROHIBITED");
  if (snapshot.quoteAvailability === "PAUSED" && snapshot.state !== "NEW_QUOTES_WITHDRAWN") throw new Error("QUOTE_AVAILABILITY_INCONSISTENT");
  return snapshot;
}
