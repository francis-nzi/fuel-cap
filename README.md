# FuelCap prototype

Responsive web/PWA prototype for FuelCap. It supports US, Canadian, and UK
market conventions and provides interactive price-lock, virtual-tank,
transaction, and QR-redemption flows.

All fuel, pricing, balance, lock, refund, and redemption activity is simulated.
No payment is taken and no fuel is purchased.

## Architecture

The target pricing, station/provider/country scope, pump settlement, and
end-of-day hedging design is documented in
[`docs/system-workflow-and-pricing.md`](docs/system-workflow-and-pricing.md).

## Local development

Requirements:

- Node.js 22
- npm 10 or later
- A Supabase project

```bash
cp .env.example .env.local
npm ci
npm run dev
```

Open `http://localhost:3000`.

## Environment

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser-safe Supabase publishable key |
| `NEXT_PUBLIC_APP_ENV` | Environment label used by health reporting |
| `FUEL_FINDER_CLIENT_ID` | Server-only Fuel Finder information-recipient OAuth client ID |
| `FUEL_FINDER_CLIENT_SECRET` | Server-only Fuel Finder OAuth client secret |
| `FUEL_FINDER_TOKEN_URL` | Token URL supplied in the authenticated Fuel Finder portal |
| `FUEL_FINDER_API_BASE_URL` | Fuel Finder API origin; defaults to `https://www.fuel-finder.service.gov.uk` |
| `FUEL_FINDER_PRICES_PATH` | Prices resource path; defaults to `/api/v1/pfs/fuel-prices` |
| `FUEL_FINDER_FORECOURTS_PATH` | Forecourt details resource path; defaults to `/api/v1/pfs` |
| `FUEL_FINDER_MAX_BATCHES` | Safety ceiling for a complete feed retrieval; defaults to `40` |
| `FUEL_FINDER_DISPLAY_LIMIT` | Maximum station choices returned to one customer request; defaults to `500` |
| `FUEL_FINDER_SCOPE` | OAuth scope; defaults to `fuelfinder.read` |
| `FUEL_FINDER_FUEL_TYPE` | Fuel grade used by the customer app; defaults to `E10` |
| `CUSTOMER_APP_ORIGIN` | Customer application origin used by the admin live-pricing bridge; defaults to the production customer service |
| `SUPABASE_SECRET_KEY` | Server-only Supabase secret key used solely by governed ingestion |
| `PRICING_INGESTION_SECRET` | Bearer secret protecting `POST /api/fuel-finder/refresh` |

Never expose the Supabase secret key, Fuel Finder credentials or database
password as a `NEXT_PUBLIC_*` variable. Fuel Finder token exchange and price
retrieval run only in the server-side `/api/fuel-finder` route. Tokens are
cached in memory until shortly before expiry. If the upstream service is not
configured or is unavailable, the customer app labels and uses its verified
fallback dataset rather than presenting it as live data.

The `Fuel Finder ingestion` workflow refreshes the governed UK dataset every ten
minutes. Apply the Supabase migrations, set `SUPABASE_SECRET_KEY` and
`PRICING_INGESTION_SECRET` on the customer Render service, and add the same
`PRICING_INGESTION_SECRET` value as a GitHub Actions repository secret. The
refresh endpoint rejects unauthenticated requests and records every completed or
failed run without exposing provider credentials.

## Supabase

The initial schema is in
`supabase/migrations/202607240001_initial_schema.sql`. It creates profiles,
auditable price snapshots, price locks, and transactions with row-level
security. Client users can read only their own account records. Price-lock
creation and redemption are implemented by authenticated, validated database
functions in `supabase/migrations/202607240002_demo_operations.sql`. These
functions derive prices from stored snapshots, enforce market volume limits,
verify lock ownership, and prevent over-redemption.

Scoped station, provider, and country pricing is introduced by
`supabase/migrations/202607240003_scoped_pricing.sql`. It adds provider and
station reference data, immutable station-price observations, accepted quote
lineage, and validated scoped-lock creation. Provider and country options use
the current verified maximum of the latest price per covered station.

Apply it using the Supabase CLI after authenticating:

```bash
npx supabase login
npx supabase link --project-ref tsjthaukuhfrlxekwjag
npx supabase db push
```

In Supabase Authentication URL Configuration, set the Site URL to the current
Render URL and add:

- `http://localhost:3000/**`
- `https://fuel-cap-1.onrender.com/**`
- `https://app.fuelcap.tech/**`

## Render

`render.yaml` defines a Node Web Service in Frankfurt with:

- Build: `npm ci && npm run build`
- Start: `npm start`
- Health check: `/api/health`
- Node.js 22

Create a Render Blueprint from the GitHub repository, then enter the Supabase
variables and the three private Fuel Finder values when prompted. The token URL
is supplied in the authenticated information-recipient portal alongside the
client credentials. The production service does not need a persistent disk
because application data belongs in Supabase and OAuth tokens are short-lived.

## Validation

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm audit --omit=dev
```
