import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/bridge-e2e",
  outputDir: "test-results/bridge",
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 45_000,
  reporter: process.env.CI ? [["line"], ["html", { outputFolder: "playwright-report/bridge", open: "never" }]] : "line",
  webServer: [
    { command: "corepack pnpm dev --port 3000", url: "http://127.0.0.1:3000/api/health", reuseExistingServer: !process.env.CI, timeout: 120_000, env: { DEMO_CONTROL_ORIGIN: "http://127.0.0.1:3001" } },
    { command: "corepack pnpm --filter @fuelcap/admin dev --port 3001", url: "http://127.0.0.1:3001/api/health", reuseExistingServer: !process.env.CI, timeout: 120_000 },
  ],
  use: { baseURL: "http://127.0.0.1:3000", screenshot: "only-on-failure", trace: "retain-on-failure" },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "mobile-webkit", use: { ...devices["iPhone 15"] } },
  ],
});
