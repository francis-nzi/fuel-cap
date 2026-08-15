import "server-only";

/**
 * Minimal Supabase (PostgREST) client using `fetch` — no SDK dependency, so it
 * works in any Next.js runtime including serverless/edge. Reads the service-role
 * key, so this file must only ever be imported on the server.
 *
 * Configure by setting, in the environment:
 *   SUPABASE_URL          e.g. https://xxxx.supabase.co
 *   SUPABASE_SECRET_KEY   a server-only secret key. Accepts either the new
 *                         `sb_secret_...` key (Project Settings → API Keys →
 *                         Secret keys) or the legacy `service_role` JWT. Both
 *                         bypass RLS, so keep this server-side only.
 *
 * For backwards compatibility the legacy var name SUPABASE_SERVICE_ROLE_KEY is
 * still read if SUPABASE_SECRET_KEY is not set.
 *
 * When these are absent, `supabaseConfigured()` returns false and the app falls
 * back to the local file store (see store.ts).
 */

const URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const KEY =
  process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export function supabaseConfigured(): boolean {
  return Boolean(URL && KEY);
}

function restUrl(table: string, query = ""): string {
  const base = `${URL.replace(/\/$/, "")}/rest/v1/${table}`;
  return query ? `${base}?${query}` : base;
}

function headers(extra: Record<string, string> = {}): Record<string, string> {
  return {
    apikey: KEY,
    Authorization: `Bearer ${KEY}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

export async function sbSelect<T>(table: string, query: string): Promise<T[]> {
  const res = await fetch(restUrl(table, query), {
    headers: headers(),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Supabase select ${table} failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as T[];
}

/** Insert one or more rows. Returns the inserted rows. */
export async function sbInsert<T>(table: string, rows: unknown): Promise<T[]> {
  const res = await fetch(restUrl(table), {
    method: "POST",
    headers: headers({ Prefer: "return=representation" }),
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    throw new Error(`Supabase insert ${table} failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as T[];
}

/** Upsert (insert or merge) on a conflict column. Returns the resulting rows. */
export async function sbUpsert<T>(
  table: string,
  rows: unknown,
  onConflict: string
): Promise<T[]> {
  const res = await fetch(restUrl(table, `on_conflict=${onConflict}`), {
    method: "POST",
    headers: headers({ Prefer: "resolution=merge-duplicates,return=representation" }),
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    throw new Error(`Supabase upsert ${table} failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as T[];
}
