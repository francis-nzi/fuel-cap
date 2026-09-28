# Control Room sign-in (admin-auth)

Staff sign-in for the control room (`apps/admin`, deployed at https://fuelcap-app.onrender.com).
Supabase Auth with email and password, invite-only, authenticator-app MFA (TOTP) on every account.

## How it works

| Rule | Where it's enforced |
|---|---|
| Every page and every `/api/*` route needs a signed-in session that passed MFA (Supabase `aal2`). Only `/login`, `/auth/confirm` (invite links), `/api/auth/sign-in` and `/api/health` (Render's health check) are open. | `proxy.ts`, and again inside every route and page (`lib/auth/guard.ts`) |
| No public sign-up. People join only by invite from a platform administrator (PA). | Supabase setting (below) + the app never calls sign-up + a staff record is required |
| First sign-in forces authenticator enrolment; every sign-in needs a code. A password-only session can reach only the MFA and set-password steps. | `proxy.ts`, `/mfa` |
| Roles are stored on the server (`admin_staff`) and passed into the existing `@fuelcap/authz` checks. The demo-user switcher and the `X-FuelCap-Demo-*` identity headers are gone. | `lib/auth/guard.ts`, every API route |
| Step-up: hedging (start or approve), price validation (break-glass) and emergency access ask for a fresh authenticator code, verified by Supabase, valid for 5 minutes. So do inviting staff, disabling or resetting someone, and removing an authenticator. The sign-in code never counts. | `/api/auth/step-up`, `/api/admin/governed-actions`, `lib/auth/claims.ts` |
| Signed out after 30 minutes without activity (the server revokes the session; the browser warns 2 minutes before). Background polling doesn't count as activity. | `proxy.ts`, `components/auth/session-timer.tsx` |
| Audit record for every sign-in, failed attempt, MFA check, step-up, governed action, invite, disable/enable, reset, sign-out and timeout. Append-only. | `admin_audit_log`, visible to PA and auditors at `/staff` |
| Database rules on the admin tables also require `aal2`; browsers can't write them; the audit log can't be edited or deleted. | `supabase/migrations/202609280001_admin_auth.sql` |

Session cookies are httpOnly (the admin app never ships a Supabase key to the browser), SameSite=Lax, Secure in production, and state-changing requests from another origin are refused. A password alone can't change the password: that needs an email link, a first-time invite, or a full MFA session. Password and code guessing is throttled by Supabase Auth's own rate limits (Authentication → Rate Limits); every failure is audited.

## One-time setup: a separate Supabase project for staff

Use a **new Supabase project** for staff, not the customer project. Turning off public sign-up is a project-wide setting, and the customer app relies on sign-up. Keeping staff identities apart from customers is also the safer design.

1. **Create the project** (same region as Render if possible). Turn on MFA for your own Supabase dashboard account too.
2. **Authentication → Sign In / Providers:** Email enabled; **"Allow new users to sign up": Off**; confirm email: On.
3. **Authentication → Multi-Factor:** TOTP (App Authenticator) **Enabled**. Phone MFA off.
4. **Authentication → URL Configuration:** Site URL `https://fuelcap-app.onrender.com`; add redirect URL `https://fuelcap-app.onrender.com/auth/confirm`.
5. **Authentication → Email Templates:**
   - *Invite user*, link: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite`
   - *Reset password*, link: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery`
6. **Authentication → SMTP:** set up your own SMTP (for example sending as `info@fuelcap.tech`). Supabase's built-in mailer is for testing and sends only a few emails an hour.
7. **Optional, paid plans:** Authentication → Sessions → inactivity timeout 30 minutes (a second layer behind the app's own), and a shorter JWT expiry (for example 10 minutes).
8. **SQL Editor:** run `apps/admin/supabase/migrations/202609280001_admin_auth.sql`.
9. **Invite the first platform administrator** (nobody can invite in the app until one exists):

   ```bash
   ADMIN_SUPABASE_URL=https://<staff-project>.supabase.co \
   ADMIN_SUPABASE_SERVICE_ROLE_KEY=<secret key> \
   ADMIN_SITE_URL=https://fuelcap-app.onrender.com \
   node apps/admin/scripts/invite-first-admin.mjs --email francis@netzero.international --name "Francis Doherty" --roles PA,RT
   ```

   The script refuses to run once an active PA exists. After that, invite from **Staff & audit** (`/staff`).

## Environment variables for Render (service `fuelcap-app`)

| Variable | Value | Secret? |
|---|---|---|
| `ADMIN_SUPABASE_URL` | `https://<staff-project-ref>.supabase.co` | No |
| `ADMIN_SUPABASE_ANON_KEY` | The staff project's publishable (anon) key. Used only on the server. | No, but keep it server-side |
| `ADMIN_SUPABASE_SERVICE_ROLE_KEY` | The staff project's secret (service role) key | **Yes** |
| `ADMIN_SESSION_SECRET` | 48+ random characters, e.g. `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`. Signs the idle-clock and step-up cookies. Changing it signs everyone out. | **Yes** |
| `ADMIN_SITE_URL` | `https://fuelcap-app.onrender.com` (invite links; also turns on Secure cookies) | No |

Leave the existing `NEXT_PUBLIC_APP_ENV` and `CUSTOMER_APP_ORIGIN` as they are. **Never set `ADMIN_E2E` or `ADMIN_DATA_BACKEND` on Render**: they switch on the in-memory test store (which is refused in production anyway). If any of the five variables is missing, the control room fails closed: every page and API returns 503, except `/api/health`.

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
4. The PA clicks *Reset authenticator*. If the lost phone could also expose their password (for example a password manager on it), send a password reset from the Supabase dashboard too (the link lands on `/auth/confirm` → set password).
5. The PA clicks *Enable access*. At their next sign-in they must set up a new authenticator; ask them to add a backup straight away.
6. Record the ticket or reason. The audit log shows `STAFF_DISABLED`, `MFA_RESET_BY_ADMIN` and `STAFF_ENABLED`.

**If the only platform administrator loses their phone**, nobody in the app can reset them. Keep **at least two PA accounts**, or a sealed emergency PA whose authenticator secret is stored offline (in a safe). Last resort: the Supabase project owner deletes the factor in the dashboard (Authentication → Users → the user → MFA). That's why the dashboard account needs MFA too.

## Effect on the customer app (decision needed)

The customer app (`fuel-cap-1`, and the Phase 2 preview) calls the control room server-to-server with no staff session. With this change those calls are refused:

- `GET /api/demo/control`: the customer app no longer follows control-room price moves. It falls back to its baseline price (the preview's presenter panel doesn't depend on this).
- `GET`/`POST /api/customer-lifecycle`: onboarding and wallet funding no longer appear in the control room's customer register. The customer app keeps them in its own local store.

Both degrade safely (tested in `tests/bridge-e2e`). To restore the link later: add a narrow service credential that the customer app sends for exactly these calls. That needs a customer-app change, so it's parked until after the freeze and your decision.

## Testing

- `pnpm --filter @fuelcap/admin test`: unit tests for step-up freshness and signed cookies, plus the database rules run against a real Postgres (PGlite): aal1 sees nothing, staff see only themselves, PA/AU see all, browsers can't write, audit is append-only, forbidden role combinations are rejected.
- `pnpm test:e2e:admin`: starts a mock Supabase Auth server (`tests/admin-auth/mock-supabase-auth.mjs`, real TOTP) and the admin app with an in-memory staff store. Covers no session, no MFA, MFA, API refusal (including forged identity headers), step-up for hedging, role-based refusal, invite → forced enrolment, lost-phone recovery, refused sign-ins, idle timeout, and every existing control-room journey signed in, on four browsers.
