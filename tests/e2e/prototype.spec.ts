import { expect, test, type Locator, type Page } from "@playwright/test";

// Phase 1 acceptance checks (docs/redesign/REDESIGN_BRIEF.md). Runs against the E2E build:
// Supabase is mocked and customer-lifecycle writes stay in the local in-memory store.

async function mockSupabase(page: Page) {
  await page.route("http://127.0.0.1:54321/**", (route) => {
    const isUserLookup = new URL(route.request().url()).pathname.endsWith("/auth/v1/user");
    return route.fulfill({ status: isUserLookup ? 401 : 200, contentType: "application/json", body: isUserLookup ? JSON.stringify({ message: "Not authenticated" }) : "[]" });
  });
}

function clicker(page: Page, projectName: string) {
  const bypassDevOverlay = projectName === "customer-mobile";
  return async (locator: Locator) => {
    if (bypassDevOverlay) await locator.evaluate((element) => (element as HTMLElement).click());
    else await locator.click();
  };
}

// Phones have four tabs (Home, Protect, Pay, Activity); the desktop sidebar keeps its full labels.
const tankTab = (projectName: string) => (projectName === "customer-mobile" ? "Pay" : "My tank");

const noHorizontalOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

test("onboard, protect with a same-step top-up, pay at the pump and keep it all after a refresh", async ({ page }, testInfo) => {
  const click = clicker(page, testInfo.project.name);
  await mockSupabase(page);
  await page.goto("/");

  // Fix 1: onboarding keeps the current market.
  await click(page.getByRole("button", { name: "Create your profile" }));
  await expect(page.getByRole("heading", { name: "Choose how you use FuelCap" })).toBeVisible();
  await click(page.getByRole("button", { name: "Standard", exact: false }));
  await click(page.getByRole("button", { name: "Continue to identity check" }));
  await page.getByLabel("Driving licence photo").setInputFiles({ name: "licence.jpg", mimeType: "image/jpeg", buffer: Buffer.from("demo-licence") });
  await click(page.getByRole("button", { name: "Submit for verification" }));
  await expect(page.getByText("Verification in progress")).toBeVisible();
  await expect(page.getByText("Identity verified")).toBeVisible({ timeout: 5_000 });
  await page.getByLabel("Card PIN").fill("2048");
  await click(page.getByRole("button", { name: "Open my wallet" }));
  await expect(page.getByRole("heading", { name: "FuelCap wallet" })).toBeVisible();
  await expect(page.getByLabel("Market")).toHaveValue("US");
  await expect(page.getByRole("button", { name: "+$100" })).toBeVisible();

  await click(page.getByRole("button", { name: "Home", exact: true }));
  await expect(page.getByRole("heading", { name: "Plan your next fill" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Create your profile" })).toHaveCount(0);
  expect(await noHorizontalOverflow(page)).toBe(true);

  // Fix 5: a search result becomes the selected station and the quote follows it.
  await click(page.getByRole("button", { name: "Lock price", exact: true }).first());
  await expect(page.getByRole("heading", { name: "Lock today's gas price" })).toBeVisible();
  await page.getByLabel("Find a filling station").fill("Riverside");
  const results = page.getByRole("listbox", { name: "Matching filling stations" });
  await expect(results.getByRole("option")).toHaveCount(1);
  await expect(results.getByRole("option", { name: /Shell Riverside/ })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText("Shell Riverside - 480 River Rd, Austin, TX")).toBeVisible();

  // Fix 11: the protection charge is itemised. Fix 2: a short wallet is topped up in the same step.
  const summary = page.getByLabel("Protection summary");
  await expect(summary).toContainText("$3.66/gal");
  await expect(summary).toContainText("5% above today's $3.49");
  await expect(summary).toContainText("$91.61");
  await expect(summary).toContainText("Protection charge");
  await expect(summary).toContainText("$0.08/gal, one-off");
  await expect(summary).toContainText("$2.01");
  await expect(summary).toContainText("$93.62");
  await expect(summary).toContainText("Your wallet has $0.00. We'll add $100.00");
  await click(page.getByRole("button", { name: "Add $100.00 & protect 25 gal" }));
  await expect(page.getByRole("heading", { name: "My virtual tank" })).toBeVisible();
  await expect(page.getByText("25 of 25 gal remaining")).toBeVisible();

  // Fix 3: the pump price comes from the protected station in this market.
  await click(page.getByRole("button", { name: "Redeem", exact: true }));
  await expect(page.getByRole("heading", { name: "Pay with your tank" })).toBeVisible();
  await expect(page.getByText("Pump price now $3.49/gal at Shell Riverside", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "20 gal", exact: true })).toHaveAttribute("aria-pressed", "true");
  await click(page.getByRole("button", { name: "Retailer confirms 20 gal" }));
  await expect(page.getByText("20 gal filled at $3.49/gal. You paid the pump price, and $3.49 went back to your wallet.")).toBeVisible();
  await expect(page.getByText("5 of 25 gal remaining")).toBeVisible();

  // Fix 7: the home card shows the real position, never "+$0.00". The operator status banner is gone.
  await click(page.getByRole("button", { name: "Home", exact: true }));
  await expect(page.getByTestId("headline-unit-price")).toContainText("$3.66/gal");
  await expect(page.getByText("Pump is below your max price")).toBeVisible();
  await expect(page.getByText("You pay $3.49/gal")).toBeVisible();
  await expect(page.getByText("$9.87").first()).toBeVisible();
  await expect(page.getByText("+$0.00")).toHaveCount(0);
  await expect(page.getByText("Price protection service", { exact: false })).toHaveCount(0);

  // Fix 9: activity shows only what happened.
  await click(page.getByRole("button", { name: "Activity", exact: true }));
  await expect(page.getByText("Added funds · card ending 4242")).toBeVisible();
  await expect(page.getByText(/Protected 25 gal · Shell Riverside/)).toBeVisible();
  await expect(page.getByText("Filled 20 gal at $3.49/gal · paid the pump price")).toBeVisible();
  await expect(page.getByText("Pump below your max price · returned to wallet")).toBeVisible();
  await expect(page.getByText("Price-drop adjustment")).toHaveCount(0);

  // Fix 8: state survives a refresh and onboarding is not offered again.
  await page.reload();
  await expect(page.getByRole("heading", { name: "Your fuel is protected" })).toBeVisible();
  await expect(page.getByText("$9.87").first()).toBeVisible();
  await expect(page.getByTestId("headline-unit-price")).toContainText("$3.66/gal");
  await expect(page.getByRole("button", { name: "Create your profile" })).toHaveCount(0);
  expect(await noHorizontalOverflow(page)).toBe(true);
});

test("each market keeps its own wallet and protections, and UK 'anywhere' uses a typical price", async ({ page }, testInfo) => {
  const click = clicker(page, testInfo.project.name);
  await mockSupabase(page);
  await page.goto("/");

  await click(page.getByRole("button", { name: "Lock price", exact: true }).first());
  await expect(page.getByLabel("Protection summary")).toContainText("We'll add $100.00");
  await click(page.getByRole("button", { name: /Confirm price lock/ }));
  await expect(page.getByText("25 of 25 gal remaining")).toBeVisible();

  // Fix 4: the UK has its own empty wallet and tank; no US data leaks across.
  await page.getByLabel("Market").selectOption("GB");
  await click(page.getByRole("button", { name: "Home", exact: true }));
  await expect(page.getByText("Shell Fulham")).toBeVisible();
  await expect(page.getByText("Austin, TX")).toHaveCount(0);
  await expect(page.getByText("Nothing protected yet")).toBeVisible();
  await expect(page.getByText("£0.00").first()).toBeVisible();
  await expect(page.getByText("$", { exact: false })).toHaveCount(0);

  // Fix 12: nothing to pay with shows an empty state, not a QR code.
  await click(page.getByRole("button", { name: "Redeem at pump" }));
  const dialog = page.getByRole("dialog", { name: "Pay with your tank" });
  await expect(dialog.getByText("Nothing protected yet")).toBeVisible();
  await expect(dialog.locator('path[shape-rendering="crispEdges"]')).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: /Retailer confirms/ })).toHaveCount(0);
  await click(dialog.getByRole("button", { name: "Close" }));

  // Fix 6: brand and "anywhere" prices are medians of the listed stations (1.419…1.479 → £1.44).
  await click(page.getByRole("button", { name: "Lock price", exact: true }).first());
  await click(page.getByRole("button", { name: "Anywhere" }));
  await expect(page.getByText("Typical price anywhere")).toBeVisible();
  await expect(page.getByLabel("Protection summary")).toContainText("5% above today's £1.44");
  await click(page.getByRole("button", { name: "One brand" }));
  await expect(page.getByRole("listbox", { name: "Matching fuel brands" }).getByRole("option", { name: /BP/ })).toContainText("£1.44/L");

  await page.getByLabel("Market").selectOption("US");
  await click(page.getByRole("button", { name: tankTab(testInfo.project.name), exact: true }));
  await expect(page.getByText("25 of 25 gal remaining")).toBeVisible();
});

test("a new customer sees no invented history and no dead buttons", async ({ page }, testInfo) => {
  const click = clicker(page, testInfo.project.name);
  await mockSupabase(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Plan your next fill" })).toBeVisible();
  for (const invented of ["$142", "18 protected fills", "6 months", "Your advantage", "+$0.00", "Share scorecard"]) {
    await expect(page.getByText(invented, { exact: false })).toHaveCount(0);
  }
  await expect(page.getByRole("button", { name: "Notifications" })).toHaveCount(0);
  await expect(page.getByText("DEMO", { exact: true })).toBeVisible();
  await expect(page.getByText("Price protection service", { exact: false })).toHaveCount(0);

  if (testInfo.project.name === "customer-mobile") {
    // Four labelled tabs, none clipped or overlapping.
    const tabs = page.locator("nav[aria-label='Primary navigation']").last().getByRole("button");
    await expect(tabs).toHaveText(["Home", "Protect", "Pay", "Activity"]);
    const boxes = await tabs.evaluateAll((buttons) => buttons.map((button) => {
      const label = button.querySelector("span") as HTMLElement;
      const box = label.getBoundingClientRect();
      return { left: box.left, right: box.right, clipped: label.scrollWidth > label.clientWidth };
    }));
    boxes.forEach((box, index) => {
      expect(box.clipped).toBe(false);
      if (index > 0) expect(box.left).toBeGreaterThanOrEqual(boxes[index - 1].right);
    });
  }

  await click(page.getByRole("button", { name: "Activity", exact: true }));
  await expect(page.getByText("No activity yet. Your first protection will show here.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Filter activity" })).toHaveCount(0);

  await click(page.getByRole("button", { name: "Settings", exact: true }));
  await expect(page.getByRole("button", { name: "Manage payment method" })).toHaveCount(0);

  await click(page.getByRole("button", { name: tankTab(testInfo.project.name), exact: true }));
  await expect(page.getByText("Nothing protected yet")).toBeVisible();
  await expect(page.getByText("starter tank", { exact: false })).toHaveCount(0);

  await click(page.getByRole("button", { name: "Open account menu" }));
  for (const dead of ["Statements", "Protection details", "Notifications"]) {
    await expect(page.getByRole("button", { name: dead })).toHaveCount(0);
  }
});

// Brief acceptance cases: protect 25 gal at the $3.50 demo station, move the pump, pay for 20 gal.
// The pump follows the presenter's control price (US station price + control move from its $3.42 baseline).
const controlSnapshot = (displayUnitPrice: number) => ({
  schemaVersion: "fuelcap.demo-control.v1", channelId: "investor-demo-consumer-us", sequence: 1, state: "PRICE_RISE_PUBLISHED", market: "US",
  displayUnitPrice, quoteAvailability: "AVAILABLE", customerMessage: "", decisionId: "TEST", correlationId: "TEST",
  acceptedQuote: { quoteId: "TEST", unitPrice: 3.42, status: "PRESERVED" }, simulationOnly: true, liveActivationAuthorised: false,
  updatedAt: "2026-09-28T12:00:00.000Z", audit: [], bridgeReachable: true,
});

for (const [name, pump, message, wallet] of [
  ["Case A: rise to $3.90", 3.9, "20 gal filled at $3.90/gal. FuelCap covered $4.50.", "$6.11"],
  ["Case B: spike to $4.20", 4.2, "20 gal filled at $4.20/gal. FuelCap covered $7.00. $3.50 above your limit came from your wallet.", "$2.61"],
  ["Case C: fall to $3.40", 3.4, "20 gal filled at $3.40/gal. You paid the pump price, and $5.50 went back to your wallet.", "$11.61"],
] as const) {
  test(`brief ${name}`, async ({ page }, testInfo) => {
    const click = clicker(page, testInfo.project.name);
    await mockSupabase(page);
    let control = 3.42;
    await page.route("**/api/demo-control", (route) => route.fulfill({ json: controlSnapshot(control) }));
    await page.goto("/");
    await expect(page.getByTestId("headline-unit-price")).toContainText("$3.50/gal");

    await click(page.getByRole("button", { name: "Lock price", exact: true }).first());
    const summary = page.getByLabel("Protection summary");
    await expect(summary).toContainText("$3.68/gal");
    await expect(summary).toContainText("5% above today's $3.50");
    await expect(summary).toContainText("25 gal × $3.68");
    await expect(summary).toContainText("$91.88");
    await expect(summary).toContainText("$2.01");
    await expect(summary).toContainText("$93.89");
    await expect(page.getByText("up to $4.03/gal")).toBeVisible();
    await click(page.getByRole("button", { name: "Add $100.00 & protect 25 gal" }));
    await expect(page.getByText("25 of 25 gal remaining")).toBeVisible();

    control = Math.round((pump - 0.08) * 100) / 100;
    await click(page.getByRole("button", { name: "Redeem", exact: true }));
    await expect(page.getByText(`Pump price now $${pump.toFixed(2)}/gal at Shell Downtown`, { exact: false })).toBeVisible({ timeout: 10_000 });
    await click(page.getByRole("button", { name: "Retailer confirms 20 gal" }));
    await expect(page.getByText(message)).toBeVisible();

    await click(page.getByRole("button", { name: "Home", exact: true }));
    await expect(page.getByText(wallet).first()).toBeVisible();
    await expect(page.getByText("5 of 25 gal left · $18.38 held")).toBeVisible();
  });
}

test("account authentication dialog is reachable", async ({ page }) => {
  await mockSupabase(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Open account menu" }).click();
  await page.getByRole("button", { name: "Create account or sign in" }).click();
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
});
