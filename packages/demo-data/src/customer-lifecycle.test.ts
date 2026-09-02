import { describe, expect, it } from "vitest";
import { applyLifecycleCommand, initialCustomerLifecycleSnapshot } from "./customer-lifecycle";

describe("customer lifecycle", () => {
  it("turns a verified signup into an issued-card funded customer record", () => {
    const customerId = "FC-TEST-1";
    let state = applyLifecycleCommand(initialCustomerLifecycleSnapshot, { type: "REGISTER_CUSTOMER", customer: { customerId, name: "Demo Customer", email: "demo@example.test", phone: "+44 7700 900001", planId: "STANDARD" } });
    state = applyLifecycleCommand(state, { type: "START_KYC", customerId, licenceLast4: "2048" });
    expect(state.customers[0]).toMatchObject({ kycState: "PENDING", card: { status: "NOT_ISSUED" } });
    state = applyLifecycleCommand(state, { type: "VERIFY_KYC", customerId });
    state = applyLifecycleCommand(state, { type: "SET_PIN", customerId });
    state = applyLifecycleCommand(state, { type: "FUND_WALLET", customerId, amountMinor: 50000 });
    expect(state.customers[0]).toMatchObject({ kycState: "VERIFIED", pinSet: true, walletBalanceMinor: 50000, fundsInMinor: 50000, card: { status: "ACTIVE", providerId: "marqeta-demo" } });
  });

  it("versions commercial plan changes", () => {
    const standard = initialCustomerLifecycleSnapshot.plans.find((plan) => plan.id === "STANDARD")!;
    const state = applyLifecycleCommand(initialCustomerLifecycleSnapshot, { type: "UPSERT_PLAN", plan: { ...standard, monthlyFeeMinor: 599 } });
    expect(state.plans.find((plan) => plan.id === "STANDARD")).toMatchObject({ monthlyFeeMinor: 599, version: 2 });
  });
});
