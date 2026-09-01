import "server-only";
import { applyDemoControlCommand, initialDemoControlSnapshot, validateDemoControlSnapshot, type DemoControlCommand, type DemoControlSnapshot } from "@fuelcap/demo-control";

declare global {
  var fuelcapDemoControlSnapshot: DemoControlSnapshot | undefined;
}

export function readDemoControlSnapshot() {
  return validateDemoControlSnapshot(globalThis.fuelcapDemoControlSnapshot ?? initialDemoControlSnapshot);
}

export function dispatchDemoControlCommand(command: DemoControlCommand) {
  const next = applyDemoControlCommand(readDemoControlSnapshot(), command);
  globalThis.fuelcapDemoControlSnapshot = next;
  return next;
}
