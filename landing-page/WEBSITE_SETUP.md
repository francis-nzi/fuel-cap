# FuelCap website — setup & deployment

The FuelCap marketing site is a Next.js 16 app in `landing-page/`. It serves a
localized home page per market plus a full set of marketing pages, captures
waitlist signups and contact messages, and has a password-protected dashboard
to view and export signups.

## Pages

- `/[market]` — localized home (UK, France, Germany, Spain, Italy, Austria, Australia)
- `/[market]/how-it-works`
- `/[market]/pricing`
- `/[market]/faq`
- `/[market]/about` — company + founder (Francis Doherty)
- `/[market]/contact` — email + contact form
- `/[market]/legal/privacy`, `/[market]/legal/terms`
- `/choose-country` — market switcher
- `/dashboard` — signups dashboard (password-protected), with CSV export

The home page still renders fully localized copy in five languages. The
secondary pages use localized navigation/footer labels; their body copy is
currently English and market-aware (fuel word, currency, station data source).

## Run locally

```bash
cd landing-page
npm install          # first time
cp .env.example .env.local   # then edit values
npm run dev          # http://localhost:3000
```

With no Supabase keys set, signups/contacts/page views are written to JSON files
under `landing-page/data/` — fine for local development.

## Environment variables

See `.env.example`. Summary:

| Variable | Purpose |
|---|---|
| `DASHBOARD_PASSWORD` | Password for `/dashboard`. Required for the dashboard. |
| `SESSION_SECRET` | Signs the dashboard session cookie. Use a long random string. |
| `SUPABASE_URL` | Supabase project URL. Enables the DB store when set. |
| `SUPABASE_SECRET_KEY` | Supabase **secret key** — new `sb_secret_...` (Project Settings → API Keys → Secret keys) or the legacy `service_role` JWT. Server-only; bypasses RLS. |

## Wire up the real data store (Supabase)

Signups, contacts and page views persist to **Supabase** whenever both
`SUPABASE_URL` and `SUPABASE_SECRET_KEY` are set. This is required for any
serverless host (e.g. Vercel), where the local filesystem is not durable.

1. Create a project at supabase.com.
2. In the SQL editor, run `supabase/schema.sql` (creates `submissions`,
   `pageviews`, `contacts`; RLS on, server-only access).
3. In **Project Settings → API**, copy the **Project URL** and the
   **service_role** key into your environment.
4. Redeploy. The app talks to Supabase over its REST endpoint using `fetch`
   (no extra npm packages), so nothing else to install.

The data layer lives entirely in `lib/store.ts` and `lib/supabase.ts` — the rest
of the app only calls `upsertSubmission`, `getSubmissions`, `addPageView`,
`addContact`, etc., so swapping stores stays contained to those two files.

## Deploy — Render + Cloudflare (planned setup)

The site is a standard Next.js app (`npm run build` → `npm run start`) hosted as a
**Render web service**, with **Cloudflare** managing DNS for `fuelcap.tech`.
A `render.yaml` blueprint and a pinned `.node-version` (20.18.0) are included.

### 1. Render web service

Either push `render.yaml` (Blueprint) or create the service manually:

- **New → Web Service**, connect the Git repo.
- **Root Directory:** `landing-page` (this app is a subfolder). If you instead
  move `render.yaml` to the repo root, uncomment `rootDir: landing-page` there.
- **Build command:** `npm ci && npm run build`
- **Start command:** `npm run start` — `next start` listens on Render's `$PORT`
  automatically, no change needed.
- **Health check path:** `/uk` (the root `/` 307-redirects by locale, which a
  health check would flag; a market page returns 200).
- **Environment variables:** `SESSION_SECRET` (let Render generate it),
  `DASHBOARD_PASSWORD`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`. Supabase is
  required on Render — the local file store is not durable there.

Deploy once and confirm the app works on the free `*.onrender.com` URL first.

### 2. Custom domain on Render

In the service → **Settings → Custom Domains**, add both `fuelcap.tech` and
`www.fuelcap.tech`. Render shows the DNS target(s) to point at (an
`onrender.com` hostname) and will issue a TLS certificate once DNS resolves.

### 3. Cloudflare DNS

Move the domain's nameservers to Cloudflare (Ionos → set custom nameservers to
the pair Cloudflare gives you). Then in Cloudflare **DNS**:

| Type  | Name  | Target                     |
|-------|-------|----------------------------|
| CNAME | `@`   | `<your-service>.onrender.com` (Cloudflare flattens the apex) |
| CNAME | `www` | `<your-service>.onrender.com` |

- **SSL/TLS → Overview:** set encryption mode to **Full (strict)**. Render serves
  a valid certificate; **do not** use *Flexible* (it causes redirect loops).
- **Proxy status (the important gotcha):** set both records to **DNS only**
  (grey cloud) *first*, so Render can verify the domain and issue its cert. Once
  Render shows the domain as verified/secured, you can switch the orange cloud
  **on** to put them behind Cloudflare's proxy/CDN — keeping SSL at Full (strict).

Email (`info@fuelcap.tech`) stays on Ionos: keep the existing MX (and any
SPF/DKIM/TXT) records when you recreate DNS in Cloudflare, or mail will break.

### Alternatives

- **Vercel** works too (import repo, set env vars, Supabase required).
- **Ionos VPS/Cloud server** can run `npm run build && npm run start` behind a
  reverse proxy. Ionos *shared* hosting cannot run a Node app, which is why the
  app lives on Render rather than on the Ionos hosting behind `fuelcap.tech`.
