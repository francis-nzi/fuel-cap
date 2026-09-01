import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: "test-results/customer",
  retries: process.env.CI ? 1 : 0,
  reporter: "line",
  webServer: { command: "corepack pnpm dev --port 3000", url: "http://127.0.0.1:3000/api/health", reuseExistingServer: !process.env.CI, timeout: 120_000, env: { DEMO_CONTROL_ORIGIN: "http://127.0.0.1:3001", NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "demo-publishable-key-not-live" } },
  use: { baseURL: "http://127.0.0.1:3000", screenshot: "only-on-failure", trace: "retain-on-failure" },
  projects: [
    { name: "customer-desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "customer-mobile", use: { ...devices["Pixel 7"] } },
  ],
});
