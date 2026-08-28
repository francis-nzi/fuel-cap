import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/admin-e2e",
  outputDir: "test-results/admin",
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["line"], ["html", { outputFolder: "playwright-report/admin", open: "never" }]] : "line",
  webServer: {
    command: "corepack pnpm --filter @fuelcap/admin dev --port 3001",
    url: "http://127.0.0.1:3001/api/health",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  use: { baseURL: "http://127.0.0.1:3001", screenshot: "only-on-failure", trace: "retain-on-failure" },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
  ],
});
