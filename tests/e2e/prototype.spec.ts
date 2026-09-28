import { expect, test, type Locator, type Page } from "@playwright/test";

// Phase 2 customer app (docs/redesign/REDESIGN_BRIEF.md, prototype/Main.dc.html). Runs against the E2E build:
// Supabase is mocked and customer-lifecycle writes stay in the local in-memory store.

async function mockSupabase(page: Page) {
  await page.route("http://127.0.0.1:54321/**", (route) => {
    const isUserLookup = new URL(route.request().url()).pathname.endsWith("/auth/v1/user");
    return route.fulfill({ status: isUserLookup ? 401 : 200, contentType: "application/json", body: isUserLookup ? JSON.stringify({ message: "Not authenticated" }) : "[]" });
  });
  // Deterministic sharing: no native share sheet, a clipboard that always succeeds.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
    Object.defineProperty(navigator, "clipboard", { value: { writeText: async () => undefined }, configurable: true });
  });
}

function clicker(page: Page, projectName: string) {
  const bypassDevOverlay = projectName === "customer-mobile";
  return async (locator: Locator) => {
    if (bypassDevOverlay) await locator.evaluate((element) => (element as HTMLElement).click());
    else await locator.click();
  };
}

const tab = (page: Page, name: "Home" | "Protect" | "Pay" | "Activity") => page.getByRole("navigation", { name: "Primary navigation" }).getByRole("button", { name, exact: true });
const summary = (page: Page) => page.getByLabel("Protection summary");
const noHorizontalOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

async function protect25(page: Page, click: (locator: Locator) => Promise<void>) {
  await click(page.getByRole("button", { name: "Protect my fuel" }));
  await expect(page.getByRole("heading", { name: "Protect your fuel" })).toBeVisible();
  await expect(page.getByRole("radio", { name: /Shell Downtown/ })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("radio", { name: "25 gal" })).toHaveAttribute("aria-checked", "true");
  await click(page.getByRole("button", { name: "Add $100.00 & protect 25 gal" }));
  await expect(page.getByRole("heading", { name: "25 gal protected" })).toBeVisible();
}

async function setPresenterPump(page: Page, click: (locator: Locator) => Promise<void>, label: RegExp, mobile: boolean) {
  if (mobile) await click(page.getByRole("button", { name: "Open presenter controls" }));
  await click(page.getByRole("radio", { name: label }).last());
  if (mobile) await click(page.getByRole("button", { name: "Close presenter controls" }));
}

const cases = [
  { name: "A: rise to $3.90", pump: /Price rises/, headline: "FuelCap covered $4.50", eyebrow: "PRICE ROSE · HEADS YOU WIN", rows: ["Pump total (20 × $3.90)$78.00", "Paid from protected fuel$73.50", "Paid by FuelCap$4.50"], absent: ["Returned to your wallet", "Above your limit", "Saved vs today"], wallet: "$6.11", saved: "$4.50", coral: false },
  { name: "B: spike to $4.20", pump: /Spike past limit/, headline: "FuelCap covered $7.00", eyebrow: "PRICE SPIKED PAST YOUR LIMIT", rows: ["Pump total (20 × $4.20)$84.00", "Paid from protected fuel$73.50", "Paid by FuelCap$7.00", "Above your limit, from wallet$3.50"], absent: ["Returned to your wallet", "Saved vs today"], wallet: "$2.61", saved: "$7.00", coral: false },
  { name: "C: fall to $3.40", pump: /Price falls/, headline: "$5.50 back in your wallet · you saved $2.00 vs today's price", eyebrow: "PRICE DROPPED · TAILS YOU WIN", rows: ["Pump total (20 × $3.40)$68.00", "Paid from protected fuel$68.00", "Returned to your wallet+$5.50", "Saved vs today's $3.50$2.00"], absent: ["Paid by FuelCap", "Above your limit"], wallet: "$11.61", saved: "$2.00", coral: true },
];

for (const scenario of cases) {
  test(`brief case ${scenario.name}: protect 25 gal at $3.50, fill 20 gal`, async ({ page }, testInfo) => {
    const click = clicker(page, testInfo.project.name);
    const mobile = testInfo.project.name === "customer-mobile";
    await mockSupabase(page);
    await page.goto("/?demo=1");
    await expect(page.getByTestId("headline-unit-price")).toContainText("$3.50");
    await expect(page.getByText("never pay more than $3.68/gal for 7 days", { exact: false })).toBeVisible();

    await click(page.getByRole("button", { name: "Protect my fuel" }));
    await expect(summary(page)).toContainText("$3.68/gal");
    await expect(summary(page)).toContainText("5% above today's $3.50");
    await expect(summary(page)).toContainText("25 gal × $3.68");
    await expect(summary(page)).toContainText("$91.88");
    await expect(summary(page)).toContainText("$0.08/gal, one-off, not refundable");
    await expect(summary(page)).toContainText("$2.01");
    await expect(summary(page)).toContainText("$93.89");
    await expect(summary(page)).toContainText("Your wallet has $0.00. We'll add $100.00 from your card ending 4242 in the same step.");
    await expect(page.getByText("Price rises: we pay the difference, up to $4.03/gal.")).toBeVisible();
    await click(page.getByRole("button", { name: "Add $100.00 & protect 25 gal" }));
    await expect(page.getByRole("heading", { name: "25 gal protected" })).toBeVisible();
    await expect(page.getByText("You'll never pay more than $3.68/gal at Shell Downtown until", { exact: false })).toBeVisible();
    await expect(page.getByText("Wallet remaining: $6.11")).toBeVisible();

    await setPresenterPump(page, click, scenario.pump, mobile);
    await click(page.getByRole("button", { name: "Pay at pump now" }));
    await expect(page.getByRole("radio", { name: "20 gal" })).toHaveAttribute("aria-checked", "true");
    await click(page.getByRole("button", { name: "Start fill · 20 gal (simulated)" }));

    const hero = page.getByLabel("Fill result");
    await expect(hero).toContainText(scenario.eyebrow);
    await expect(hero.getByRole("heading")).toHaveText(scenario.headline);
    if (scenario.name.startsWith("B")) await expect(hero).toContainText("the $0.17/gal above that came from your wallet");
    expect(await hero.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe(scenario.coral ? "rgb(255, 92, 72)" : "rgb(11, 27, 43)");
    const breakdown = page.getByLabel("Fill breakdown");
    for (const row of scenario.rows) await expect(breakdown).toContainText(row);
    for (const row of scenario.absent) await expect(breakdown).not.toContainText(row);

    await click(page.getByRole("button", { name: "Share my win" }));
    await expect(page.getByRole("button", { name: "Link copied · share it anywhere" })).toBeVisible();
    await click(page.getByRole("button", { name: "Done" }));
    await expect(page.getByRole("heading", { name: "Your fuel is capped" })).toBeVisible();
    await expect(page.getByTestId("wallet-balance")).toHaveText(scenario.wallet);
    await expect(page.getByText("$18.38 held for it")).toBeVisible();
    await expect(page.getByText("Saved with FuelCap so far")).toBeVisible();
    await expect(page.getByTestId("savings-total")).toHaveText(scenario.saved);
    await expect(page.getByText("5 gal at Shell Downtown")).toBeVisible();
  });
}

test("first use: four tabs, one verb, honest empty states, account details", async ({ page }, testInfo) => {
  const click = clicker(page, testInfo.project.name);
  await mockSupabase(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Cap your fuel price. Never overpay." })).toBeVisible();
  await expect(page.getByTestId("demo-pill")).toHaveText("DEMO · US $");
  await expect(page.getByRole("navigation", { name: "Primary navigation" }).getByRole("button")).toHaveText(["Home", "Protect", "Pay", "Activity"]);
  for (const retired of ["Lock price", "Add fuel", "Choose fuel protection", "Confirm lock", "Price protection service", "Saved with FuelCap", "Your advantage"]) {
    await expect(page.getByText(retired, { exact: false })).toHaveCount(0);
  }
  await expect(page.getByRole("complementary", { name: "Presenter controls" })).toHaveCount(0);
  expect(await noHorizontalOverflow(page)).toBe(true);

  await click(tab(page, "Pay"));
  await expect(page.getByText("Nothing protected yet")).toBeVisible();
  await expect(page.locator('path[shape-rendering="crispEdges"]')).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Start fill/ })).toHaveCount(0);

  await click(tab(page, "Activity"));
  await expect(page.getByText("No activity yet. Your first protection will show here.")).toBeVisible();

  await click(page.getByRole("button", { name: "Account and settings" }));
  await expect(page.getByRole("heading", { name: "Account" })).toBeVisible();
  await expect(page.getByText("Standard · 7-day cap · Free")).toBeVisible();
  await expect(page.getByText("Visa ending 4242")).toBeVisible();
  await expect(page.getByText("On · 48h notice")).toBeVisible();

  if (testInfo.project.name === "customer-mobile") {
    await page.setViewportSize({ width: 375, height: 812 });
    const header = [page.getByTestId("demo-pill"), page.getByRole("button", { name: "Account and settings" })];
    const boxes = await Promise.all(header.map(async (item) => (await item.boundingBox())!));
    expect(boxes[1].x).toBeGreaterThanOrEqual(boxes[0].x + boxes[0].width);
    expect(boxes[1].x + boxes[1].width).toBeLessThanOrEqual(375);
    expect(await noHorizontalOverflow(page)).toBe(true);
  }
});

test("protect more keeps the cap, and everything survives a refresh", async ({ page }, testInfo) => {
  const click = clicker(page, testInfo.project.name);
  await mockSupabase(page);
  await page.goto("/");
  await protect25(page, click);
  await click(page.getByRole("button", { name: "Back to home" }));
  await expect(page.getByTestId("headline-unit-price")).toContainText("$3.68");
  await expect(page.getByText("Pump is below your cap")).toBeVisible();
  await expect(page.getByText("You pay $3.50")).toBeVisible();

  await click(page.getByRole("button", { name: "Protect more" }));
  await expect(page.getByText("Adding to your Shell Downtown protection, same cap.")).toBeVisible();
  await expect(page.getByRole("radio", { name: /Shell Downtown/ })).toHaveCount(0);
  await click(page.getByRole("radio", { name: "10 gal" }));
  await expect(summary(page)).toContainText("Same cap as your protection");
  await expect(summary(page)).toContainText("$36.75");
  await expect(summary(page)).toContainText("$37.56");
  await click(page.getByRole("button", { name: "Add $100.00 & protect 10 gal" }));
  await expect(page.getByRole("heading", { name: "35 gal protected" })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: "Your fuel is capped" })).toBeVisible();
  await expect(page.getByText("35 gal at Shell Downtown")).toBeVisible();
  await expect(page.getByTestId("wallet-balance")).toHaveText("$68.55");
  await click(tab(page, "Activity"));
  await expect(page.getByText("Protected 10 gal · Shell Downtown")).toBeVisible();
  await expect(page.getByText("Protected 25 gal · Shell Downtown")).toBeVisible();
  await expect(page.getByText("Added funds")).toHaveCount(2);
});

test("changing country opens a separate wallet in that currency", async ({ page }, testInfo) => {
  const click = clicker(page, testInfo.project.name);
  await mockSupabase(page);
  await page.goto("/");
  await protect25(page, click);

  await click(page.getByRole("button", { name: "Account and settings" }));
  await page.getByLabel("Country").selectOption("GB");
  await expect(page.getByTestId("demo-pill")).toHaveText("DEMO · UK £");
  await click(tab(page, "Home"));
  await expect(page.getByRole("heading", { name: "Cap your fuel price. Never overpay." })).toBeVisible();
  // UK demo stations 1.419…1.479: the typical (median) price is £1.44.
  await expect(page.getByText("Typical across 6 stations")).toBeVisible();
  await expect(page.getByTestId("headline-unit-price")).toContainText("£1.44");
  await expect(page.getByTestId("wallet-balance")).toHaveText("£0.00");
  await click(tab(page, "Pay"));
  await expect(page.getByText("Nothing protected yet")).toBeVisible();

  await click(page.getByRole("button", { name: "Account and settings" }));
  await page.getByLabel("Country").selectOption("US");
  await click(tab(page, "Home"));
  await expect(page.getByText("25 gal at Shell Downtown")).toBeVisible();
  await expect(page.getByTestId("wallet-balance")).toHaveText("$6.11");
});

test("onboarding keeps the market and isn't offered again", async ({ page }, testInfo) => {
  const click = clicker(page, testInfo.project.name);
  await mockSupabase(page);
  await page.goto("/");
  await click(page.getByRole("button", { name: "Create your profile" }));
  await expect(page.getByRole("heading", { name: "Choose how you use FuelCap" })).toBeVisible();
  await click(page.getByRole("button", { name: "Continue to identity check" }));
  await page.getByLabel("Driving licence photo").setInputFiles({ name: "licence.jpg", mimeType: "image/jpeg", buffer: Buffer.from("demo-licence") });
  await click(page.getByRole("button", { name: "Submit for verification" }));
  await expect(page.getByText("Identity verified")).toBeVisible({ timeout: 5_000 });
  await page.getByLabel("Card PIN").fill("2048");
  await click(page.getByRole("button", { name: "Open my wallet" }));
  await expect(page.getByRole("heading", { name: "Cap your fuel price. Never overpay." })).toBeVisible();
  await expect(page.getByTestId("demo-pill")).toHaveText("DEMO · US $");
  await expect(page.getByRole("button", { name: "Create your profile" })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Cap your fuel price. Never overpay." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Create your profile" })).toHaveCount(0);
});

test("presenter controls appear only with ?demo=1, and their pump price only applies there", async ({ page }, testInfo) => {
  const click = clicker(page, testInfo.project.name);
  const mobile = testInfo.project.name === "customer-mobile";
  await mockSupabase(page);
  const panel = page.getByRole("complementary", { name: "Presenter controls" });
  const opener = page.getByRole("button", { name: "Open presenter controls" });

  await page.goto("/");
  await expect(page.getByTestId("headline-unit-price")).toContainText("$3.50");
  await page.keyboard.press("Control+.");
  await expect(panel).toHaveCount(0);
  await expect(opener).toHaveCount(0);

  await page.goto("/?demo=1");
  await expect(mobile ? opener : panel).toBeVisible();
  await setPresenterPump(page, click, /Price rises/, mobile);
  await expect(page.getByTestId("headline-unit-price")).toContainText("$3.90");

  // Same browser, no ?demo=1: no controls, and the presenter's price no longer moves the pump.
  await page.goto("/");
  await expect(page.getByTestId("headline-unit-price")).toContainText("$3.50");
  await expect(panel).toHaveCount(0);
  await expect(opener).toHaveCount(0);

  await page.goto("/?demo=1");
  await expect(page.getByTestId("headline-unit-price")).toContainText("$3.90");
});

test("account authentication dialog is reachable", async ({ page }, testInfo) => {
  const click = clicker(page, testInfo.project.name);
  await mockSupabase(page);
  await page.goto("/");
  await click(page.getByRole("button", { name: "Account and settings" }));
  await click(page.getByRole("button", { name: "Create account or sign in" }));
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
});
