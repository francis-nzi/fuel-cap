import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
export default defineConfig({ resolve: { alias: {
  "@fuelcap/domain": fileURLToPath(new URL("../domain/src/index.ts", import.meta.url)),
  "@fuelcap/pricing-ingestion": fileURLToPath(new URL("../pricing-ingestion/src/index.ts", import.meta.url)),
  "@fuelcap/benchmark-engine": fileURLToPath(new URL("../benchmark-engine/src/index.ts", import.meta.url)),
  "@fuelcap/spread-engine": fileURLToPath(new URL("../spread-engine/src/index.ts", import.meta.url)),
} }, test: { environment: "node" } });
