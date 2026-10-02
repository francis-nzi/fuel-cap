/**
 * Control-room sign-in configuration. Everything here is server-side: the admin app never ships a
 * Supabase key to the browser. If any value is missing, the proxy fails closed (every page and API
 * route except /api/health returns 503).
 */
export type AuthConfig = Readonly<{
  url: string;
  anonKey: string;
  serviceRoleKey: string;
  sessionSecret: string;
  siteUrl: string;
  secureCookies: boolean;
}>;

export const IDLE_TIMEOUT_MS = 30 * 60_000;
export const STEP_UP_WINDOW_SECONDS = 5 * 60;
export const IDLE_COOKIE = "fc_admin_idle";
export const STEP_UP_COOKIE = "fc_admin_stepup";
export const MFA_ISSUER = "FuelCap Control Room";

export function authConfig(): AuthConfig | null {
  const url = process.env.ADMIN_SUPABASE_URL;
  const anonKey = process.env.ADMIN_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.ADMIN_SUPABASE_SERVICE_ROLE_KEY;
  const sessionSecret = process.env.ADMIN_SESSION_SECRET;
  const siteUrl = process.env.ADMIN_SITE_URL ?? "http://127.0.0.1:3001";
  if (!url || !anonKey || !serviceRoleKey || !sessionSecret || sessionSecret.length < 32) return null;
  return { url, anonKey, serviceRoleKey, sessionSecret, siteUrl, secureCookies: siteUrl.startsWith("https://") };
}

/**
 * The in-memory staff/audit store exists only for the E2E suite. It needs two explicit flags and is
 * refused outright in production.
 */
export function usesMemoryStore() {
  return process.env.ADMIN_DATA_BACKEND === "memory" && process.env.ADMIN_E2E === "true" && process.env.NEXT_PUBLIC_APP_ENV !== "production";
}

export function authzEnvironment(): "demo" | "staging" | "production" {
  const value = process.env.NEXT_PUBLIC_APP_ENV;
  return value === "production" || value === "staging" ? value : "demo";
}
