import { expect, test, type Locator, type Page } from "@playwright/test";

// Customer app: DEC-065 funding model (REQ-003), location and the station map. Runs against the E2E build:
// Supabase is mocked and customer-lifecycle writes stay in the local in-memory store.

async function mockSupabase(page: Page) {
  await page.route("http://127.0.0.1:54321/**", (route) => {
    const isUserLookup = new URL(route.request().url()).pathname.endsWith("/auth/v1/user");
    return route.fulfill({ status: isUserLookup ? 401 : 200, contentType: "application/json", body: isUserLookup ? JSON.stringify({ message: "Not authenticated" }) : "[]" });
  });
  // Geocoding is deterministic in tests: one known ZIP, one known UK postcode, everything else not found.
  await page.route("**/api/geocode**", (route) => {
    const url = new URL(route.request().url());
    const q = (url.searchParams.get("q") ?? "").toUpperCase();
    if (!q) return route.fulfill({ json: { country: "US" } });
    if (q === "78704") return route.fulfill({ json: { latitude: 30.2448, longitude: -97.727, label: "78704, Austin" } });
    if (q === "SW11") return route.fulfill({ json: { latitude: 51.4640, longitude: -0.1680, label: "SW11, Wandsworth" } });
    return route.fulfill({ status: 404, json: { error: "NOT_FOUND" } });
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

const tab = (page: Page, name: "Home" | "Add money" | "Pay" | "Activity") => page.getByRole("navigation", { name: "Primary navigation" }).getByRole("button", { name, exact: true });
const noHorizontalOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

/** Basic plan, $3.50 station, usual 10 gal/week: 7-day window limited to 9.2 gal by the 150 L/month plan limit. */
async function add100(page: Page, click: (locator: Locator) => Promise<void>) {
  await click(page.getByRole("button", { name: "Add money to start" }));
  await expect(page.getByRole("heading", { name: "Add money" })).toBeVisible();
  await expect(page.getByRole("radio", { name: "$100" })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByTestId("protect-preview")).toContainText("We'll protect 9.2 gal at max $3.68/gal for 7 days. Protection charge $1.13");
  await click(page.getByRole("button", { name: "Add $100.00" }));
  await expect(page.getByRole("heading", { name: "$100.00 added" })).toBeVisible();
}

async function setPresenterPump(page: Page, click: (locator: Locator) => Promise<void>, label: RegExp, mobile: boolean) {
  if (mobile) await click(page.getByRole("button", { name: "Open presenter controls" }));
  await click(page.getByRole("radio", { name: label }).last());
  if (mobile) await click(page.getByRole("button", { name: "Close presenter controls" }));
}

async function expectActivityMatchesHome(page: Page, click: (locator: Locator) => Promise<void>) {
  await click(tab(page, "Home"));
  const home = await page.getByTestId("balance").innerText();
  await click(tab(page, "Activity"));
  await expect(page.getByTestId("activity-balance").first()).toHaveText(home);
  return home;
}

// 5 gal fill against a 9.2 gal protection at cap $3.675 (Basic charge 3.50% = $0.1225/gal → $1.13).
const cases = [
  { name: "rise to $3.90", pump: /Price rises/, eyebrow: "PRICE ROSE · HEADS YOU WIN", headline: "FuelCap covered $1.13", rows: ["Pump total (5 × $3.90)$19.50", "Paid from your balance$18.38", "Paid by FuelCap$1.13"], balance: "$80.49" },
  { name: "spike to $4.20", pump: /Spike past limit/, eyebrow: "PRICE SPIKED PAST YOUR LIMIT", headline: "FuelCap covered $1.75", rows: ["Pump total (5 × $4.20)$21.00", "Paid from your balance$19.26", "Paid by FuelCap$1.75"], balance: "$79.61" },
  { name: "fall to $3.40", pump: /Price falls/, eyebrow: "PRICE DROPPED · TAILS YOU WIN", headline: "You paid $1.38 less than your cap · $0.50 less than today's price", rows: ["Pump total (5 × $3.40)$17.00", "Paid from your balance$17.00", "Less than your cap$1.38", "Saved vs today's $3.50$0.50"], balance: "$81.87" },
];

for (const scenario of cases) {
  test(`add $100, auto-protect, fill 5 gal: ${scenario.name}`, async ({ page }, testInfo) => {
    const click = clicker(page, testInfo.project.name);
    const mobile = testInfo.project.name === "customer-mobile";
    await mockSupabase(page);
    await page.goto("/?demo=1");
    await expect(page.getByTestId("headline-unit-price")).toContainText("$3.50");
    await expect(page.getByText("protect your usual fuel at a max of $3.68/gal for 7 days", { exact: false })).toBeVisible();
    await add100(page, click);
    await expect(page.getByText("9.2 gal protected. You'll never pay more than $3.68/gal at Shell Downtown until", { exact: false })).toBeVisible();
    await expect(page.getByText("Balance $98.87 · $65.06 free to spend")).toBeVisible();

    await setPresenterPump(page, click, scenario.pump, mobile);
    await click(page.getByRole("button", { name: "Pay at pump now" }));
    await expect(page.getByRole("radio", { name: "5 gal" })).toHaveAttribute("aria-checked", "true");
    await click(page.getByRole("button", { name: "Start fill · 5 gal (simulated)" }));

    const hero = page.getByLabel("Fill result");
    await expect(hero).toContainText(scenario.eyebrow);
    await expect(hero.getByRole("heading")).toHaveText(scenario.headline);
    const breakdown = page.getByLabel("Fill breakdown");
    for (const row of scenario.rows) await expect(breakdown).toContainText(row);
    await click(page.getByRole("button", { name: "Share my win" }));
    await expect(page.getByRole("button", { name: "Link copied · share it anywhere" })).toBeVisible();
    await click(page.getByRole("button", { name: "Done" }));

    await expect(page.getByTestId("balance")).toHaveText(scenario.balance);
    await expect(page.getByTestId("protected-line")).toContainText("4.2 gal protected at max $3.68/gal until");
    expect(await expectActivityMatchesHome(page, click)).toBe(scenario.balance);
  });
}

test("REQ-003 worked example in the UK: Activity shows a running balance that ends at the Home balance", async ({ page }, testInfo) => {
  const click = clicker(page, testInfo.project.name);
  await mockSupabase(page);
  await page.goto("/");
  await click(page.getByRole("button", { name: "Account and settings" }));
  await page.getByLabel("Country").selectOption("GB");
  await expect(page.getByTestId("demo-pill")).toHaveText("DEMO · UK £");
  await expect(page.getByRole("radio", { name: "40 L" })).toHaveAttribute("aria-checked", "true");
  await click(tab(page, "Home"));
  await click(page.getByRole("button", { name: /Your station/ }));
  await page.getByPlaceholder("Postcode or town").fill("Fulham");
  await click(page.getByRole("radio", { name: /Shell Fulham/ }));
  await click(page.getByRole("button", { name: "Use Shell Fulham" }));
  await click(page.getByRole("button", { name: "Add money to start" }));
  await click(page.getByRole("button", { name: "Add £100.00" }));
  await expect(page.getByRole("heading", { name: "£100.00 added" })).toBeVisible();
  await click(tab(page, "Activity"));
  const rows = page.getByTestId("activity-row");
  // Basic 150 L/month → 35 L for 7 days at max £1.49 (Shell Fulham £1.419): charge 35 × £0.0497 = £1.74.
  await expect(rows.nth(0)).toContainText("Protection charge");
  await expect(rows.nth(0)).toContainText("−£1.74");
  await expect(rows.nth(1)).toContainText("Protected 35 L at max £1.49/L");
  await expect(rows.nth(2)).toContainText("Added money");
  await expect(page.getByTestId("activity-balance")).toHaveText(["£98.26", "£100.00", "£100.00"]);
  await expectActivityMatchesHome(page, click);
});

test("first use: four tabs, honest empty states, plan prices in the market's currency", async ({ page }, testInfo) => {
  const click = clicker(page, testInfo.project.name);
  await mockSupabase(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Cap your fuel price. Never overpay." })).toBeVisible();
  await expect(page.getByTestId("demo-pill")).toHaveText("DEMO · US $");
  await expect(page.getByRole("navigation", { name: "Primary navigation" }).getByRole("button")).toHaveText(["Home", "Add money", "Pay", "Activity"]);
  await expect(page.getByTestId("your-station")).toHaveText("Shell Downtown");
  await expect(page.getByRole("complementary", { name: "Presenter controls" })).toHaveCount(0);
  expect(await noHorizontalOverflow(page)).toBe(true);

  await click(tab(page, "Pay"));
  await expect(page.getByText("Nothing protected yet")).toBeVisible();
  await click(tab(page, "Activity"));
  await expect(page.getByText("No activity yet. Money you add will show here.")).toBeVisible();

  await click(page.getByRole("button", { name: "Account and settings" }));
  await expect(page.getByRole("radio", { name: /Basic.*Free/ })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("radio", { name: /Standard.*\$4\.99/ })).toBeVisible();
  await expect(page.getByRole("radiogroup", { name: "Plan" })).not.toContainText("£");
  await expect(page.getByText("Visa ending 4242")).toBeVisible();
});

test("deposits never take the balance over the plan's wallet limit", async ({ page }, testInfo) => {
  const click = clicker(page, testInfo.project.name);
  await mockSupabase(page);
  await page.goto("/");
  await add100(page, click);
  await click(tab(page, "Add money"));
  await click(page.getByRole("radio", { name: "$200" }));
  await click(page.getByRole("button", { name: "Add $200.00" }));
  await click(tab(page, "Add money"));
  await expect(page.getByText("You can add up to $201.13 now.", { exact: false })).toBeVisible();
  await click(page.getByRole("radio", { name: "$200" }));
  await click(page.getByRole("button", { name: "Add $200.00" }));
  await click(tab(page, "Add money"));
  await expect(page.getByText("Your balance is at your Basic plan's limit of $500.00.")).toBeVisible();
  await expect(page.getByRole("button", { name: "At your plan's limit" })).toBeDisabled();
  await click(page.getByRole("button", { name: "Move to Standard: hold up to $1,500.00" }));
  await expect(page.getByRole("radio", { name: "$200" })).toBeEnabled();
  await click(tab(page, "Activity"));
  await expect(page.getByText("Standard plan fee, paid by card")).toBeVisible();
  await expect(page.getByTestId("activity-balance").first()).toHaveText("$498.87");
  await expectActivityMatchesHome(page, click);
});

test.describe("location and map", () => {
  test.use({ geolocation: { latitude: 30.2715, longitude: -97.7400 }, permissions: ["geolocation"] });

  test("uses the device location, searches a ZIP, and picks a station from the map", async ({ page }, testInfo) => {
    const click = clicker(page, testInfo.project.name);
    await mockSupabase(page);
    await page.goto("/");
    // Permission already granted: located quietly, nearest station chosen.
    await expect(page.getByTestId("your-station")).toHaveText("BP Central");
    await click(page.getByRole("button", { name: /Your station/ }));
    await expect(page.getByRole("heading", { name: "Choose your station" })).toBeVisible();
    await expect(page.getByTestId("station-origin")).toHaveText("Near you");
    const list = page.getByRole("radiogroup", { name: "Filling station" });
    await expect(list.getByRole("radio").first()).toContainText("BP Central");
    await expect(list.getByRole("radio").first()).toContainText("0.0 mi");

    await page.getByPlaceholder("ZIP or city").fill("78704");
    await expect(page.getByTestId("station-origin")).toHaveText("Near 78704, Austin");
    await expect(list.getByRole("radio").first()).toContainText("Shell Riverside");

    await click(page.getByRole("tab", { name: "Map" }));
    const pin = page.locator(".leaflet-marker-icon[title='Chevron Airport']");
    await expect(pin).toBeVisible({ timeout: 10_000 });
    await pin.click();
    await expect(page.getByLabel("Chosen station")).toContainText("Chevron Airport · $3.47");
    await expect(page.getByRole("link", { name: "Directions" })).toHaveAttribute("href", /google\.com\/maps\/dir\/\?api=1&destination=30\.2905,-97\.7076/);
    await click(page.getByRole("button", { name: "Use Chevron Airport" }));
    await expect(page.getByTestId("your-station")).toHaveText("Chevron Airport");
    await expect(page.getByTestId("headline-unit-price")).toContainText("$3.47");

    await page.reload();
    await expect(page.getByTestId("your-station")).toHaveText("Chevron Airport");
  });

  test("an unknown place says so instead of guessing", async ({ page }, testInfo) => {
    const click = clicker(page, testInfo.project.name);
    await mockSupabase(page);
    await page.goto("/");
    await click(page.getByRole("button", { name: /Your station/ }));
    await page.getByPlaceholder("ZIP or city").fill("Atlantis");
    await expect(page.getByText("We couldn't find “Atlantis” in the US.")).toBeVisible();
  });
});

test.describe("location refused", () => {
  test.use({ permissions: [] });
  test("a refused location falls back to the demo area with a clear message", async ({ page, context }, testInfo) => {
    const click = clicker(page, testInfo.project.name);
    await mockSupabase(page);
    await context.clearPermissions();
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "geolocation", { configurable: true, value: { getCurrentPosition: (_ok: unknown, fail: (error: { code: number }) => void) => fail({ code: 1 }) } });
    });
    await page.goto("/");
    await click(page.getByRole("button", { name: /Your station/ }));
    await click(page.getByRole("button", { name: "Use my location" }));
    await expect(page.getByText("Location is off for this site.", { exact: false })).toBeVisible();
    await expect(page.getByTestId("station-origin")).toHaveText("Demo area: Austin, TX");
  });
});

test("ending a window releases the money and auto-renews from the balance", async ({ page }, testInfo) => {
  const click = clicker(page, testInfo.project.name);
  const mobile = testInfo.project.name === "customer-mobile";
  await mockSupabase(page);
  await page.goto("/?demo=1");
  await add100(page, click);
  if (mobile) await click(page.getByRole("button", { name: "Open presenter controls" }));
  await click(page.getByRole("button", { name: "End this window (auto-renew)" }));
  if (mobile) await click(page.getByRole("button", { name: "Close presenter controls" }));
  await click(tab(page, "Activity"));
  const rows = page.getByTestId("activity-row");
  await expect(rows.nth(0)).toContainText("Protection charge");
  await expect(rows.nth(1)).toContainText("Renewed 9.2 gal at max $3.68/gal");
  await expect(rows.nth(2)).toContainText("Protection window ended");
  await expect(page.getByTestId("activity-balance").first()).toHaveText("$97.74");
  await expectActivityMatchesHome(page, click);
});

test("onboarding asks for usual weekly fuel and isn't offered again", async ({ page }, testInfo) => {
  const click = clicker(page, testInfo.project.name);
  await mockSupabase(page);
  await page.goto("/");
  await click(page.getByRole("button", { name: "Create your profile" }));
  await expect(page.getByRole("heading", { name: "Choose how you use FuelCap" })).toBeVisible();
  await click(page.getByRole("radio", { name: "15 gal" }));
  await click(page.getByRole("button", { name: "Fill with demo details" }));
  await click(page.getByRole("button", { name: "Continue to identity check" }));
  await page.getByLabel("Driving licence photo").setInputFiles({ name: "licence.jpg", mimeType: "image/jpeg", buffer: Buffer.from("demo-licence") });
  await click(page.getByRole("button", { name: "Submit for verification" }));
  await expect(page.getByText("Identity verified")).toBeVisible({ timeout: 5_000 });
  await page.getByLabel("Card PIN").fill("2048");
  await click(page.getByRole("button", { name: "Open my wallet" }));
  await expect(page.getByText("Hi Francis")).toBeVisible();
  await expect(page.getByRole("button", { name: "Create your profile" })).toHaveCount(0);
  await click(page.getByRole("button", { name: "Account and settings" }));
  await expect(page.getByRole("radio", { name: "15 gal" })).toHaveAttribute("aria-checked", "true");
  await page.reload();
  await expect(page.getByText("Hi Francis")).toBeVisible();
});

test("presenter controls appear only with ?demo=1, and their pump price only applies there", async ({ page }, testInfo) => {
  const click = clicker(page, testInfo.project.name);
  const mobile = testInfo.project.name === "customer-mobile";
  await mockSupabase(page);
  const panel = page.getByRole("complementary", { name: "Presenter controls" });
  const opener = page.getByRole("button", { name: "Open presenter controls" });
  await page.goto("/");
  await expect(page.getByTestId("headline-unit-price")).toContainText("$3.50");
  await expect(panel).toHaveCount(0);
  await expect(opener).toHaveCount(0);
  await page.goto("/?demo=1");
  await expect(mobile ? opener : panel).toBeVisible();
  await setPresenterPump(page, click, /Price rises/, mobile);
  await expect(page.getByTestId("headline-unit-price")).toContainText("$3.90");
  await page.goto("/");
  await expect(page.getByTestId("headline-unit-price")).toContainText("$3.50");
});

test("account authentication dialog is reachable", async ({ page }, testInfo) => {
  const click = clicker(page, testInfo.project.name);
  await mockSupabase(page);
  await page.goto("/");
  await click(page.getByRole("button", { name: "Account and settings" }));
  await click(page.getByRole("button", { name: "Create account or sign in" }));
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});
