import { expect, test } from "@playwright/test";

test("admin governs the separate customer demonstrator without mutating an accepted quote", async ({ page, context }, testInfo) => {
  const bypassDevOverlay = testInfo.project.name === "mobile-webkit";
  async function customerClick(locator: ReturnType<typeof page.getByRole>) {
    if (bypassDevOverlay) await locator.evaluate((element) => (element as HTMLElement).click());
    else await locator.click();
  }
  await context.route("http://127.0.0.1:54321/**", (route) => {
    const isUserLookup = new URL(route.request().url()).pathname.endsWith("/auth/v1/user");
    return route.fulfill({ status: isUserLookup ? 401 : 200, contentType: "application/json", body: isUserLookup ? JSON.stringify({ message: "Not authenticated" }) : "[]" });
  });
  const admin = await context.newPage();
  await admin.goto("http://127.0.0.1:3001/");
  await page.goto("/");

  await admin.getByRole("button", { name: /Reset baseline/ }).click();
  await expect(page.getByRole("status").filter({ hasText: "baseline pricing available" })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId("headline-unit-price")).toContainText("$3.42/gal");

  await admin.getByRole("button", { name: /Publish price rise/ }).click();
  await expect(admin.getByRole("status").filter({ hasText: "simulated price rise" })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "price rise" })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId("headline-unit-price")).toContainText("$3.67/gal");
  await customerClick(page.getByRole("button", { name: "Lock price" }).first());
  await expect(page.getByText("$3.67/gal", { exact: false }).first()).toBeVisible();

  await admin.getByRole("button", { name: /Stop new quotes/ }).click();
  const customerControl = page.getByRole("status").filter({ hasText: "accepted quote remains protected" });
  await expect(customerControl).toBeVisible({ timeout: 10_000 });
  await expect(customerControl).toContainText("$3.42/gal remains unchanged");
  await expect(page.getByRole("button", { name: "Confirm price lock" })).toBeDisabled();

  await admin.getByRole("button", { name: /Reset baseline/ }).click();
  await expect(page.getByRole("status").filter({ hasText: "baseline pricing available" })).toBeVisible({ timeout: 10_000 });

  await customerClick(page.getByRole("button", { name: "Home", exact: true }));
  await customerClick(page.getByRole("button", { name: "Create your profile" }));
  await customerClick(page.getByRole("button", { name: "Continue to identity check" }));
  const adminMenu = admin.getByRole("button", { name: "Open navigation" });
  if (await adminMenu.isVisible()) await adminMenu.click();
  await admin.getByRole("button", { name: "Customers" }).click();
  await expect(admin.getByRole("heading", { name: "Customers, plans and cards" })).toBeVisible();
  await expect(admin.getByText("Francis Doherty", { exact: true })).toBeVisible({ timeout: 10_000 });
  await page.getByLabel("Driving licence photo").setInputFiles({ name: "licence.jpg", mimeType: "image/jpeg", buffer: Buffer.from("demo-licence") });
  await customerClick(page.getByRole("button", { name: "Submit for verification" }));
  const customerRow = admin.getByRole("row").filter({ hasText: "Francis Doherty" });
  await expect(page.getByText("Verification in progress")).toBeVisible();
  await expect(page.getByText("Identity verified")).toBeVisible({ timeout: 5_000 });
  await expect(customerRow.getByText("VERIFIED", { exact: true })).toBeVisible({ timeout: 10_000 });
});
