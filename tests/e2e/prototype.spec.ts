import { expect, test } from "@playwright/test";

test("core prototype flow works without horizontal overflow", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Your fuel is protected" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.getByLabel("Market").selectOption("GB");
  await expect(page.getByText("£1.42", { exact: false }).first()).toBeVisible();

  await page.getByRole("button", { name: "Lock price", exact: true }).last().click();
  await expect(page.getByRole("heading", { name: "Lock today's fuel price" })).toBeVisible();
  await page.getByRole("button", { name: "Confirm demo lock" }).click();
  await expect(page.getByText("Active price locks")).toBeVisible();
  await expect(page.getByText("320 L")).toBeVisible();

  await page.getByRole("button", { name: "Redeem" }).click();
  await expect(page.getByRole("heading", { name: "Pay with your tank" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("account authentication dialog is reachable", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open account menu" }).click();
  await page.getByRole("button", { name: "Create account or sign in" }).click();
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
});
