import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminMigration, as as asUser, supabaseLikeDatabase } from "./test-support";

// Runs the admin migration in an in-process Postgres (PGlite) set up like a Supabase project (roles, auth schema,
// default grants), then checks the row-level-security rules as `authenticated` with aal1 and aal2 JWT claims.

const PA = "00000000-0000-0000-0000-00000000000a";
const RT = "00000000-0000-0000-0000-00000000000b";
const AU = "00000000-0000-0000-0000-00000000000c";
let db: PGlite;
const as = <T>(claims: Record<string, unknown> | null, run: () => Promise<T>) => asUser(db, claims, run);
const staffRows = async () => (await db.query<{ user_id: string }>("select user_id from public.admin_staff order by user_id")).rows.map((row) => row.user_id);

beforeAll(async () => {
  db = await supabaseLikeDatabase();
  await db.exec(adminMigration());
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
