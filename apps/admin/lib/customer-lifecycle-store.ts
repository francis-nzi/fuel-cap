import { applyLifecycleCommand, initialCustomerLifecycleSnapshot, type CustomerLifecycleSnapshot, type LifecycleCommand } from "@fuelcap/demo-data/customer-lifecycle";

const state = globalThis as typeof globalThis & { __fuelcapCustomerLifecycle?: CustomerLifecycleSnapshot };

export function readCustomerLifecycle() {
  state.__fuelcapCustomerLifecycle ??= initialCustomerLifecycleSnapshot;
  return state.__fuelcapCustomerLifecycle;
}

export function dispatchCustomerLifecycle(command: LifecycleCommand) {
  state.__fuelcapCustomerLifecycle = applyLifecycleCommand(readCustomerLifecycle(), command);
  return state.__fuelcapCustomerLifecycle;
}
