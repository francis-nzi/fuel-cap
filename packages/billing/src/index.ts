import { createHash, createHmac, timingSafeEqual } from "node:crypto";
export * from "./catalogue";

export const BILLING_VERSION = "billing@1.0.0" as const;
export type BillingCurrency = "USD" | "CAD" | "GBP";
export type PaymentStatus = "REQUIRES_PAYMENT_METHOD" | "REQUIRES_CONFIRMATION" | "REQUIRES_ACTION" | "PROCESSING" | "REQUIRES_CAPTURE" | "SUCCEEDED" | "CANCELED";
export type SubscriptionStatus = "INCOMPLETE" | "INCOMPLETE_EXPIRED" | "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELED" | "UNPAID" | "PAUSED";
export type ProviderMode = "TEST" | "LIVE";

export type CreatePaymentCommand = Readonly<{ commandId: string; idempotencyKey: string; customerId: string; walletId: string; amountMinor: number; currency: BillingCurrency; paymentMethodReference: string; mode: ProviderMode }>;
export type PaymentRecord = Readonly<{ paymentId: string; provider: "STRIPE"; providerObjectId: string; mode: "TEST"; customerId: string; walletId: string; amountMinor: number; currency: BillingCurrency; status: PaymentStatus; idempotencyKey: string; updatedAt: string }>;
export type CreateSubscriptionCommand = Readonly<{ commandId: string; idempotencyKey: string; customerId: string; planId: string; priceReference: string; currency: BillingCurrency; mode: ProviderMode }>;
export type SubscriptionRecord = Readonly<{ subscriptionId: string; provider: "STRIPE"; providerObjectId: string; mode: "TEST"; customerId: string; planId: string; currency: BillingCurrency; status: SubscriptionStatus; idempotencyKey: string; currentPeriodEnd: string | null; updatedAt: string }>;

export type StripeGateway = Readonly<{
  createPaymentIntent(command: CreatePaymentCommand): Promise<Readonly<{ id: string; status: StripePaymentStatus; livemode: boolean }>>;
  createSubscription(command: CreateSubscriptionCommand): Promise<Readonly<{ id: string; status: StripeSubscriptionStatus; livemode: boolean; currentPeriodEnd: string | null }>>;
}>;
export type StripePaymentStatus = "requires_payment_method" | "requires_confirmation" | "requires_action" | "processing" | "requires_capture" | "succeeded" | "canceled";
export type StripeSubscriptionStatus = "incomplete" | "incomplete_expired" | "trialing" | "active" | "past_due" | "canceled" | "unpaid" | "paused";
export type WebhookRequest = Readonly<{ rawBody: string; signatureHeader: string; receivedAt: string }>;
export type WebhookVerifier = (request: WebhookRequest) => boolean;
export type StoredWebhook = Readonly<{ eventId: string; eventType: string; provider: "STRIPE"; mode: "TEST"; payloadHash: string; rawPayload: string; receivedAt: string; status: "PENDING" | "PROCESSED" | "IGNORED"; processedAt: string | null }>;
export type LedgerFundingInstruction = Readonly<{ instructionId: string; idempotencyKey: string; eventId: string; providerObjectId: string; customerId: string; walletId: string; amountMinor: number; currency: BillingCurrency; eventType: "CUSTOMER_FUNDING_CONFIRMED"; source: "STRIPE_TEST" }>;
export type WebhookIngestResult = Readonly<{ disposition: "QUEUED" | "DUPLICATE"; event: StoredWebhook }>;

type StripeEvent = Readonly<{ id: string; type: string; livemode: boolean; created?: number; data: Readonly<{ object: Record<string, unknown> }> }>;
const paymentStatuses: Record<StripePaymentStatus, PaymentStatus> = { requires_payment_method: "REQUIRES_PAYMENT_METHOD", requires_confirmation: "REQUIRES_CONFIRMATION", requires_action: "REQUIRES_ACTION", processing: "PROCESSING", requires_capture: "REQUIRES_CAPTURE", succeeded: "SUCCEEDED", canceled: "CANCELED" };
const subscriptionStatuses: Record<StripeSubscriptionStatus, SubscriptionStatus> = { incomplete: "INCOMPLETE", incomplete_expired: "INCOMPLETE_EXPIRED", trialing: "TRIALING", active: "ACTIVE", past_due: "PAST_DUE", canceled: "CANCELED", unpaid: "UNPAID", paused: "PAUSED" };
const requireText = (value: string, label: string) => { if (!value.trim()) throw new Error(`${label} is required.`); };
const requireTestMode = (mode: ProviderMode) => { if (mode !== "TEST") throw new Error("Live Stripe access is prohibited before the Phase 6 controlled enablement."); };
const hash = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");

export class StripeTestBillingAdapter {
  private readonly paymentsByKey = new Map<string, PaymentRecord>();
  private readonly subscriptionsByKey = new Map<string, SubscriptionRecord>();
  private readonly paymentMethodByKey = new Map<string, string>();
  private readonly priceByKey = new Map<string, string>();
  private readonly paymentsByProviderId = new Map<string, PaymentRecord>();
  private readonly subscriptionsByProviderId = new Map<string, SubscriptionRecord>();
  private readonly events = new Map<string, StoredWebhook>();
  private readonly instructions = new Map<string, LedgerFundingInstruction>();

  constructor(private readonly gateway: StripeGateway, private readonly verifyWebhook: WebhookVerifier, private readonly now: () => string) {}

  async createPayment(command: CreatePaymentCommand): Promise<PaymentRecord> {
    validatePayment(command);
    const prior = this.paymentsByKey.get(command.idempotencyKey);
    if (prior) {
      if (prior.customerId !== command.customerId || prior.walletId !== command.walletId || prior.amountMinor !== command.amountMinor || prior.currency !== command.currency || this.paymentMethodByKey.get(command.idempotencyKey) !== command.paymentMethodReference) throw new Error("Idempotency key was reused with different payment parameters.");
      return prior;
    }
    const result = await this.gateway.createPaymentIntent(command);
    if (result.livemode) throw new Error("Stripe returned a live-mode payment object in the test adapter.");
    const record: PaymentRecord = { paymentId: command.commandId, provider: "STRIPE", providerObjectId: result.id, mode: "TEST", customerId: command.customerId, walletId: command.walletId, amountMinor: command.amountMinor, currency: command.currency, status: paymentStatuses[result.status], idempotencyKey: command.idempotencyKey, updatedAt: this.now() };
    this.paymentsByKey.set(command.idempotencyKey, record);
    this.paymentMethodByKey.set(command.idempotencyKey, command.paymentMethodReference);
    this.paymentsByProviderId.set(result.id, record);
    return record;
  }

  async createSubscription(command: CreateSubscriptionCommand): Promise<SubscriptionRecord> {
    validateSubscription(command);
    const prior = this.subscriptionsByKey.get(command.idempotencyKey);
    if (prior) {
      if (prior.customerId !== command.customerId || prior.planId !== command.planId || prior.currency !== command.currency || this.priceByKey.get(command.idempotencyKey) !== command.priceReference) throw new Error("Idempotency key was reused with different subscription parameters.");
      return prior;
    }
    const result = await this.gateway.createSubscription(command);
    if (result.livemode) throw new Error("Stripe returned a live-mode subscription object in the test adapter.");
    const record: SubscriptionRecord = { subscriptionId: command.commandId, provider: "STRIPE", providerObjectId: result.id, mode: "TEST", customerId: command.customerId, planId: command.planId, currency: command.currency, status: subscriptionStatuses[result.status], idempotencyKey: command.idempotencyKey, currentPeriodEnd: result.currentPeriodEnd, updatedAt: this.now() };
    this.subscriptionsByKey.set(command.idempotencyKey, record);
    this.priceByKey.set(command.idempotencyKey, command.priceReference);
    this.subscriptionsByProviderId.set(result.id, record);
    return record;
  }

  ingestWebhook(request: WebhookRequest): WebhookIngestResult {
    if (!this.verifyWebhook(request)) throw new Error("Stripe webhook signature verification failed.");
    let parsed: StripeEvent;
    try { parsed = JSON.parse(request.rawBody) as StripeEvent; } catch { throw new Error("Stripe webhook payload is not valid JSON."); }
    requireText(parsed.id ?? "", "Webhook event ID");
    requireText(parsed.type ?? "", "Webhook event type");
    if (parsed.livemode) throw new Error("Live Stripe webhooks are prohibited before the Phase 6 controlled enablement.");
    const payloadHash = hash(request.rawBody);
    const prior = this.events.get(parsed.id);
    if (prior) {
      if (prior.payloadHash !== payloadHash) throw new Error("Webhook event ID was reused with a different immutable payload.");
      return { disposition: "DUPLICATE", event: prior };
    }
    const event: StoredWebhook = { eventId: parsed.id, eventType: parsed.type, provider: "STRIPE", mode: "TEST", payloadHash, rawPayload: request.rawBody, receivedAt: request.receivedAt, status: "PENDING", processedAt: null };
    this.events.set(parsed.id, event);
    return { disposition: "QUEUED", event };
  }

  processNextWebhook(): StoredWebhook | null {
    const pending = [...this.events.values()].find(({ status }) => status === "PENDING");
    if (!pending) return null;
    const event = JSON.parse(pending.rawPayload) as StripeEvent;
    let status: StoredWebhook["status"] = "IGNORED";
    if (event.type === "payment_intent.succeeded") status = this.processPaymentSucceeded(event) ? "PROCESSED" : "IGNORED";
    else if (event.type.startsWith("customer.subscription.")) status = this.processSubscriptionEvent(event) ? "PROCESSED" : "IGNORED";
    const updated: StoredWebhook = { ...pending, status, processedAt: this.now() };
    this.events.set(updated.eventId, updated);
    return updated;
  }

  listWebhookEvents(): readonly StoredWebhook[] { return [...this.events.values()]; }
  listFundingInstructions(): readonly LedgerFundingInstruction[] { return [...this.instructions.values()]; }
  getPayment(providerObjectId: string): PaymentRecord | undefined { return this.paymentsByProviderId.get(providerObjectId); }
  getSubscription(providerObjectId: string): SubscriptionRecord | undefined { return this.subscriptionsByProviderId.get(providerObjectId); }

  private processPaymentSucceeded(event: StripeEvent): boolean {
    const object = event.data.object;
    const providerObjectId = String(object.id ?? "");
    const payment = this.paymentsByProviderId.get(providerObjectId);
    if (!payment) return false;
    if (object.livemode === true || Number(object.amount_received) !== payment.amountMinor || String(object.currency).toUpperCase() !== payment.currency) throw new Error("Stripe payment event does not reconcile to the FuelCap payment command.");
    const updated = { ...payment, status: "SUCCEEDED" as const, updatedAt: this.now() };
    this.paymentsByProviderId.set(providerObjectId, updated);
    this.paymentsByKey.set(payment.idempotencyKey, updated);
    this.instructions.set(event.id, { instructionId: `stripe:${event.id}`, idempotencyKey: `stripe-event:${event.id}`, eventId: event.id, providerObjectId, customerId: payment.customerId, walletId: payment.walletId, amountMinor: payment.amountMinor, currency: payment.currency, eventType: "CUSTOMER_FUNDING_CONFIRMED", source: "STRIPE_TEST" });
    return true;
  }

  private processSubscriptionEvent(event: StripeEvent): boolean {
    const object = event.data.object;
    const providerObjectId = String(object.id ?? "");
    const subscription = this.subscriptionsByProviderId.get(providerObjectId);
    if (!subscription) return false;
    const rawStatus = String(object.status) as StripeSubscriptionStatus;
    if (object.livemode === true || !subscriptionStatuses[rawStatus]) throw new Error("Stripe subscription event is invalid for the test adapter.");
    const updated = { ...subscription, status: subscriptionStatuses[rawStatus], currentPeriodEnd: typeof object.current_period_end === "number" ? new Date(object.current_period_end * 1000).toISOString() : subscription.currentPeriodEnd, updatedAt: this.now() };
    this.subscriptionsByProviderId.set(providerObjectId, updated);
    this.subscriptionsByKey.set(subscription.idempotencyKey, updated);
    return true;
  }
}

function validatePayment(command: CreatePaymentCommand) {
  requireTestMode(command.mode);
  for (const [value, label] of [[command.commandId, "Command ID"], [command.idempotencyKey, "Idempotency key"], [command.customerId, "Customer ID"], [command.walletId, "Wallet ID"], [command.paymentMethodReference, "Payment method reference"]] as const) requireText(value, label);
  if (!Number.isSafeInteger(command.amountMinor) || command.amountMinor <= 0) throw new Error("Payment amount must be a positive safe integer in minor units.");
}
function validateSubscription(command: CreateSubscriptionCommand) {
  requireTestMode(command.mode);
  for (const [value, label] of [[command.commandId, "Command ID"], [command.idempotencyKey, "Idempotency key"], [command.customerId, "Customer ID"], [command.planId, "Plan ID"], [command.priceReference, "Price reference"]] as const) requireText(value, label);
}

export function createStripeWebhookVerifier(endpointSecret: string, toleranceSeconds = 300, nowEpochSeconds = () => Math.floor(Date.now() / 1000)): WebhookVerifier {
  requireText(endpointSecret, "Webhook endpoint secret");
  if (!Number.isSafeInteger(toleranceSeconds) || toleranceSeconds < 0) throw new Error("Webhook tolerance must be a non-negative integer.");
  return ({ rawBody, signatureHeader }) => {
    const parts = signatureHeader.split(",").map((part) => part.split("=", 2) as [string, string]);
    const timestampText = parts.find(([key]) => key === "t")?.[1];
    const signatures = parts.filter(([key]) => key === "v1").map(([, value]) => value);
    if (!timestampText || signatures.length === 0) return false;
    const timestamp = Number(timestampText);
    if (!Number.isSafeInteger(timestamp) || Math.abs(nowEpochSeconds() - timestamp) > toleranceSeconds) return false;
    const expected = createHmac("sha256", endpointSecret).update(`${timestamp}.${rawBody}`, "utf8").digest();
    return signatures.some((signature) => {
      if (!/^[0-9a-f]{64}$/i.test(signature)) return false;
      const supplied = Buffer.from(signature, "hex");
      return supplied.length === expected.length && timingSafeEqual(supplied, expected);
    });
  };
}
