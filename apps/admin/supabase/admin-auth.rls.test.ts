import { readFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Runs the real migration in an in-process Postgres (PGlite) with a stand-in for Supabase's auth schema,
// then checks the row-level-security rules as the `authenticated` role with aal1 and aal2 JWT claims.

const PA = "00000000-0000-0000-0000-00000000000a";
const RT = "00000000-0000-0000-0000-00000000000b";
const AU = "00000000-0000-0000-0000-00000000000c";
let db: PGlite;

async function as<T>(claims: Record<string, unknown> | null, run: () => Promise<T>) {
  await db.exec("begin");
  try {
    await db.query("select set_config('request.jwt.claims', $1, true)", [claims ? JSON.stringify(claims) : ""]);
    await db.exec(`set local role ${claims ? "authenticated" : "anon"}`);
    return await run();
  } finally {
    await db.exec("rollback");
  }
}
const staffRows = async () => (await db.query<{ user_id: string }>("select user_id from public.admin_staff order by user_id")).rows.map((row) => row.user_id);

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create schema auth;
    grant usage on schema auth, public to anon, authenticated, service_role;
    create table auth.users (id uuid primary key);
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(auth.jwt() ->> 'sub', '')::uuid $$;
    grant execute on all functions in schema auth to anon, authenticated, service_role;
  `);
  await db.exec(readFileSync(path.join(__dirname, "migrations", "202609280001_admin_auth.sql"), "utf8"));
  await db.exec(`
    insert into auth.users values ('${PA}'), ('${RT}'), ('${AU}');
    insert into public.admin_staff (user_id, email, display_name, roles) values
      ('${PA}', 'pa@example.test', 'Pat Admin', array['PA','RT']),
      ('${RT}', 'rt@example.test', 'Riley Risk', array['RT']),
      ('${AU}', 'au@example.test', 'Ari Audit', array['AU']);
    insert into public.admin_audit_log (event, outcome, user_id) values ('SIGN_IN_SUCCEEDED', 'success', '${RT}');
  `);
});
afterAll(async () => { await db?.close(); });

describe("admin tables require an MFA-verified (aal2) session", () => {
  it("hides every staff row from a password-only (aal1) session, even the person's own", async () => {
    expect(await as({ sub: RT, aal: "aal1" }, staffRows)).toEqual([]);
    expect(await as({ sub: PA, aal: "aal1" }, staffRows)).toEqual([]);
  });

  it("shows staff their own record at aal2, and everyone's only to PA and AU", async () => {
    expect(await as({ sub: RT, aal: "aal2" }, staffRows)).toEqual([RT]);
    expect(await as({ sub: PA, aal: "aal2" }, staffRows)).toEqual([PA, RT, AU].sort());
    expect(await as({ sub: AU, aal: "aal2" }, staffRows)).toEqual([PA, RT, AU].sort());
  });

  it("opens the audit log only to PA/AU at aal2", async () => {
    const audit = async () => (await db.query("select id from public.admin_audit_log")).rows.length;
    expect(await as({ sub: PA, aal: "aal1" }, audit)).toBe(0);
    expect(await as({ sub: RT, aal: "aal2" }, audit)).toBe(0);
    expect(await as({ sub: PA, aal: "aal2" }, audit)).toBe(1);
  });

  it("refuses all writes from browsers, even an aal2 platform admin", async () => {
    await expect(as({ sub: PA, aal: "aal2" }, () => db.query("insert into public.admin_staff (user_id, email, display_name, roles) values ($1, 'x@example.test', 'X', array['PA'])", [RT]))).rejects.toThrow(/permission denied/);
    await expect(as({ sub: PA, aal: "aal2" }, () => db.query("update public.admin_staff set roles = array['PA'] where user_id = $1", [RT]))).rejects.toThrow(/permission denied/);
    await expect(as({ sub: PA, aal: "aal2" }, () => db.query("insert into public.admin_audit_log (event, outcome) values ('FORGED', 'success')"))).rejects.toThrow(/permission denied/);
  });

  it("gives anonymous callers nothing", async () => {
    await expect(as(null, staffRows)).rejects.toThrow(/permission denied/);
  });

  it("keeps the audit log append-only, even for the table owner", async () => {
    await expect(db.query("update public.admin_audit_log set outcome = 'denied'")).rejects.toThrow(/append-only/);
    await expect(db.query("delete from public.admin_audit_log")).rejects.toThrow(/append-only/);
  });

  it("rejects role combinations the authorisation policy forbids", async () => {
    const fresh = "00000000-0000-0000-0000-00000000000d";
    await db.query("insert into auth.users values ($1) on conflict do nothing", [fresh]);
    await expect(db.query("insert into public.admin_staff (user_id, email, display_name, roles) values ($1, 'y@example.test', 'Y', array['AU','RT'])", [fresh])).rejects.toThrow(/admin_staff_exclusive_roles/);
    await expect(db.query("insert into public.admin_staff (user_id, email, display_name, roles) values ($1, 'y@example.test', 'Y', array['DP','PA'])", [fresh])).rejects.toThrow(/admin_staff_exclusive_roles/);
  });
});
