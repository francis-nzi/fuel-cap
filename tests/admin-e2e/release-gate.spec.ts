import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

async function expectNoSeriousAccessibilityViolations(page: import("@playwright/test").Page) {
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(result.violations.filter(({ impact }) => impact === "critical" || impact === "serious")).toEqual([]);
}

test("golden control-room journey is responsive and accessible", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "FuelCap Operating System" })).toBeVisible();
  await expect(page.getByText("No live partner dependency", { exact: false })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole("button", { name: /Reset scenario/ }).click();
  await expect(page.getByRole("button", { name: "Scenario ready" })).toBeVisible();
  await expectNoSeriousAccessibilityViolations(page);
});

test("presenter is denied a governed risk action", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Test denied action/ }).click();
  await expect(page.getByRole("status").getByText("Permission denied")).toBeVisible();
  await page.getByRole("button", { name: /Test break-glass boundary/ }).click();
  await expect(page.getByRole("status").getByText("Break-glass boundary enforced")).toBeVisible();
});

test("risk and treasury evidence preserves simulation boundaries", async ({ page }) => {
  await page.goto("/");
  if (await page.getByRole("button", { name: "Open navigation" }).isVisible()) await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("button", { name: "Risk & Hedging" }).click();
  await expect(page.getByRole("heading", { name: "Risk & Hedging" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Treasury & risk-transfer control centre" })).toBeVisible();
  await expect(page.getByText("No bank instruction", { exact: false })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expectNoSeriousAccessibilityViolations(page);
});

test("tenant switching fails closed for platform risk records", async ({ page }) => {
  await page.goto("/");
  const desktopOrganisation = page.getByLabel("Active organisation");
  if (await desktopOrganisation.isVisible()) await desktopOrganisation.selectOption("org-fleet-northstar");
  else await page.getByLabel("Organisation", { exact: true }).selectOption("org-fleet-northstar");
  if (await page.getByRole("button", { name: "Open navigation" }).isVisible()) await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("button", { name: "Risk & Hedging" }).click();
  await expect(page.getByRole("heading", { name: "Risk exposure is platform-scoped" })).toBeVisible();
});

test("release provenance reconciles deploy, smoke and rollback evidence", async ({ page }) => {
  await page.goto("/");
  if (await page.getByRole("button", { name: "Open navigation" }).isVisible()) await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("button", { name: "Platform, Integrations & Audit" }).click();
  await expect(page.getByRole("heading", { name: "Platform, Integrations & Audit" })).toBeVisible();
  await page.getByRole("button", { name: /Release provenance/ }).click();
  await expect(page.getByRole("heading", { name: "Gate C deployed release evidence" })).toBeVisible();
  await expect(page.getByText("dep-da8mncko5n7c73ffh02g", { exact: false })).toBeVisible();
  await expect(page.getByText("Previous healthy f05a4b4", { exact: false })).toBeVisible();
  await expect(page.getByText("Release evidence never authorises live financial activation", { exact: false })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expectNoSeriousAccessibilityViolations(page);
});
