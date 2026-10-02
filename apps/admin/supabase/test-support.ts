import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

export const ADMIN_MIGRATION = path.join(__dirname, "migrations", "202609280001_admin_auth.sql");
export const CUSTOMER_MIGRATIONS_DIR = path.resolve(__dirname, "../../../supabase/migrations");

/**
 * An in-process Postgres that behaves like a Supabase project for these tests: the anon / authenticated /
 * service_role roles, an `auth` schema with users + uid() + jwt() driven by request.jwt.claims, and Supabase's
 * default privileges (every new table in `public` is fully granted to anon and authenticated).
 */
export async function supabaseLikeDatabase() {
  const db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create schema auth;
    grant usage on schema auth, public to anon, authenticated, service_role;
    create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}'::jsonb);
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(auth.jwt() ->> 'sub', '')::uuid $$;
    grant execute on all functions in schema auth to anon, authenticated, service_role;
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
    alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  `);
  return db;
}

export const customerMigrations = () => readdirSync(CUSTOMER_MIGRATIONS_DIR).filter((name) => name.endsWith(".sql")).sort().map((name) => ({ name, sql: readFileSync(path.join(CUSTOMER_MIGRATIONS_DIR, name), "utf8") }));
export const adminMigration = () => readFileSync(ADMIN_MIGRATION, "utf8");

/** Runs `run` as a signed-in user with these JWT claims (or as anon when null), then rolls back. */
export async function as<T>(db: PGlite, claims: Record<string, unknown> | null, run: () => Promise<T>) {
  await db.exec("begin");
  try {
    await db.query("select set_config('request.jwt.claims', $1, true)", [claims ? JSON.stringify(claims) : ""]);
    await db.exec(`set local role ${claims ? "authenticated" : "anon"}`);
    return await run();
  } finally {
    await db.exec("rollback");
  }
}
