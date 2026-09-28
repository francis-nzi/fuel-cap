import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminMigration, as, customerMigrations, supabaseLikeDatabase } from "./test-support";

// DEC-064: control-room sign-in shares the customer Supabase project. This runs the customer project's own
// migrations, then the admin migration, and checks the admin migration only ADDS admin_* objects: no existing
// table, column, function, database rule (policy), trigger, grant or type changes.

type Row = Record<string, unknown>;
async function catalogue(db: PGlite) {
  const query = async (sql: string) => new Set((await db.query<Row>(sql)).rows.map((row) => JSON.stringify(row)));
  return {
    tables: await query(`select n.nspname as schema, c.relname as name, c.relkind as kind, c.relrowsecurity as rls, c.relforcerowsecurity as force_rls
      from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname in ('public','auth') and c.relkind in ('r','v','m','S','p')`),
    columns: await query(`select table_schema as schema, table_name as table, column_name as name, data_type as type, column_default as default_value, is_nullable
      from information_schema.columns where table_schema in ('public','auth')`),
    functions: await query(`select n.nspname as schema, p.proname as name, pg_get_function_identity_arguments(p.oid) as args, md5(pg_get_functiondef(p.oid)) as body, p.prosecdef as security_definer, coalesce(array_to_string(p.proacl, ','), '') as acl
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public','auth')`),
    policies: await query(`select schemaname as schema, tablename as table, policyname as name, permissive, roles::text as roles, cmd, qual, with_check from pg_policies`),
    triggers: await query(`select tgrelid::regclass::text as relation, tgname as name, md5(pg_get_triggerdef(oid)) as definition from pg_trigger where not tgisinternal`),
    grants: await query(`select table_schema as schema, table_name as table, grantee, privilege_type as privilege from information_schema.role_table_grants where table_schema in ('public','auth')`),
    types: await query(`select n.nspname as schema, t.typname as name, t.typtype as kind from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'public' and t.typtype in ('e','d','c') and t.typrelid = 0`),
  };
}
type Catalogue = Awaited<ReturnType<typeof catalogue>>;
const added = (before: Set<string>, after: Set<string>) => [...after].filter((entry) => !before.has(entry)).map((entry) => JSON.parse(entry) as Row);
const removed = (before: Set<string>, after: Set<string>) => [...before].filter((entry) => !after.has(entry));
// The object an entry belongs to: tables/columns/grants/policies by table, functions by name, triggers by relation.
const owner = (row: Row) => String(row.table ?? row.relation ?? row.name ?? "");

let db: PGlite;
let before: Catalogue;
let after: Catalogue;

beforeAll(async () => {
  db = await supabaseLikeDatabase();
  for (const migration of customerMigrations()) await db.exec(migration.sql);
  before = await catalogue(db);
  await db.exec(adminMigration());
  after = await catalogue(db);
});
afterAll(async () => { await db?.close(); });

describe("admin migration in the shared customer project (DEC-064)", () => {
  it("runs on top of all the customer migrations", () => {
    expect(customerMigrations().map((migration) => migration.name)).toEqual([
      "202607240001_initial_schema.sql", "202607240002_demo_operations.sql", "202607240003_scoped_pricing.sql", "202609020001_fuel_finder_ingestion.sql",
    ]);
    expect([...after.tables].some((entry) => entry.includes("\"admin_staff\""))).toBe(true);
    // The "before" snapshot really holds the customer schema, so the comparisons below mean something.
    const tableNames = [...before.tables].map((entry) => (JSON.parse(entry) as Row).name);
    for (const table of ["profiles", "price_locks", "transactions", "stations", "cap_quotes", "pricing_ingestion_runs"]) expect(tableNames).toContain(table);
    expect(before.policies.size).toBeGreaterThanOrEqual(9);
    expect([...before.triggers].some((entry) => entry.includes("on_auth_user_created"))).toBe(true);
  });

  it("changes or removes nothing that already existed", () => {
    for (const key of Object.keys(before) as (keyof Catalogue)[]) expect(removed(before[key], after[key]), key).toEqual([]);
  });

  it("only adds admin_* tables, functions, rules, triggers and grants", () => {
    for (const key of Object.keys(before) as (keyof Catalogue)[]) {
      for (const row of added(before[key], after[key])) expect(owner(row).replace(/^public\./, ""), `${key}: ${JSON.stringify(row)}`).toMatch(/^admin_/);
    }
    expect(added(before.tables, after.tables).map((row) => row.name).sort()).toEqual(["admin_audit_log", "admin_audit_log_id_seq", "admin_staff"]);
    expect(added(before.types, after.types)).toEqual([]);
  });

  it("can be run again without changing anything", async () => {
    await db.exec(adminMigration());
    const again = await catalogue(db);
    for (const key of Object.keys(after) as (keyof Catalogue)[]) {
      expect(added(after[key], again[key]), key).toEqual([]);
      expect(removed(after[key], again[key]), key).toEqual([]);
    }
  });

  it("strips Supabase's default table grants from the admin tables (select only, for signed-in users)", () => {
    const adminGrants = [...after.grants].map((entry) => JSON.parse(entry) as Row).filter((row) => String(row.table).startsWith("admin_") && (row.grantee === "anon" || row.grantee === "authenticated"));
    expect(adminGrants.map((row) => `${row.table}:${row.grantee}:${row.privilege}`).sort()).toEqual(["admin_audit_log:authenticated:SELECT", "admin_staff:authenticated:SELECT"]);
  });
});

describe("customers and staff in the shared user pool", () => {
  const customerId = "c0000000-0000-4000-8000-000000000001";
  const staffId = "c0000000-0000-4000-8000-000000000002";

  beforeAll(async () => {
    // A customer signs up through the customer app; a member of staff is invited (auth user + admin_staff row).
    await db.query("insert into auth.users (id, email) values ($1, 'customer@example.test'), ($2, 'staff@example.test')", [customerId, staffId]);
    await db.query("insert into public.admin_staff (user_id, email, display_name, roles) values ($1, 'staff@example.test', 'Sam Staff', array['OP'])", [staffId]);
  });

  it("gives a customer sign-up a profile as before, and no staff record", async () => {
    const profiles = (await db.query<{ id: string }>("select id from public.profiles order by id")).rows.map((row) => row.id);
    expect(profiles).toEqual([customerId, staffId]); // the existing trigger also gives invited staff a customer profile
    expect((await db.query("select 1 from public.admin_staff where user_id = $1", [customerId])).rows).toEqual([]);
  });

  it("keeps the customer rules working for customers", async () => {
    const own = await as(db, { sub: customerId, aal: "aal1" }, async () => (await db.query<{ id: string }>("select id from public.profiles")).rows.map((row) => row.id));
    expect(own).toEqual([customerId]);
  });

  it("shows a customer nothing in the admin tables, even after they pass MFA (aal2)", async () => {
    for (const aal of ["aal1", "aal2"]) {
      expect(await as(db, { sub: customerId, aal }, async () => (await db.query("select * from public.admin_staff")).rows)).toEqual([]);
      expect(await as(db, { sub: customerId, aal }, async () => (await db.query("select * from public.admin_audit_log")).rows)).toEqual([]);
    }
    await expect(as(db, { sub: customerId, aal: "aal2" }, () => db.query("insert into public.admin_staff (user_id, email, display_name, roles) values ($1, 'customer@example.test', 'Me', array['PA'])", [customerId]))).rejects.toThrow(/permission denied/);
  });

  it("shows staff their own record only once they pass MFA", async () => {
    expect(await as(db, { sub: staffId, aal: "aal1" }, async () => (await db.query("select user_id from public.admin_staff")).rows)).toEqual([]);
    expect(await as(db, { sub: staffId, aal: "aal2" }, async () => (await db.query<{ user_id: string }>("select user_id from public.admin_staff")).rows.map((row) => row.user_id))).toEqual([staffId]);
  });
});
