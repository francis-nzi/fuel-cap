# Control Room sign-in (admin-auth)

Staff sign-in for the control room (`apps/admin`, deployed at https://fuelcap-app.onrender.com).
Supabase Auth with email and password, invite-only, authenticator-app MFA (TOTP) on every staff account.
For the pre-seed demo it runs on the **customer app's Supabase project** (DEC-064, below).

## How it works

| Rule | Where it's enforced |
|---|---|
| Every page and every `/api/*` route needs a signed-in session that passed MFA (Supabase `aal2`). Only `/login`, `/auth/confirm` (invite links), `/api/auth/sign-in` and `/api/health` (Render's health check) are open. | `proxy.ts`, and again inside every route and page (`lib/auth/guard.ts`) |
| Invite-only. The shared Supabase project allows public sign-up (the customer app needs it), so having a Supabase account proves nothing: every page and API also needs an **active `admin_staff` record**, which only a platform administrator's invite creates. | `lib/auth/guard.ts` (`NOT_STAFF`), sign-in route, database rules |
| First sign-in forces authenticator enrolment; every sign-in needs a code. A password-only session can reach only the MFA and set-password steps. | `proxy.ts`, `/mfa` |
| Roles are stored on the server (`admin_staff`) and passed into the existing `@fuelcap/authz` checks. The demo-user switcher and the `X-FuelCap-Demo-*` identity headers are gone. | `lib/auth/guard.ts`, every API route |
| Step-up: hedging (start or approve), price validation (break-glass) and emergency access ask for a fresh authenticator code, verified by Supabase, valid for 5 minutes. So do inviting staff, disabling or resetting someone, sending a password reset, and removing an authenticator. The sign-in code never counts. | `/api/auth/step-up`, `/api/admin/governed-actions`, `lib/auth/claims.ts` |
| Signed out after 30 minutes without activity (the server revokes the session; the browser warns 2 minutes before). Background polling doesn't count as activity. | `proxy.ts`, `components/auth/session-timer.tsx` |
| Audit record for every sign-in, failed attempt, MFA check, step-up, governed action, invite, disable/enable, authenticator reset, password-reset email, sign-out and timeout. Append-only. | `admin_audit_log`, visible to PA and auditors at `/staff` |
| Database rules on the admin tables also require `aal2`; browsers can't write them; the audit log can't be edited or deleted. | `supabase/migrations/202609280001_admin_auth.sql` |

Session cookies are httpOnly (the admin app never ships a Supabase key to the browser), SameSite=Lax, Secure in production, and state-changing requests from another origin are refused. A password alone can't change the password: that needs an email link, a first-time invite, or a full MFA session. Password and code guessing is throttled by Supabase Auth's own rate limits (Authentication → Rate Limits); every failure is audited.

## DEC-064: staff sign in through the customer Supabase project

For the pre-seed demo, control-room sign-in uses the **existing customer Supabase project** (`fuel-cap-1`'s project), not a separate staff project (decision DEC-064 in the project's `Implementation/DECISIONS.md`, kept outside this repository). Customers and staff share one user pool. What keeps them apart:

- **Being a Supabase user isn't enough.** Every control-room page and API needs an **active `admin_staff` row** for the signed-in user, as well as `aal2`. Only a platform administrator's invite creates that row. A customer who signs up in the customer app, or who turns on an authenticator themselves, is refused (`SIGN_IN_DENIED_NOT_STAFF`, `403 NOT_STAFF`); tested end to end.
- **The admin tables are closed to customers.** The migration only *adds* `admin_staff`, `admin_audit_log`, `admin_*` functions, rules and triggers. It changes no customer table, column, function, rule, trigger, grant or type, and it removes Supabase's default grants from the admin tables, so a customer session (even at `aal2`) sees nothing and can write nothing. This is checked against the customer project's own migrations in `supabase/shared-project.test.ts`.
- **Staff emails go to the control room.** Invites and password resets from the control room ask Supabase to redirect to `https://fuelcap-app.onrender.com/auth/confirm`. The shared email templates (step 4) send those links there and leave every other email as it is.

Side effects to know about:
- The customer project's existing sign-up trigger (`on_auth_user_created`) gives every invited member of staff an empty customer `profiles` row. It's harmless: the customer app shows them an empty wallet if they ever sign in there.
- **Invite staff on an address that has no customer account.** An email can only belong to one user, so an address already used in the customer app gets "That email already has an account". A separate work address also keeps a staff login from ever being a customer login.
- Anyone can ask Supabase for a password-reset email for *their own* account with the control room as the redirect address. That only lets them set their own password; they're still not staff.
- One set of Auth rate limits and one mailer serve both apps.
- The control room holds the customer project's **secret (service role) key**. It's used only on the server, for invites, resets and staff records, but it can read every customer table. Keep it only in Render's secret environment.

## One-time setup in the existing customer project

1. **Authentication → Sign In / Providers:** leave **"Allow new users to sign up" ON** (the customer app needs it). Leave the email-confirmation setting as it is.
2. **Authentication → Multi-Factor:** TOTP (App Authenticator) **Enabled**. This applies to every account, but only the control room requires it: the customer app doesn't offer MFA, so customers see no change. Phone MFA off.
3. **Authentication → URL Configuration:** **don't change the Site URL** (it stays the customer app). Under **Redirect URLs** add:
   - `https://fuelcap-app.onrender.com/auth/confirm`
   - `https://fuelcap-admin-preview.onrender.com/auth/confirm` (the preview service used for testing before merge)

   Supabase only honours a redirect address on this list. Anything else falls back to the Site URL, so a mistake sends a staff link to the customer app (which can't use it); it never sends a customer link to the control room.
4. **Authentication → Email Templates.** The customer app uses only *Confirm signup* (its sign-up form). Leave that template alone. Change only **Invite user** and **Reset password**: wrap the current content in an `{{ else }}` branch, so emails for anyone else are unchanged.

   *Invite user*:
   ```html
   {{ if eq .RedirectTo "https://fuelcap-app.onrender.com/auth/confirm" "https://fuelcap-admin-preview.onrender.com/auth/confirm" }}
   <h2>You're invited to the FuelCap Control Room</h2>
   <p>Choose a password, then set up an authenticator app. The link works once.</p>
   <p><a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=invite">Accept the invite</a></p>
   {{ else }}
   ...the template's current content, unchanged (by default: <a href="{{ .ConfirmationURL }}">Accept the invite</a>)...
   {{ end }}
   ```

   *Reset password*:
   ```html
   {{ if eq .RedirectTo "https://fuelcap-app.onrender.com/auth/confirm" "https://fuelcap-admin-preview.onrender.com/auth/confirm" }}
   <h2>Reset your FuelCap Control Room password</h2>
   <p>You'll still need your authenticator code afterwards. The link works once. If you didn't ask for this, tell a platform administrator.</p>
   <p><a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=recovery">Choose a new password</a></p>
   {{ else }}
   ...the template's current content, unchanged (by default: <a href="{{ .ConfirmationURL }}">Reset Password</a>)...
   {{ end }}
   ```

   The staff link is built from the **redirect address**, not `{{ .SiteURL }}` (which is the customer app). `eq` with several values is true if the first matches any of them. Use the template editor's preview to check both branches.
5. **Authentication → SMTP:** if the project still uses Supabase's built-in mailer, set up your own SMTP (for example sending as `info@fuelcap.tech`). The built-in mailer sends only a few emails an hour, now shared by customer sign-ups and staff invites.
6. **Optional, paid plans:** Authentication → Sessions → inactivity timeout, and a shorter JWT expiry. These apply to customers too, so only change them if that suits the customer app; the control room has its own 30-minute idle sign-out anyway.
7. **SQL Editor:** run `apps/admin/supabase/migrations/202609280001_admin_auth.sql`. It is safe to run again.
8. **Invite the first platform administrator** (nobody can invite in the app until one exists), on an address with no customer account:

   ```bash
   ADMIN_SUPABASE_URL=https://<customer-project-ref>.supabase.co \
   ADMIN_SUPABASE_SERVICE_ROLE_KEY=<secret key> \
   ADMIN_SITE_URL=https://fuelcap-app.onrender.com \
   node apps/admin/scripts/invite-first-admin.mjs --email you@example.com --name "Your Name" --roles PA,RT
   ```

   The script refuses to run once an active PA exists. After that, invite from **Staff & audit** (`/staff`). For the preview service, set `ADMIN_SITE_URL` to the preview's address so the link goes there.

Also turn on MFA for your own Supabase dashboard account: the dashboard can remove anyone's authenticator.

## Later: moving staff to a separate Supabase project

DEC-064 is interim. It requires moving staff to a dedicated project before any of: a pilot with real customers, real funds or card processing, onboarding staff beyond the founding team, or an external security review or due diligence. Steps:

1. Create the staff project and set it up: sign-up **Off**, TOTP on, Site URL `https://fuelcap-app.onrender.com`, redirect URL `…/auth/confirm`, own SMTP. The invite and reset templates can then link with `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite` (or `type=recovery`), with no `if`.
2. Run the same migration there.
3. Change the five `ADMIN_*` variables on `fuelcap-app` (and the preview) to the staff project. The session secret should change too, which signs everyone out.
4. Invite the first PA with `invite-first-admin.mjs`, then re-invite each member of staff from `/staff` with the same roles. Authenticators don't move between projects: everyone sets up a new one and a new password. Export the old `admin_audit_log` first if you need to keep it (it's append-only, so copy it rather than move it).
5. In the customer project: delete the staff users (Authentication → Users), then drop `admin_audit_log`, `admin_staff` and the `admin_*` functions. Remove the control-room redirect URLs and put the Invite and Reset password templates back to their `{{ else }}` content.
6. Rotate the customer project's secret key, since the control room held it.

No code changes are needed: the app only reads the `ADMIN_*` variables.
## Environment variables for Render (service `fuelcap-app`, and later `fuelcap-admin-preview`)

**All five still need creating.** None exist on `fuelcap-app` yet (checked 28 Sep 2026). Under DEC-064 the first three are the customer project's own values, already on Render under other names:

| Variable | Value | Secret? |
|---|---|---|
| `ADMIN_SUPABASE_URL` | Copy `NEXT_PUBLIC_SUPABASE_URL` (already on `fuelcap-app` and `fuel-cap-1`, same customer project) | No |
| `ADMIN_SUPABASE_ANON_KEY` | Copy `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (same value on both services). Used only on the server. | No, but keep it server-side |
| `ADMIN_SUPABASE_SERVICE_ROLE_KEY` | Copy `SUPABASE_SECRET_KEY` from `fuel-cap-1` (it isn't on `fuelcap-app`) | **Yes** |
| `ADMIN_SESSION_SECRET` | New: 48+ random characters, e.g. `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`. Signs the idle-clock and step-up cookies. Changing it signs everyone out. Use a different one on the preview. | **Yes** |
| `ADMIN_SITE_URL` | New: `https://fuelcap-app.onrender.com` (on the preview: `https://fuelcap-admin-preview.onrender.com`). Where invite and reset links send people; also turns on Secure cookies. It must be on the project's Redirect URLs list. | No |

The `ADMIN_*` names stay separate from the `NEXT_PUBLIC_*` ones on purpose, so moving staff to their own project later is only a change of values.

Leave the existing variables (`NEXT_PUBLIC_APP_ENV`, `NEXT_PUBLIC_SUPABASE_*`, `PRICING_INGESTION_SECRET`, `FUEL_FINDER_*`) as they are. **Never set `ADMIN_E2E` or `ADMIN_DATA_BACKEND` on Render**: they switch on the in-memory test store (which is refused in production anyway). If any of the five variables is missing, the control room fails closed: every page and API returns 503, except `/api/health`.
## Roles

`PA` platform administrator (invites staff, recovery, emergency access) · `OP` operations · `RT` risk & treasury (hedging, price publishing) · `FR` finance · `CF` compliance & fraud · `CS` customer support · `DI` data & integrations · `AU` auditor (read-only, single role) · `DP` demo presenter (demo environments only, single role).

A demo presenter account (`DP`) can't hold other roles. Keep a separate presenter login for demos (scenario reset needs `DP`), apart from your `PA`/`RT` account.

## Recovery: someone loses their phone

**Recommendation for everyone: add a second authenticator at set-up** (scan the same QR code on a second device, or use **Security → Add a backup authenticator** later). Good second homes: another phone or tablet, or a password manager with TOTP (1Password, Bitwarden). Supabase has no backup codes, so this is the fastest way back in.

**If they have a backup authenticator**
1. Sign in with the backup's code.
2. **Security → Remove** the lost phone's authenticator (asks for a code from the backup), then add a new backup.
3. Tell a platform administrator, who notes it (the removal is already in the audit log).

**If they have no backup**
1. They contact a platform administrator **by phone or video**, not email alone.
2. The PA **disables their access at once**: Staff & audit → *Disable access* (fresh code needed). This takes effect on their very next request, even for a session already open on the lost phone.
3. The PA **verifies who they are**: video call with photo ID, or in person. Knowing personal details isn't enough.
4. The PA clicks *Reset authenticator*. If the lost phone could also expose their password (for example a password manager on it), also click *Send password reset*. Use this button, not the Supabase dashboard: the dashboard's reset email can't carry the control-room redirect, so its link would open the customer app (DEC-064).
5. The PA clicks *Enable access*. At their next sign-in they must set up a new authenticator; ask them to add a backup straight away.
6. Record the ticket or reason. The audit log shows `STAFF_DISABLED`, `MFA_RESET_BY_ADMIN` and `STAFF_ENABLED`.

**If the only platform administrator loses their phone**, nobody in the app can reset them. Keep **at least two PA accounts**, or a sealed emergency PA whose authenticator secret is stored offline (in a safe). Last resort: the Supabase project owner deletes the factor in the dashboard (Authentication → Users → the user → MFA). That's why the dashboard account needs MFA too.

## Effect on the customer app (decision needed)

The customer app (`fuel-cap-1`, and the Phase 2 preview) calls the control room server-to-server with no staff session. With this change those calls are refused:

- `GET /api/demo/control`: the customer app no longer follows control-room price moves. It falls back to its baseline price (the preview's presenter panel doesn't depend on this).
- `GET`/`POST /api/customer-lifecycle`: onboarding and wallet funding no longer appear in the control room's customer register. The customer app keeps them in its own local store.

Both degrade safely (tested in `tests/bridge-e2e`). To restore the link later: add a narrow service credential that the customer app sends for exactly these calls. That needs a customer-app change, so it's parked until after the freeze and your decision.

## Testing

- `pnpm --filter @fuelcap/admin test`: unit tests for step-up freshness and signed cookies, plus the database rules run against a real Postgres (PGlite): aal1 sees nothing, staff see only themselves, PA/AU see all, browsers can't write, audit is append-only, forbidden role combinations are rejected. `shared-project.test.ts` runs the customer project's migrations, then the admin one, and checks nothing existing changed and customers can't see the admin tables (DEC-064).
- `pnpm test:e2e:admin`: starts a mock Supabase Auth server (`tests/admin-auth/mock-supabase-auth.mjs`, real TOTP) and the admin app with an in-memory staff store. Covers no session, no MFA, MFA, API refusal (including forged identity headers), step-up for hedging, role-based refusal, invite → forced enrolment (link opens the control room), lost-phone recovery, staff password reset (link opens the control room, code still needed), refused sign-ins, a customer sign-up refused even with its own `aal2` session planted in the browser, idle timeout, and every existing control-room journey signed in, on four browsers.
