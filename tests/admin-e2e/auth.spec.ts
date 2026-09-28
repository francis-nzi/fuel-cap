import { expect, test, type Browser, type Page, type TestInfo } from "@playwright/test";
import { enterStepUpCode, freshCode, inviteLink, passwordStep, rewindIdleClock, signIn, staff, wrongCode } from "../admin-auth/helpers";

// Control-room sign-in: Supabase Auth (mock server in tests), invite-only, authenticator-app MFA (aal2)
// on every page and API route, step-up for sensitive actions, 30-minute idle sign-out, audit trail.

const controlRoomHeading = (page: Page) => page.getByRole("heading", { name: "Customer funds, fuel exposure and operating performance" });

test("blocked with no session: every page sends you to sign-in", async ({ page }) => {
  for (const path of ["/", "/staff", "/account", "/mfa"]) {
    await page.goto(path);
    await expect(page, path).toHaveURL(/\/login$/);
  }
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expect(controlRoomHeading(page)).toHaveCount(0);
});

test("API rejects unauthenticated calls, including forged identity headers", async ({ request }) => {
  const forged = { "X-FuelCap-Demo-Principal": "principal-presenter", "X-FuelCap-Demo-Role": "DP", "x-fuelcap-demo-principal-id": "principal-platform", "x-fuelcap-active-organisation": "org-fuelcap-global" };
  const calls: [string, string, unknown?][] = [
    ["GET", "/api/demo/control"],
    ["POST", "/api/demo/control", { command: "PUBLISH_PRICE_RISE" }],
    ["GET", "/api/customer-lifecycle"],
    ["POST", "/api/customer-lifecycle", { type: "FUND_WALLET", customerId: "FC-DEMO-1042", amountMinor: 100 }],
    ["POST", "/api/demo/scenarios/reset", { scenarioId: "exposure" }],
    ["GET", "/api/demo/organisations/org-fuelcap-global/fleet"],
    ["GET", "/api/live-pricing"],
    ["GET", "/api/admin/staff"],
    ["POST", "/api/admin/staff", { email: "intruder@example.test", displayName: "Intruder", roles: ["PA"] }],
    ["GET", "/api/admin/audit"],
    ["POST", "/api/admin/governed-actions", { action: "emergency-access" }],
    ["POST", "/api/auth/step-up", { code: "123456" }],
    ["POST", "/api/auth/activity"],
  ];
  for (const [method, path, data] of calls) {
    const response = await request.fetch(path, { method, data, headers: forged });
    expect(response.status(), `${method} ${path}`).toBe(401);
    expect((await response.json()).error, `${method} ${path}`).toBe("UNAUTHENTICATED");
  }
  expect((await request.get("/api/health")).status()).toBe(200);
});

test("blocked without MFA: a password-only session reaches nothing but the code step", async ({ page }) => {
  await passwordStep(page, staff.risk);
  await page.waitForURL("**/mfa");
  await expect(page.getByRole("heading", { name: "Enter your authenticator code" })).toBeVisible();
  for (const path of ["/", "/staff", "/account"]) {
    await page.goto(path);
    await expect(page, path).toHaveURL(/\/mfa$/);
  }
  for (const [method, path] of [["GET", "/api/customer-lifecycle"], ["POST", "/api/demo/control"], ["GET", "/api/demo/control"]]) {
    const response = await page.request.fetch(path, { method, data: method === "POST" ? { command: "PUBLISH_PRICE_RISE" } : undefined });
    expect(response.status(), `${method} ${path}`).toBe(403);
    expect((await response.json()).error).toBe("MFA_REQUIRED");
  }
  // A password alone can't change the password either (that would lock the real person out).
  const passwordChange = await page.request.post("/api/auth/set-password", { data: { password: "attacker-chosen-password" } });
  expect(passwordChange.status()).toBe(403);
  await page.getByLabel("6-digit code").fill(wrongCode(staff.risk.totpSecret!));
  await page.getByRole("button", { name: "Verify" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "didn't match" })).toBeVisible();
  await expect(page).toHaveURL(/\/mfa$/);
});

test("allowed with MFA: password plus authenticator code opens the control room as that person", async ({ page }) => {
  await signIn(page, staff.risk);
  await expect(controlRoomHeading(page)).toBeVisible();
  if (await page.getByRole("button", { name: "Open navigation" }).isVisible()) await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(page.getByText("Riley Risk").first()).toBeVisible();
  await expect(page.getByLabel("Demo principal")).toHaveCount(0);
  const published = await page.request.get("/api/demo/control");
  expect(published.status()).toBe(200);
});

test("step-up required for hedging: a fresh code, checked by the server, before the hedge goes ahead", async ({ page }) => {
  await signIn(page, staff.risk);
  // The sign-in MFA check doesn't count as a step-up.
  const before = await page.request.post("/api/admin/governed-actions", { data: { action: "initiate-hedge" } });
  expect(before.status()).toBe(428);
  expect((await before.json()).error).toBe("STEP_UP_REQUIRED");

  await page.getByText("Advanced operations and technical controls").click();
  await page.locator(".ai-actions button").first().click();
  await expect(page.getByRole("status").getByText("Step-up authentication required")).toBeVisible();
  await page.getByRole("button", { name: "Confirm with step-up MFA" }).click();
  const dialog = page.getByRole("dialog", { name: "Confirm it's you" });
  await dialog.getByLabel("Authenticator code").fill(wrongCode(staff.risk.totpSecret!));
  await dialog.getByRole("button", { name: "Confirm" }).click();
  await expect(dialog.getByRole("alert")).toContainText("didn't work");
  await dialog.getByLabel("Authenticator code").fill(await freshCode(staff.risk.totpSecret!));
  await dialog.getByRole("button", { name: "Confirm" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("status").getByText("Fresh assurance verified")).toBeVisible();
  await expect(page.getByText("Simulated action approved")).toBeVisible();

  // The grant lasts 5 minutes: further step-up actions go through without another code.
  const after = await page.request.post("/api/admin/governed-actions", { data: { action: "initiate-hedge" } });
  expect(after.status()).toBe(200);
  expect(await after.json()).toMatchObject({ allowed: true, reasonCode: "ALLOW" });
});

test("roles come from the server: the presenter is refused hedging without being asked for a code", async ({ page }) => {
  await signIn(page, staff.presenter);
  const response = await page.request.post("/api/admin/governed-actions", { data: { action: "initiate-hedge" }, headers: { "X-FuelCap-Demo-Role": "RT" } });
  expect(response.status()).toBe(403);
  expect(await response.json()).toMatchObject({ allowed: false, reasonCode: "DENY_POLICY" });
});

/** Platform admin (already signed in on `page`) invites a new member of staff, who accepts and enrols. */
async function inviteAndEnrol(page: Page, browser: Browser, testInfo: TestInfo, label: string) {
  const email = `${label}-${Date.now()}-${testInfo.project.name}@fuelcap.test`;
  const password = "invitee-password-2026";
  await page.goto("/staff", { waitUntil: "networkidle" });
  await page.getByLabel("Full name").fill("Ines Invitee");
  await page.getByLabel("Work email").fill(email);
  await page.getByRole("checkbox", { name: /^OP/ }).check();
  await page.getByRole("button", { name: "Send invite" }).click();
  await enterStepUpCode(page, staff.admin.totpSecret!);
  await expect(page.getByRole("status").getByText(`Invite sent to ${email}`)).toBeVisible();

  const invitee = await (await browser.newContext({ baseURL: testInfo.project.use.baseURL })).newPage();
  await invitee.goto(await inviteLink(email));
  await expect(invitee).toHaveURL(/\/auth\/set-password$/);
  await invitee.waitForLoadState("networkidle");
  await invitee.getByLabel("New password").fill(password);
  await invitee.getByLabel("Confirm password").fill(password);
  await invitee.getByRole("button", { name: "Save and continue" }).click();
  await expect(invitee.getByRole("heading", { name: "Set up your authenticator app" })).toBeVisible();
  // Nothing else is reachable until the authenticator is set up.
  await invitee.goto("/");
  await expect(invitee).toHaveURL(/\/mfa$/);
  const secret = (await invitee.getByTestId("totp-secret").innerText()).trim();
  await invitee.getByLabel("6-digit code").fill(await freshCode(secret));
  await invitee.getByRole("button", { name: "Turn on and continue" }).click();
  await expect(controlRoomHeading(invitee)).toBeVisible();
  return { email, password, secret, invitee };
}

test("invite-only: a platform admin invites staff (with step-up); first sign-in forces authenticator set-up", async ({ page, browser }, testInfo) => {
  test.slow(); // two people, several screens and a step-up
  await signIn(page, staff.admin);
  const { email, invitee } = await inviteAndEnrol(page, browser, testInfo, "staff");
  await invitee.context().close();
  await page.reload();
  const log = page.getByRole("region", { name: "Recent security events" });
  for (const event of ["STAFF_INVITED", "STEP_UP_SUCCEEDED", "MFA_ENROLLED", "PASSWORD_SET", "SIGN_IN_SUCCEEDED", "MFA_VERIFY_SUCCEEDED"]) await expect(log.getByText(event, { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("region", { name: "Staff" }).getByText(email)).toBeVisible();
});

test("lost phone: backup authenticator, then platform-admin disable and reset (all audited)", async ({ page, browser }, testInfo) => {
  test.slow(); // two people, several screens and two step-ups
  await signIn(page, staff.admin);
  const { email, password, invitee } = await inviteAndEnrol(page, browser, testInfo, "recovery");

  // With a backup authenticator, the member removes the lost one themselves (step-up with the backup's code).
  await invitee.goto("/account", { waitUntil: "networkidle" });
  await invitee.getByRole("button", { name: "Add a backup authenticator" }).click();
  const backupSecret = (await invitee.getByTestId("totp-secret").innerText()).trim();
  await invitee.getByLabel("6-digit code").fill(await freshCode(backupSecret));
  await invitee.getByRole("button", { name: "Add backup authenticator" }).click();
  const authenticators = invitee.getByRole("list", { name: "Authenticator apps" }).getByRole("listitem");
  await expect(authenticators).toHaveCount(2);
  await invitee.waitForLoadState("networkidle"); // the page reloads after adding the backup
  await invitee.getByRole("button", { name: /^Remove Authenticator 1/ }).click();
  await enterStepUpCode(invitee, backupSecret);
  await expect(authenticators).toHaveCount(1);
  await expect(invitee.getByRole("button", { name: /^Remove/ })).toHaveCount(0);

  // Without a backup, a platform admin disables access at once, then resets the authenticators.
  await page.goto("/staff");
  // The step-up from sending the invite is still inside its 5-minute window, so no new code is asked for.
  await page.getByRole("button", { name: `Disable access for ${email}` }).click();
  await expect(page.getByRole("status").getByText("access is disabled")).toBeVisible();
  await invitee.goto("/");
  await expect(invitee).toHaveURL(/\/login\?error=NOT_STAFF$/);
  await page.getByRole("button", { name: `Reset authenticator for ${email}` }).click();
  await expect(page.getByRole("status").getByText("authenticators were removed")).toBeVisible();
  await page.getByRole("button", { name: `Enable access for ${email}` }).click();
  await expect(page.getByRole("status").getByText("access is enabled")).toBeVisible();

  // Their next sign-in forces a new authenticator.
  await passwordStep(invitee, { email, password });
  await expect(invitee.getByRole("heading", { name: "Set up your authenticator app" })).toBeVisible();
  await invitee.context().close();

  await page.reload();
  const log = page.getByRole("region", { name: "Recent security events" });
  for (const event of ["MFA_FACTOR_REMOVED", "STAFF_DISABLED", "MFA_RESET_BY_ADMIN", "STAFF_ENABLED"]) await expect(log.getByText(event, { exact: true }).first()).toBeVisible();
});
test("wrong passwords and non-staff accounts are refused, and the attempts are audited", async ({ page }) => {
  await passwordStep(page, { email: staff.risk.email, password: "not-the-password" });
  await expect(page.getByRole("alert").filter({ hasText: "didn't match a staff account" })).toBeVisible();
  await passwordStep(page, staff.outsider);
  await expect(page.getByRole("alert").filter({ hasText: "didn't match a staff account" })).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);

  await signIn(page, staff.admin);
  await page.goto("/staff");
  const log = page.getByRole("region", { name: "Recent security events" });
  await expect(log.getByRole("row").filter({ hasText: "SIGN_IN_FAILED" }).filter({ hasText: staff.risk.email }).first()).toBeVisible();
  await expect(log.getByRole("row").filter({ hasText: "SIGN_IN_DENIED_NOT_STAFF" }).filter({ hasText: staff.outsider.email }).first()).toBeVisible();
});

test("30 minutes without activity signs you out on the server", async ({ page }) => {
  await signIn(page, staff.risk);
  await rewindIdleClock(page, 31);
  await page.goto("/");
  await expect(page).toHaveURL(/\/login\?reason=timeout$/);
  await expect(page.getByText("signed out after 30 minutes without activity")).toBeVisible();
  expect((await page.request.get("/api/demo/control")).status()).toBe(401);
});
