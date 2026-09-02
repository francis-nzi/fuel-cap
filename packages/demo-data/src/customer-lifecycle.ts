export type PlanId = "BASIC" | "STANDARD" | "PLUS";
export type KycState = "NOT_STARTED" | "PENDING" | "VERIFIED";

export type ServicePlan = Readonly<{
  id: PlanId;
  name: string;
  monthlyFeeMinor: number;
  spreadBps: number;
  walletLimitMinor: number;
  monthlyFuelLimitLitres: number;
  stationScope: "STATION" | "BRAND" | "ANYWHERE";
  benefits: readonly string[];
  version: number;
}>;

export type CardProvider = Readonly<{
  id: string;
  name: string;
  role: "PRIMARY" | "FAILOVER";
  status: "CONNECTED";
  cardType: "VIRTUAL_DEBIT";
  bin: string;
  customers: number;
}>;

export type LifecycleCustomer = Readonly<{
  customerId: string;
  name: string;
  email: string;
  phone: string;
  planId: PlanId;
  kycState: KycState;
  licenceLast4: string | null;
  walletBalanceMinor: number;
  fundsInMinor: number;
  fundsOutMinor: number;
  customerProfitLossMinor: number;
  card: Readonly<{ providerId: string; maskedPan: string; expiry: string; status: "NOT_ISSUED" | "ACTIVE" }>;
  pinSet: boolean;
  protectedVolumeLitres: number;
  lastActivity: string;
  updatedAt: string;
}>;

export type CustomerLifecycleSnapshot = Readonly<{
  schemaVersion: "fuelcap.customer-lifecycle.v1";
  sequence: number;
  plans: readonly ServicePlan[];
  cardProviders: readonly CardProvider[];
  customers: readonly LifecycleCustomer[];
  updatedAt: string;
}>;

export type LifecycleCommand =
  | Readonly<{ type: "UPSERT_PLAN"; plan: ServicePlan }>
  | Readonly<{ type: "REGISTER_CUSTOMER"; customer: Pick<LifecycleCustomer, "customerId" | "name" | "email" | "phone" | "planId"> }>
  | Readonly<{ type: "START_KYC"; customerId: string; licenceLast4: string }>
  | Readonly<{ type: "VERIFY_KYC"; customerId: string }>
  | Readonly<{ type: "SET_PIN"; customerId: string }>
  | Readonly<{ type: "FUND_WALLET"; customerId: string; amountMinor: number }>
  | Readonly<{ type: "CHANGE_PLAN"; customerId: string; planId: PlanId }>;

export const servicePlans: readonly ServicePlan[] = [
  { id: "BASIC", name: "Basic", monthlyFeeMinor: 0, spreadBps: 350, walletLimitMinor: 50000, monthlyFuelLimitLitres: 150, stationScope: "STATION", benefits: ["Protect at one station", "Standard wallet"], version: 1 },
  { id: "STANDARD", name: "Standard", monthlyFeeMinor: 499, spreadBps: 225, walletLimitMinor: 150000, monthlyFuelLimitLitres: 400, stationScope: "BRAND", benefits: ["Protect across one brand", "Price alerts", "Higher limits"], version: 1 },
  { id: "PLUS", name: "Plus", monthlyFeeMinor: 999, spreadBps: 125, walletLimitMinor: 300000, monthlyFuelLimitLitres: 800, stationScope: "ANYWHERE", benefits: ["Protect anywhere", "Lowest spread", "Priority support"], version: 1 },
];

export const cardProviders: readonly CardProvider[] = [
  { id: "marqeta-demo", name: "Marqeta sandbox", role: "PRIMARY", status: "CONNECTED", cardType: "VIRTUAL_DEBIT", bin: "541275", customers: 1264 },
  { id: "stripe-issuing-demo", name: "Stripe Issuing sandbox", role: "FAILOVER", status: "CONNECTED", cardType: "VIRTUAL_DEBIT", bin: "424242", customers: 87 },
];

const now = "2026-09-02T08:00:00.000Z";
export const initialCustomerLifecycleSnapshot: CustomerLifecycleSnapshot = {
  schemaVersion: "fuelcap.customer-lifecycle.v1",
  sequence: 0,
  plans: servicePlans,
  cardProviders,
  customers: [
    { customerId: "FC-100284", name: "Oliver Bennett", email: "oliver.bennett@example.test", phone: "+44 7700 900284", planId: "STANDARD", kycState: "VERIFIED", licenceLast4: "4821", walletBalanceMinor: 38640, fundsInMinor: 75000, fundsOutMinor: 36360, customerProfitLossMinor: 1268, card: { providerId: "marqeta-demo", maskedPan: "5412 •••• •••• 4821", expiry: "09/29", status: "ACTIVE" }, pinSet: true, protectedVolumeLitres: 112, lastActivity: "Fuel purchase at Shell Islington", updatedAt: now },
    { customerId: "FC-100271", name: "Sophie Williams", email: "sophie.williams@example.test", phone: "+44 7700 900271", planId: "PLUS", kycState: "VERIFIED", licenceLast4: "1937", walletBalanceMinor: 82410, fundsInMinor: 125000, fundsOutMinor: 42590, customerProfitLossMinor: 2384, card: { providerId: "marqeta-demo", maskedPan: "5412 •••• •••• 1937", expiry: "08/29", status: "ACTIVE" }, pinSet: true, protectedVolumeLitres: 246, lastActivity: "Protected 60 litres anywhere", updatedAt: now },
    { customerId: "FC-100299", name: "Amelia Hughes", email: "amelia.hughes@example.test", phone: "+44 7700 900299", planId: "BASIC", kycState: "PENDING", licenceLast4: "7754", walletBalanceMinor: 0, fundsInMinor: 0, fundsOutMinor: 0, customerProfitLossMinor: 0, card: { providerId: "marqeta-demo", maskedPan: "Not issued", expiry: "—", status: "NOT_ISSUED" }, pinSet: false, protectedVolumeLitres: 0, lastActivity: "Driving licence submitted", updatedAt: now },
  ],
  updatedAt: now,
};

export function applyLifecycleCommand(snapshot: CustomerLifecycleSnapshot, command: LifecycleCommand, occurredAt = new Date().toISOString()): CustomerLifecycleSnapshot {
  let plans = snapshot.plans;
  let customers = snapshot.customers;
  if (command.type === "UPSERT_PLAN") plans = snapshot.plans.map((plan) => plan.id === command.plan.id ? { ...command.plan, version: plan.version + 1 } : plan);
  if (command.type === "REGISTER_CUSTOMER") {
    const existing = customers.find((customer) => customer.customerId === command.customer.customerId);
    const record: LifecycleCustomer = { ...command.customer, kycState: "NOT_STARTED", licenceLast4: null, walletBalanceMinor: 0, fundsInMinor: 0, fundsOutMinor: 0, customerProfitLossMinor: 0, card: { providerId: "marqeta-demo", maskedPan: "Not issued", expiry: "—", status: "NOT_ISSUED" }, pinSet: false, protectedVolumeLitres: 0, lastActivity: "Account created", updatedAt: occurredAt };
    customers = existing ? customers.map((customer) => customer.customerId === record.customerId ? record : customer) : [record, ...customers];
  }
  const update = (customerId: string, mutate: (customer: LifecycleCustomer) => LifecycleCustomer) => { customers = customers.map((customer) => customer.customerId === customerId ? mutate(customer) : customer); };
  if (command.type === "START_KYC") update(command.customerId, (customer) => ({ ...customer, kycState: "PENDING", licenceLast4: command.licenceLast4, lastActivity: "Driving licence submitted", updatedAt: occurredAt }));
  if (command.type === "VERIFY_KYC") update(command.customerId, (customer) => ({ ...customer, kycState: "VERIFIED", card: { providerId: "marqeta-demo", maskedPan: `5412 •••• •••• ${customer.licenceLast4 ?? "2048"}`, expiry: "09/29", status: "ACTIVE" }, lastActivity: "KYC verified and card issued", updatedAt: occurredAt }));
  if (command.type === "SET_PIN") update(command.customerId, (customer) => ({ ...customer, pinSet: true, lastActivity: "Card PIN set", updatedAt: occurredAt }));
  if (command.type === "FUND_WALLET") update(command.customerId, (customer) => ({ ...customer, walletBalanceMinor: customer.walletBalanceMinor + command.amountMinor, fundsInMinor: customer.fundsInMinor + command.amountMinor, lastActivity: `Wallet funded £${(command.amountMinor / 100).toFixed(2)}`, updatedAt: occurredAt }));
  if (command.type === "CHANGE_PLAN") update(command.customerId, (customer) => ({ ...customer, planId: command.planId, lastActivity: `Plan changed to ${command.planId}`, updatedAt: occurredAt }));
  return { ...snapshot, sequence: snapshot.sequence + 1, plans, customers, updatedAt: occurredAt };
}
