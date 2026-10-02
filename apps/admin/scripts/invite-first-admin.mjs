#!/usr/bin/env node
// One-off bootstrap: invite the FIRST platform administrator. Nobody can invite through the control room until
// one exists. Refuses to run once any active PA exists (after that, invite from /staff in the app).
//
//   ADMIN_SUPABASE_URL=https://<staff-project>.supabase.co \
//   ADMIN_SUPABASE_SERVICE_ROLE_KEY=<service role key> \
//   ADMIN_SITE_URL=https://fuelcap-app.onrender.com \
//   node apps/admin/scripts/invite-first-admin.mjs --email you@example.com --name "Your Name" --roles PA,RT
import { createClient } from "@supabase/supabase-js";

const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, all) => (value.startsWith("--") ? [...pairs, [value.slice(2), all[index + 1]]] : pairs), []));
const url = process.env.ADMIN_SUPABASE_URL;
const serviceKey = process.env.ADMIN_SUPABASE_SERVICE_ROLE_KEY;
const siteUrl = process.env.ADMIN_SITE_URL;
const roles = String(args.roles ?? "PA").split(",").map((role) => role.trim().toUpperCase()).filter(Boolean);
const allowed = ["PA", "OP", "RT", "FR", "CF", "CS", "DI", "AU", "DP"];

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}
if (!url || !serviceKey || !siteUrl) fail("Set ADMIN_SUPABASE_URL, ADMIN_SUPABASE_SERVICE_ROLE_KEY and ADMIN_SITE_URL.");
if (!args.email || !args.name) fail('Usage: --email you@example.com --name "Your Name" [--roles PA,RT]');
if (!roles.includes("PA")) fail("The first account must include the PA role.");
if (roles.some((role) => !allowed.includes(role))) fail(`Unknown role. Use: ${allowed.join(", ")}`);
if (roles.includes("AU") || roles.includes("DP")) fail("AU and DP must be single-role accounts; the first admin can't hold them.");

const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: existing, error: lookupError } = await admin.from("admin_staff").select("email").contains("roles", ["PA"]).eq("active", true);
if (lookupError) fail(`Couldn't read admin_staff (has the migration run?): ${lookupError.message}`);
if (existing.length) fail(`A platform administrator already exists (${existing.map((row) => row.email).join(", ")}). Invite from /staff instead.`);

const email = String(args.email).trim().toLowerCase();
const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo: `${siteUrl}/auth/confirm`, data: { display_name: args.name } });
if (error || !data.user) fail(`Invite failed: ${error?.message ?? "no user returned"}`);
const { error: insertError } = await admin.from("admin_staff").upsert({ user_id: data.user.id, email, display_name: args.name, roles, organisation_ids: ["org-fuelcap-global", "org-personal-a", "org-personal-canada", "org-fleet-northstar"] });
if (insertError) fail(`Invite sent but the staff record failed: ${insertError.message}`);
await admin.from("admin_audit_log").insert({ event: "STAFF_INVITED", outcome: "success", detail: { invitee: email, inviteeId: data.user.id, roles, via: "bootstrap-script" } });
console.log(`✓ Invite sent to ${email} with roles ${roles.join(", ")}. They set a password, then an authenticator app, at first sign-in.`);
