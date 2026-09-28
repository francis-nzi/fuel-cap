import { defineConfig, devices } from "@playwright/test";
import { adminE2eEnv, mockAuthServer } from "./tests/admin-auth/env";

export default defineConfig({
  testDir: "./tests/admin-e2e",
  outputDir: "test-results/admin",
  fullyParallel: false,
  // One dev server compiles pages on demand; more parallel browsers than this makes the long journeys time out.
  workers: 2,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["line"], ["html", { outputFolder: "playwright-report/admin", open: "never" }]] : "line",
  globalSetup: "./tests/admin-e2e/global-setup.ts",
  webServer: [
    mockAuthServer,
    {
      command: "corepack pnpm --filter @fuelcap/admin dev --port 3001",
      url: "http://127.0.0.1:3001/api/health",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: adminE2eEnv,
    },
  ],
  use: { baseURL: "http://127.0.0.1:3001", screenshot: "only-on-failure", trace: "retain-on-failure" },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
    { name: "desktop-firefox", use: { ...devices["Desktop Firefox"], viewport: { width: 1440, height: 900 } } },
    { name: "mobile-webkit", use: { ...devices["iPhone 15"] } },
  ],
});
