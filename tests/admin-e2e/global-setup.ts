import { chromium, type FullConfig } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { resetMockAuth, signIn, staff } from "../admin-auth/helpers";

export const AUTH_DIR = path.resolve(__dirname, "../../test-results/.auth");
export const presenterState = path.join(AUTH_DIR, "presenter.json");
export const riskState = path.join(AUTH_DIR, "risk.json");

/** Signs in the presenter and the risk trader once (password + TOTP) and saves their sessions for the suite. */
export default async function globalSetup(config: FullConfig) {
  mkdirSync(AUTH_DIR, { recursive: true });
  await resetMockAuth();
  const baseURL = config.projects[0].use.baseURL ?? "http://127.0.0.1:3001";
  const browser = await chromium.launch();
  for (const [user, file] of [[staff.presenter, presenterState], [staff.risk, riskState]] as const) {
    const context = await browser.newContext({ baseURL });
    const page = await context.newPage();
    await signIn(page, user);
    await context.storageState({ path: file });
    await context.close();
  }
  await browser.close();
}
