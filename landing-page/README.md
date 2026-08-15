# FuelCap landing page + signup funnel

Mobile-first landing page for FuelCap with a progressive multi-step signup
form and a password-protected analytics dashboard, built to validate paid ad
conversion rates before the real app exists.

## Local development

```bash
npm install
npm run dev
```

- Landing page: http://localhost:3000 (redirects to a market, e.g. `/uk`, based on `Accept-Language`)
- Choose a market directly: http://localhost:3000/uk (also `/france`, `/germany`, `/spain`, `/italy`, `/austria`, `/australia`)
- Market picker: http://localhost:3000/choose-country
- Dashboard: http://localhost:3000/dashboard (password in `.env.local`)

Env vars (see `.env.example`):

- `DASHBOARD_PASSWORD` — password for `/dashboard`
- `SESSION_SECRET` — long random string used to sign the dashboard session cookie

## Markets & localization

`lib/markets.ts` defines the 7 supported markets, each mapped to a government
open fuel-price-data source we're targeting for the real app:

| Market | Language | Currency | Postal format | Data source |
|---|---|---|---|---|
| 🇬🇧 UK | en | GBP | alphanumeric | GOV.UK Fuel Finder Scheme Portal (~8,300 stations) |
| 🇫🇷 France | fr | EUR | 5-digit | data.gouv.fr / Ministère de l'Économie (~11,000) |
| 🇩🇪 Germany | de | EUR | 5-digit | Bundeskartellamt MTS-K (~14,500) |
| 🇪🇸 Spain | es | EUR | 5-digit | Ministerio para la Transición Ecológica (~11,500) |
| 🇮🇹 Italy | it | EUR | 5-digit | Osservaprezzi Carburanti / MIMIT (~22,000) |
| 🇦🇹 Austria | de | EUR | 4-digit | E-Control Spritpreisrechner API (~2,700) |
| 🇦🇺 Australia (NSW/QLD/WA) | en | AUD | 4-digit | State open data — FuelCheck / QLD Transport / FuelWatch (~5,000) |

`app/[market]/page.tsx` is the localized landing page for each market slug —
this is what paid ad campaigns should link to directly (e.g. a French Facebook
campaign → `/france`, not `/` + a language switch). `app/page.tsx` (root) is a
gateway that redirects based on the `Accept-Language` header, for organic/direct
traffic with no market context. `lib/i18n/` has one dictionary file per language
(`en`, `fr`, `de`, `es`, `it`) — Germany and Austria share the `de` dictionary but
have separate currency-example strings in `markets.ts`.

Machine-translated by Claude — have a native speaker in each market sanity-check
copy before spending ad budget against it.

## How the funnel works

`components/signup/SignupOverlay.tsx` renders a full-screen, one-question-per-step
form: **country** → gender → age → driver type → fill frequency → postcode → email.
The country step lists all 7 markets regardless of which localized page the visitor
landed on (picking Australia adds a state sub-step for NSW/QLD/WA); the postcode
step then validates against whichever country was actually selected, not the
landing page's market. Every step advance posts to `POST /api/signup`, upserting a
record keyed by a client-generated `sessionId` (`lib/tracking.ts`, stored in
`localStorage`). This means partial/dropped signups are captured too, not just
completions — that's what powers the funnel drop-off chart on the dashboard.

`utm_source` / `utm_medium` / `utm_campaign` / `utm_content` / `utm_term` are
captured from the landing page URL on first load and attached to every signup
event, along with which market page the visitor landed on (`landingMarket`) and
which country they actually selected (`answers.country`) — these can differ, and
the dashboard's "By country" table uses the selected country to show which markets
are showing real demand, for prioritizing launch order.

## ⚠️ Before deploying to Vercel

This currently persists data to local JSON files (`data/submissions.json`,
`data/pageviews.json`) via `lib/store.ts`. **That will not work on Vercel** —
serverless functions have an ephemeral, effectively read-only filesystem, so
writes will silently stop persisting once deployed.

Before deploying:

1. Swap the internals of `lib/store.ts` for a real datastore — Vercel Postgres,
   Vercel KV / Upstash Redis, or Supabase are the least-friction options. The
   exported function signatures (`getSubmissions`, `upsertSubmission`,
   `getPageViews`, `addPageView`) are the only surface the rest of the app
   talks to, so the swap is contained to this one file.
2. Set `DASHBOARD_PASSWORD` and `SESSION_SECRET` as Vercel project environment
   variables (generate a fresh `SESSION_SECRET` with `openssl rand -base64 32`
   — don't reuse the local dev one).
3. Next.js 16 renamed `middleware.ts` to `proxy.ts` (see `proxy.ts` at the
   project root) — nothing to change here, just don't reintroduce a
   `middleware.ts` file when following older tutorials/examples.
