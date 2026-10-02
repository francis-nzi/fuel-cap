import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { AuthConfig } from "./config";

/** Session cookies are httpOnly: the admin app never runs a browser Supabase client, so scripts can't read tokens. */
export const sessionCookieOptions = (config: AuthConfig) => ({ httpOnly: true, sameSite: "lax" as const, secure: config.secureCookies, path: "/" });

/** Per-request client for route handlers and server components, reading and writing the session cookies. */
export async function createRouteClient(config: AuthConfig) {
  const store = await cookies();
  return createServerClient(config.url, config.anonKey, {
    cookieOptions: sessionCookieOptions(config),
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, { ...options, ...sessionCookieOptions(config) }));
        } catch {
          // Server components can't set cookies; the proxy refreshes the session on the next request.
        }
      },
    },
  });
}

/** Service-role client: invites staff and writes audit records. Never exposed to the browser. */
export function createServiceClient(config: AuthConfig) {
  return createClient(config.url, config.serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** A client that acts as the signed-in user, so Postgres row-level security (aal2) applies to its reads. */
export function createUserClient(config: AuthConfig, accessToken: string) {
  return createClient(config.url, config.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}
