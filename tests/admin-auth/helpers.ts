import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, type Page } from "@playwright/test";
import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import { ADMIN_SEED, ADMIN_SESSION_SECRET, MOCK_AUTH_URL } from "./env";

type SeedUser = { id: string; email: string; password: string; name: string; roles: string[]; totpSecret?: string };
const seed = JSON.parse(readFileSync(ADMIN_SEED, "utf8")) as { users: SeedUser[] };
const byEmail = (email: string) => seed.users.find((user) => user.email === email)!;
export const staff = {
  presenter: byEmail("presenter@fuelcap.test"),
  risk: byEmail("risk@fuelcap.test"),
  admin: byEmail("admin@fuelcap.test"),
  outsider: byEmail("outsider@fuelcap.test"),
};

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function base32Decode(text: string) {
  let bits = "";
  for (const char of text.toUpperCase()) bits += BASE32.indexOf(char).toString(2).padStart(5, "0");
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}
export function totp(secret: string, at = Date.now()) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 1000 / 30)));
  const hmac = createHmac("sha1", base32Decode(secret)).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  return String((hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, "0");
}
/** A current code that won't roll over mid-request. */
export async function freshCode(secret: string) {
  const secondsLeft = 30 - (Math.floor(Date.now() / 1000) % 30);
  if (secondsLeft < 3) await new Promise((resolve) => setTimeout(resolve, (secondsLeft + 0.5) * 1000));
  return totp(secret);
}
/** A code that is certainly wrong for this secret right now. */
export const wrongCode = (secret: string) => String((Number(totp(secret)) + 500_000) % 1_000_000).padStart(6, "0");

export async function passwordStep(page: Page, user: { email: string; password: string }) {
  await page.goto("/login", { waitUntil: "networkidle" });
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

export async function signIn(page: Page, user: SeedUser) {
  await passwordStep(page, user);
  await page.waitForURL("**/mfa");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("6-digit code").fill(await freshCode(user.totpSecret!));
  await page.getByRole("button", { name: "Verify" }).click();
  await page.waitForURL((url) => url.pathname === "/");
  await expect(page.getByRole("group", { name: "Signed-in account" })).toBeVisible();
}

export async function enterStepUpCode(page: Page, secret: string) {
  const dialog = page.getByRole("dialog", { name: "Confirm it's you" });
  // Generous: the dev server may compile the protected route on first use.
  await expect(dialog).toBeVisible({ timeout: 20_000 });
  await dialog.getByLabel("Authenticator code").fill(await freshCode(secret));
  await dialog.getByRole("button", { name: "Confirm" }).click();
  await expect(dialog).toBeHidden();
}

export const resetMockAuth = () => fetch(`${MOCK_AUTH_URL}/auth/v1/__test/reset`, { method: "POST" });
/**
 * The link in the latest invite or password-reset email, built the way the shared project's email templates build
 * staff links (docs/ADMIN_AUTH.md): {{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=... So it only opens the
 * control room if the app asked Supabase to redirect there.
 */
export async function emailLink(email: string, type: "invite" | "recovery" = "invite") {
  const response = await fetch(`${MOCK_AUTH_URL}/auth/v1/__test/email-link?email=${encodeURIComponent(email)}&type=${type}`);
  const body = await response.json() as { token_hash: string; type: string; redirect_to: string };
  return `${body.redirect_to}?token_hash=${body.token_hash}&type=${body.type}`;
}
export const inviteLink = (email: string) => emailLink(email, "invite");

/** Signs up through Supabase exactly as the customer app does (public sign-up is on in the shared project). */
export async function signUpAsCustomer(email: string, password: string) {
  const supabase = createClient(MOCK_AUTH_URL, "mock-anon-key", { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await supabase.auth.signUp({ email, password, options: { data: { display_name: email.split("@")[0] }, emailRedirectTo: "http://127.0.0.1:3000/auth/callback" } });
  if (error) throw error;
  return supabase;
}

/** Turns on an authenticator for a signed-in client and passes MFA, giving an aal2 session (as any account can). */
export async function passMfaDirectly(supabase: SupabaseClient) {
  const { data: factor, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "Phone" });
  if (error) throw error;
  const verified = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code: await freshCode(factor.totp.secret) });
  if (verified.error) throw verified.error;
  const { data } = await supabase.auth.getSession();
  return data.session!;
}

const signedCookie = (payload: unknown) => {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${createHmac("sha256", ADMIN_SESSION_SECRET).update(body).digest("base64url")}`;
};
const sessionIdOf = (accessToken: string) => (JSON.parse(Buffer.from(accessToken.split(".")[1], "base64url").toString("utf8")) as { session_id: string }).session_id;

/**
 * Puts a Supabase session straight into this browser's control-room cookies (the @supabase/ssr format), with a live
 * idle clock: the worst case of someone holding a valid session and getting past the proxy's own checks.
 */
export async function plantSession(page: Page, session: Session, baseURL: string) {
  const value = `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`;
  const chunks = value.match(/.{1,3000}/g)!;
  const name = "sb-127-auth-token";
  await page.context().addCookies([
    ...(chunks.length === 1 ? [{ name, value }] : chunks.map((chunk, index) => ({ name: `${name}.${index}`, value: chunk }))),
    { name: "fc_admin_idle", value: signedCookie({ sid: sessionIdOf(session.access_token), last: Date.now() }) },
  ].map((cookie) => ({ ...cookie, url: baseURL, httpOnly: true, sameSite: "Lax" as const })));
}

/** Rewinds this browser's idle clock by `minutes` (signed with the test secret) to simulate inactivity. */
export async function rewindIdleClock(page: Page, minutes: number) {
  const cookies = await page.context().cookies();
  const sessionChunks = cookies.filter((cookie) => /^sb-.*-auth-token(\.\d+)?$/.test(cookie.name)).sort((a, b) => a.name.localeCompare(b.name));
  const raw = sessionChunks.map((cookie) => cookie.value).join("");
  const session = JSON.parse(Buffer.from(raw.replace(/^base64-/, ""), "base64url").toString("utf8")) as { access_token: string };
  const idle = cookies.find((cookie) => cookie.name === "fc_admin_idle")!;
  await page.context().addCookies([{ ...idle, value: signedCookie({ sid: sessionIdOf(session.access_token), last: Date.now() - minutes * 60_000 }) }]);
}
