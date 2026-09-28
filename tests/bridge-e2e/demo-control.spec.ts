import { expect, test } from "@playwright/test";
import { signIn, staff } from "../admin-auth/helpers";

// With staff sign-in on the control room, every admin /api/* route needs an aal2 staff session. The customer
// app calls the control room server-to-server with no such session, so it now degrades to its own baseline
// price and local customer records instead of following the control room. (A service credential for that
// link would need a customer-app change; see apps/admin/docs/ADMIN_AUTH.md.)
test("the customer app can no longer read or write the control room without a staff session", async ({ page, context, browser, request }, testInfo) => {
  const bypassDevOverlay = testInfo.project.name === "mobile-webkit";
  async function customerClick(locator: ReturnType<typeof page.getByRole>) {
    if (bypassDevOverlay) await locator.evaluate((element) => (element as HTMLElement).click());
    else await locator.click();
  }
  await context.route("http://127.0.0.1:54321/**", (route) => {
    const isUserLookup = new URL(route.request().url()).pathname.endsWith("/auth/v1/user");
    return route.fulfill({ status: isUserLookup ? 401 : 200, contentType: "application/json", body: isUserLookup ? JSON.stringify({ message: "Not authenticated" }) : "[]" });
  });
  const adminContext = await browser.newContext({ baseURL: "http://127.0.0.1:3001", viewport: { width: 1440, height: 900 } });
  const admin = await adminContext.newPage();
  await signIn(admin, staff.presenter);
  await admin.getByRole("button", { name: /Reset baseline/ }).click();
  await expect(admin.getByRole("status").filter({ hasText: "baseline pricing available" })).toBeVisible();

  await page.goto("/");
  await expect(page.getByTestId("headline-unit-price")).toContainText("$3.50/gal", { timeout: 10_000 });
  // The customer app's server-to-server read of the control room is refused, so it reports the fallback.
  const bridge = await (await request.get("/api/demo-control")).json() as { bridgeReachable: boolean };
  expect(bridge.bridgeReachable).toBe(false);

  // Signed-in staff can still publish, but the unauthenticated customer app doesn't pick it up.
  await admin.getByRole("button", { name: /Publish price rise/ }).click();
  await expect(admin.getByRole("status").filter({ hasText: "simulated price rise" })).toBeVisible();
  await page.waitForTimeout(4_000);
  await expect(page.getByTestId("headline-unit-price")).toContainText("$3.50/gal");

  // Customer onboarding stays in the customer app's local store; the control-room register doesn't receive it.
  await customerClick(page.getByRole("button", { name: "Create your profile" }));
  await customerClick(page.getByRole("button", { name: "Continue to identity check" }));
  await expect(page.getByRole("heading", { name: "Verify your identity" })).toBeVisible();
  await admin.getByRole("button", { name: "Customers" }).click();
  await expect(admin.getByRole("heading", { name: "Customers, plans and cards" })).toBeVisible();
  await expect(admin.getByText("Francis Doherty", { exact: true })).toHaveCount(0);
  await adminContext.close();
});
