import { expect, test } from "@playwright/test";

test("admin governs the separate customer demonstrator without mutating an accepted quote", async ({ page, context }, testInfo) => {
  const bypassDevOverlay = testInfo.project.name === "mobile-webkit";
  await context.route("http://127.0.0.1:54321/**", (route) => {
    const isUserLookup = new URL(route.request().url()).pathname.endsWith("/auth/v1/user");
    return route.fulfill({ status: isUserLookup ? 401 : 200, contentType: "application/json", body: isUserLookup ? JSON.stringify({ message: "Not authenticated" }) : "[]" });
  });
  const admin = await context.newPage();
  await admin.goto("http://127.0.0.1:3001/");
  await page.goto("/");
  await page.getByRole("button", { name: "Create your profile" }).click();
  await page.getByRole("button", { name: "+$500" }).click();
  await page.getByRole("button", { name: "Home", exact: true }).click({ force: bypassDevOverlay });

  await admin.getByRole("button", { name: /Reset baseline/ }).click();
  await expect(page.getByRole("status").filter({ hasText: "baseline pricing available" })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId("headline-unit-price")).toContainText("$3.42/gal");

  await admin.getByRole("button", { name: /Publish price rise/ }).click();
  await expect(admin.getByRole("status").filter({ hasText: "simulated price rise" })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "price rise" })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId("headline-unit-price")).toContainText("$3.67/gal");
  await page.getByRole("button", { name: "Lock price" }).first().click({ force: bypassDevOverlay });
  await expect(page.getByText("$3.67/gal", { exact: false }).first()).toBeVisible();

  await admin.getByRole("button", { name: /Stop new quotes/ }).click();
  const customerControl = page.getByRole("status").filter({ hasText: "accepted quote remains protected" });
  await expect(customerControl).toBeVisible({ timeout: 10_000 });
  await expect(customerControl).toContainText("$3.42/gal remains unchanged");
  await expect(page.getByRole("button", { name: "Confirm price lock" })).toBeDisabled();

  await admin.getByRole("button", { name: /Reset baseline/ }).click();
  await expect(page.getByRole("status").filter({ hasText: "baseline pricing available" })).toBeVisible({ timeout: 10_000 });
});
