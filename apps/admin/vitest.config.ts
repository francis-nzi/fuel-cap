import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "supabase/**/*.test.ts"],
    testTimeout: 30_000,
  },
  resolve: { alias: { "@": path.resolve(__dirname, "."), "server-only": path.resolve(__dirname, "lib/auth/test-server-only.ts") } },
});
