# FuelCap prototype

Responsive web/PWA prototype for FuelCap. It supports US, Canadian, and UK
market conventions and provides interactive price-lock, virtual-tank,
transaction, and QR-redemption flows.

All fuel, pricing, balance, lock, refund, and redemption activity is simulated.
No payment is taken and no fuel is purchased.

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

Never expose the Supabase secret key or database password as a `NEXT_PUBLIC_*`
variable.

## Supabase

The initial schema is in
`supabase/migrations/202607240001_initial_schema.sql`. It creates profiles,
auditable price snapshots, price locks, and transactions with row-level
security. Client users can read only their own account records. Price-lock
creation and redemption are implemented by authenticated, validated database
functions in `supabase/migrations/202607240002_demo_operations.sql`. These
functions derive prices from stored snapshots, enforce market volume limits,
verify lock ownership, and prevent over-redemption.

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

Create a Render Blueprint from the GitHub repository, then enter the two
Supabase public environment variables when prompted. The production service
does not need a persistent disk because application data belongs in Supabase.

## Validation

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm audit --omit=dev
```
