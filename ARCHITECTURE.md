# FuelCap — Architecture Decision & Migration Plan

**Status:** Accepted (decision), migration not yet executed
**Date:** August 2026
**Owner:** Francis Doherty
**Scope:** Establish one authoritative application root and a monorepo boundary, and
migrate the existing apps into it without losing work.

---

## 1. Context

There are currently three Next.js locations on disk:

| Location | What it is | State |
|---|---|---|
| `fuel-cap-app/` | The customer/product app (a Next app at the **repo root**, `src/`). This is the git repo `francis-nzi/fuel-cap` that Render deploys. | **Live** |
| `fuel-cap-app/landing-page/` | The marketing site **inside the repo** (built by the Render `fuelcap-web` service, Root Directory `landing-page`). | **Live — newer** |
| `landing-page/` (sibling, outside the repo) | An earlier copy of the marketing site. | **Stale duplicate** |

### Inventory finding (step 1 of the migration, done)

A file-level comparison of the two landing pages shows:

- **Identical file sets.** The only file unique to the sibling `landing-page/` is a local
  `.env.local` (secrets, intentionally un-committed). **No unique source work is stranded.**
- **The in-repo copy (`fuel-cap-app/landing-page/`) is the newer, stronger implementation.**
  It adds the **USA** and **Canada** markets and market-aware copy (gallon-vs-litre
  interpolation), matching the canonical USD/US-anchored framing; the sibling is the older
  pre-USA/Canada version (`markets.ts` 223 lines vs 265; older i18n/components).

**Conclusion:** the "select the strongest source" question resolves to **the in-repo
`fuel-cap-app/landing-page`**. The sibling `landing-page/` is superseded and can be archived
under the separate, approved cleanup step. In effect there are **two real apps + one leftover**,
not three peers.

---

## 2. Decision

1. **`fuel-cap-app` is the authoritative monorepo root.** All application work lives here.
2. Restructure it into **`apps/*`** (separately deployable surfaces) over shared **`packages/*`**
   (contracts and domain logic). Customer, marketing and admin deploy independently but share
   the same contracts and business rules.
3. Migrate **conservatively**: inventory → select strongest → port unique → preserve originals →
   mark deprecated → remove/archive duplicates **only under a separately approved cleanup step**.

---

## 3. Target structure

```
fuel-cap-app/                 # monorepo root (workspace)
  apps/
    customer/                 # today's product app (moved from repo root src/)
    marketing/                # the marketing site (from fuel-cap-app/landing-page)
    admin/                    # NEW — operator "Control Room"
  packages/
    contracts/                # shared TypeScript types + zod schemas + API contracts
    domain/                   # pure business logic (entities, use-cases)
    rules-engine/             # the 18 customer rules + Spread Engine + allocation + rollover
    ai/                       # pricing/forecasting/exposure & fraud models, inference
    pricing-data/             # fuel-price provider adapters + observation store + canonical-quote engine
    ledger/                   # immutable double-entry ledger + balance projections + reconciliation
    fx-engine/                # FX reference adapters + canonical rate + versioned FX adjustment decision
    hedging/                  # exposure aggregation + versioned hedge recommendation (Phase 1 simulated)
    risk/                     # fraud/abuse risk-decision + case management (runtime via rules-engine)
    identity/                 # principal/profile/org/vehicle/consent entities + lifecycle + KYC/KYB adapters
    billing/                  # provider-neutral billing contracts + Stripe (processor) + Xero (accounting) adapters
    communications/           # provider-neutral email/push/SMS/in-app adapters + templates + outbox
    privacy/                  # retention-policy matrix + privacy-rights case workflows + disposal/anonymisation
    observability/            # tracing/metrics/logs + SLIs + incidents/runbooks + kill switches + recovery
    analytics/                # versioned metric registry + KPI lineage + governed dashboards/exports
    database/                 # Supabase (PostgREST) wrapper + schema/migrations
    ui/                       # shared React component library + brand tokens
    config/                   # shared tsconfig, eslint, tailwind, env schema
    demo-data/                # scripted demonstrator dataset (for the investor demo)
  turbo.json                  # Turborepo pipeline
  package.json                # workspace root (pnpm/npm workspaces)
  tsconfig.base.json          # shared TS config + path aliases
```

### Package boundaries

| Package | Owns | Consumed by | Notes |
|---|---|---|---|
| `contracts` | Shared types, zod schemas, API/DTO contracts; **command/query/event/webhook envelopes, OpenAPI + AsyncAPI/event catalogue, version compatibility** (§28) | all apps + packages | The one source of truth for shapes; runtime validation + TS types. Additive versioning; CI backward-compat gates; contract-first mocks. |
| `domain` | Entities, use-cases, orchestration | apps, rules-engine | Pure, framework-free, unit-testable. |
| `rules-engine` | The **18 Customer Rules**, the **Spread Engine** (strike + charge components), allocation (Rule 17), rollover funding (self-funded, Maintain Volume, affordable-volume calc), and the **cross-platform typed rule domains + versioned `RuleDecision`** (§18) | customer, admin, all engines | Encodes everything in the Customer Rules & Cost of Protection docs. Deterministic, domain-owned (not a low-code engine), heavily tested; restricted expression vocabulary, not executable JS/SQL. |
| `ai` | Dynamic pricing, price/basis forecasting, exposure detection, fraud/anti-selection; **provider-neutral orchestration + governance layer, capabilities, model registry, evals** (§27) | rules-engine, admin, all engines | The moat models; feeds the Spread Engine. Human-in-the-loop. Apps never call model providers directly. AI explains/recommends; deterministic engines decide. Tenant-isolated; no external training. |
| `pricing-data` | Provider adapters, immutable observation store, deterministic validation, versioned canonical-quote engine; the three price types (§13) | rules-engine, database, admin | Decouples every engine from any source. Rules Engine quotes only from an eligible canonical Reference Price; settlement only from an eligible Actual Pump Observation (or a labelled simulation). |
| `ledger` | Immutable append-only double-entry journal, typed chart of accounts, balance projections, reconciliation + break queue (§14) | rules-engine, database, admin | The system of record for money and protected quantity. Every balance shown is a projection of the journal, never a directly-mutated number. |
| `fx-engine` | FX reference adapters, canonical-rate selection, versioned `FXAdjustmentDecision`, applied conversions; the four FX types (§16) | rules-engine, ledger, admin | Same decision/lifecycle pattern as the Spread Engine; posts conversions through the ledger's bridge + FX gain/loss accounts. Live cross-currency money movement stays disabled until licensed partners + controls are approved. |
| `hedging` | Exposure aggregation from ledger positions, Black-76 modelled cost, versioned `HedgeRecommendation`, `SimulatedHedgeExecution` (§17) | ledger, ai, admin | **Phase 1 fully simulated** — production-intent contracts, no broker/money/instrument. Calm-state cost reconciles to the DEC-014 1.30% component; later broker/treasury adapter boundaries designed, none connected. |
| `risk` | Graduated risk decisions + case management; signal scoring; holds as ledger states (§19) | rules-engine, ledger, ai, admin | Runtime controls expressed through the Rules Engine. Statistical scoring first, generative AI only summarises. Least-necessary restriction; never confiscates balance. Phase 1 simulated signals; provider adapters can't mutate accounts/ledger. |
| `identity` | The lifecycle entity set (§20): `Principal`, `CustomerProfile`, `Organisation`, `Membership`, `FleetAccount`, `Vehicle`, `DriverAssignment`, `BillingProfile`, `EligibilityProfile`, `ConsentRecord`, `CommunicationPreference`; state machines; KYC/KYB adapter boundaries | all apps, rules-engine, authz | Extends the DEC-031 tenant model. Identity separate from business profile; effective-dated assignments; states not deletion; governed closure. KYC/KYB adapters replaceable, can't mutate ledger. |
| `billing` | Provider-neutral billing contracts; Stripe adapter (processor); Xero adapter (accounting projection); tax separated (§21) | ledger, rules-engine, admin | Ledger stays source of truth — neither provider sets a balance. Webhooks verified/immutable/async → ledger postings. Xero is downstream only. Breaks → DEC-032 queue. Live only in Phase 6. |
| `communications` | Provider-neutral email/push/SMS/in-app adapters; versioned templates; transactional outbox; delivery-state tracking (§22) | ledger, rules-engine, identity, admin | Required notices never gated by marketing consent. Outbox commits with ledger/rule state atomically; idempotent. Sensitive data kept out of push/SMS/subject lines. Phase 1 delivery simulator. |
| `privacy` | Versioned retention-policy matrix (data class × jurisdiction × entity × purpose); privacy-rights case workflows; disposal/anonymisation orchestration; legal-hold register (§23) | identity, ledger, database, admin | Statutory periods deferred to the legal-retention matrix. Deletion spans primary/search/vectors/caches/downstream; ledger/audit preserved where law requires. AI training opt-out. |
| `observability` | Traces/metrics/structured logs; correlation IDs; SLIs; multi-dimension severity; auto-incidents; executable runbooks; scoped kill switches; backup/PITR/recovery (§24) | all apps + packages, admin | Correlation across the whole money pipeline. Never logs secrets/tokens/KYC. Kill switches stop new activity only. RTO/RPO per capability; deterministic ledger rebuild proven. Phase 1 rehearsed. |
| `analytics` | Versioned metric registry; KPI definitions + lineage; governed dashboards, aggregates and exports; scenario KPI snapshots (§26) | ledger, rules-engine, demo-data, admin | Dashboards consume governed metrics, never re-derive. Financial KPIs reconcile to the ledger + model. Actual vs simulated never combined without a visible split. Quality state shown beside every value. |
| `database` | Supabase client (fetch/PostgREST), schema, migrations, safeguarded-funds ledger; **domain schemas, DB roles, RLS, expand/contract migrations, PITR/recovery, data-quality checks** (§29) | all apps | Extends today's `lib/store.ts` / `lib/supabase.ts`. Sole DB access path — no ad-hoc clients. Constraints enforce financial/lifecycle invariants. Service-role never in a browser. |
| `ui` | Brand tokens, shared components | all apps | Space Grotesk/Inter, emerald palette. |
| `config` | tsconfig base, eslint, tailwind preset, env schema | all apps + packages | Removes per-app config drift (the source of the earlier build break). |
| `demo-data` | Scripted demonstrator scenarios (reference/strike/charge, spike, rollover) | admin, demo | Matches the Investor Demonstration Narrative & the worked examples. |

---

## 4. Tooling

- **Workspaces:** pnpm workspaces (recommended) or npm workspaces, with **Turborepo** for
  task orchestration and caching.
- **TypeScript:** a shared `tsconfig.base.json` with path aliases per package; each app/package
  extends it. (This also prevents the class of build break already seen, where one app's
  `tsconfig` swept in another's files.)
- **Render:** one service per app, each with its **Root Directory** set to the app folder, and
  **changed-paths / ignored-build filters** so a service only rebuilds when its app or a package
  it depends on changes.

---

## 5. Migration plan (staged, with a green build/deploy gate at each step)

> Each step is committed and deployed before the next begins. Do not proceed if a build or
> deploy is red.

**Step 0 — Scaffold (non-breaking).**
Add the workspace root (`package.json` workspaces, `turbo.json`, `tsconfig.base.json`) and empty
`apps/` and `packages/` folders. The existing app keeps building from the repo root. No moves yet.

**Step 1 — Move the customer app.**
Move today's app (`src/`, its `package.json`, config) into `apps/customer/`. Update the existing
Render service's **Root Directory → `apps/customer`**. Verify build + deploy green, app reachable.

**Step 2 — Move the marketing app.**
Move the **in-repo `landing-page/` → `apps/marketing/`** (the strongest source, per §1). Update
the `fuelcap-web` Render service's **Root Directory → `apps/marketing`**. Verify build + deploy
green, site reachable. Keep the old `landing-page/` path in the repo until parity is confirmed.

**Step 3 — Extract shared packages (incrementally).**
Start with the fully-specified ones: `contracts`, then `domain`, then `rules-engine` (port the
18 rules + Spread Engine + allocation + rollover from the Customer Rules / Cost of Protection
docs). Then `database`, `ui`, `config`, `ai`, `demo-data`. Move code a package at a time; keep
both apps green.

**Step 4 — Build the admin Control Room.**
Scaffold `apps/admin` (operator dashboard: exposure, governed AI-recommendation approve/reject
with audit lineage, executive dashboard) on top of `contracts` + `domain` + `rules-engine` + `ai`.

**Step 5 — Cleanup (SEPARATELY APPROVED).**
Only after parity is verified across all surfaces: archive the sibling `landing-page/`, remove the
now-superseded in-repo `landing-page/` path, and delete any remaining duplicates.

### Preservation & safety rules during migration

- **Preserve originals** until parity (build + deploy + visual QA) is verified for the moved app.
- **Mark superseded copies read-only / deprecated** (e.g. a `DEPRECATED.md` in the folder) during
  the transition so no one edits the wrong copy.
- **No duplicate deletion** except under the Step 5 cleanup, approved separately.
- **Secrets** (`.env.local`, Render env vars) are re-pointed per app; never committed.

---

## 6. Source control & environment promotion

### Branching & review
- `main` is **protected**: no direct implementation commits — changes land only via PR with green checks. Require PR review (CODEOWNERS) even for solo work ("PR + green checks, no direct push").
- Migration work happens on a dedicated **`migration/monorepo`** branch; each migration step is a **separate, reviewable PR / checkpoint commit**.

### Required checks (CI, per PR)
`install → lint → typecheck → unit tests → contract tests → application build → smoke test`. Run affected-only via Turborepo for speed, but require the full set to pass before merge. Add a **secret scanner** (e.g. gitleaks) that fails on any detected secret.

### Promotion sequence
`local → Render preview/staging → production`. Update **only one Render service per migration step**, and require a **successful production smoke test** before beginning the next physical move.

**Smoke test — defined per app:**
- **customer:** health route responds + a market page renders;
- **marketing:** `/uk` renders + a signup POST writes to the **staging** database;
- **admin:** dashboard loads + one governed-action round-trip.

### Gates, tags & rollback
- Tag every green gate: `monorepo-customer-green`, `monorepo-marketing-green`, … and a final `monorepo-migration-complete`.
- **Per-step rollback runbook:** `git revert` the move commit → reset the Render service **Root Directory** to the recorded previous value (see §7) → re-tag. Originals stay in place until parity is verified, so rollback is always available.

### Environment & secrets
- **Never share production secrets with preview.** Maintain separate env-var sets per environment.
- **Preview/staging uses a non-production Supabase project** (or a seeded copy) — never production credentials — so migration testing cannot touch real customer funds or data.

### Database migrations (expand / contract)
- Every migration is **backward-compatible and independently reversible**. Use **expand → migrate → contract**: ship the additive change first, deploy and verify, then remove the old shape in a later step — never a destructive migration in the same deploy as the code that depends on it.
- Gate production migrations behind a **manual approval**.

### Cleanup gate
- **No stale application deletion** until **both** customer and marketing have passed production-equivalent verification **and** cleanup is separately approved (ties to §5, Step 5).

## 7. Deployment impact (Render)

| Service | Today (Root Directory) | After migration |
|---|---|---|
| `fuel-cap-1` (customer app) | repo root | `apps/customer` |
| `fuelcap-web` (marketing) | `landing-page` | `apps/marketing` |
| `fuelcap-admin` (new) | — | `apps/admin` |

Cloudflare mapping is unchanged in principle: `fuelcap.tech` / `www` → marketing; `app.fuelcap.tech`
→ customer; add `admin.fuelcap.tech` → admin. Update each service's Root Directory as its app moves
(Steps 1–2, 4), one at a time.

---

## 8. Risks & rollback

- **Risk:** a moved app fails to build/deploy under its new Root Directory. **Rollback:** revert
  the move commit and the Render Root Directory change; the previous path still exists (originals
  preserved) until parity is confirmed.
- **Risk:** package extraction introduces circular deps. **Mitigation:** `contracts` and `domain`
  never import apps; enforce with lint boundaries.
- **Risk:** config drift causes one app to compile another's files (already seen once).
  **Mitigation:** the shared `config` package + per-app `tsconfig` `exclude`.

---

## 9. Open decisions (to confirm before Step 0)

- pnpm vs npm workspaces (recommend **pnpm**).
- Whether `rules-engine` is its own package or part of `domain` (recommend **its own**, given how
  central and heavily-tested the pricing/rollover logic is).
- Naming: `apps/customer` vs `apps/app` (recommend **customer** for clarity vs `admin`/`marketing`).

## 10. Demo-data governance & scenario versioning

Canonical demonstrator scenarios live in `packages/demo-data`. They must be repeatable to the
cent and honest by construction.

### Principles
- **Deterministic, seeded generators.** The same scenario always produces the same customers,
  prices, transactions, ledger balances and dashboard totals (seed + fixed simulated clock).
- **Contract-conformant records.** Every record conforms to the production API/DB contracts
  (`packages/contracts`) — no UI-only fake objects. What the demo shows is what production produces.
- **Goldens computed by the real engine.** Expected results are produced by running each seeded
  scenario through the actual `rules-engine` + `contracts`, then snapshotted — never hand-typed.
  The goldens therefore **equal the worked figures** in Cost of Protection §5.3 and Customer Rules
  Examples 11–14 (one source of truth: docs ↔ demo-data ↔ engine).
- **Injected clock.** A dependency-injected clock (never scattered `Date.now()`) lets scenarios set
  and advance a simulated time so expiry, rollover, settlement and alerts fire deterministically.
- **No real data.** No real customer data, secrets or copied production identifiers, ever.

### Scenario identity & manifest
- Each scenario has an **immutable ID + semantic version**, e.g. `market-spike-us@1.0.0`.
- A **manifest** records: seed; simulated clock; market; currency; units; `provenance` method;
  applicable rules; expected outcomes (golden ref); and `compatibleContractVersion`.
- **Provenance enum** (required at record *and* interface level, plus a visible "Demonstrator data"
  badge): `synthetic-seeded` · `historically-derived` · `illustrative-fixed`. For FX scenarios the
  rate is fixed in the manifest.

### Golden results & CI gates
- Maintain **golden expected results** for ledger balances, protection exposure, FuelCap economics
  and dashboard KPIs.
- **Fail CI** when a contract or calculation change causes an *unexplained* scenario-output
  difference (snapshot drift).
- **Contract-compat gate:** fail if a scenario's `compatibleContractVersion` no longer covers the
  current `contracts` version.
- **Intentional changes** are permitted **only** by bumping the scenario's semantic version and
  approving the updated goldens.

### Initial scenario library (v1)

| # | Scenario ID (example) | Exercises |
|---|---|---|
| 1 | `flat-market-us@1.0.0` | baseline pricing |
| 2 | `rise-in-boundary-us@1.0.0` | Cost of Protection §5.3 Case A |
| 3 | `boundary-breach-us@1.0.0` | §5.3 Case B |
| 4 | `falling-price-us@1.0.0` | §5.3 Case C |
| 5 | `partial-multi-lock-us@1.0.0` | Customer Rules Examples 4 + 11 (allocation) |
| 6 | `auto-rollover-rise-fall-us@1.0.0` | Examples 12 & 13 |
| 7 | `no-valid-quote-us@1.0.0` | Rule 18 / Example 5 |
| 8 | `eligibility-fraud-fail-us@1.0.0` | Rule 10 |
| 9 | `insufficient-funds-us@1.0.0` | Rule 13 / Example 14 |
| 10 | `fleet-multi-vehicle-us@1.0.0` | Example 9 (B2B) |
| 11 | `fx-movement-ca@1.0.0` | multi-currency (USD/CAD/GBP/EUR) |
| 12 | `multi-customer-exposure@1.0.0` | demo beats 5–6 (AI recommendation) |

---

## 11. Admin identity & authorisation (Control Room)

The `apps/admin` Control Room governs money, pricing, risk and customer state, so it uses
enterprise-grade identity and access control. Consistent with §6 (per-environment identities) and
the Customer Rules audit/lineage discipline.

### Identity
- **Named admin accounts only** — no shared operator logins. **MFA required** for every administrator.
- **Use a managed identity provider** (SSO / OIDC) with MFA enforced centrally and **SCIM
  joiner-mover-leaver** provisioning, so offboarding revokes access everywhere at once. Do not
  hand-build admin auth.
- **Separate identities and permissions across preview, staging and production.** The
  **Demonstrator Presenter** role exists **only** in demo/staging (with demo-data); production has
  no such role.

### Authorisation model
- **RBAC + ABAC:** role permissions combined with contextual rules — market, legal entity, customer
  group and transaction-value bands. **Default to least privilege and explicit denial.**
- **Authorisation as code:** encode the model as a versioned policy (a `packages/authz`, or in
  `domain`), evaluated server-side on every action, producing deterministic audit records.
- **Permission verbs are separated:** `view · recommend · initiate · approve · execute · export`.

### Roles (initial)

| Role | Purpose | Typical verbs |
|---|---|---|
| Platform Administrator | System config, user/role management | manage-config (maker-checker); no direct money movement |
| Operations | Day-to-day operations | view, initiate |
| Risk & Treasury | Exposure, hedging, limits | view, recommend, initiate, approve (risk), execute-within-limits |
| Finance & Reconciliation | Ledger, settlement, reconciliation | view, initiate, approve (finance), export |
| Compliance & Fraud | KYC/AML, restrictions, fraud | view, initiate, approve (compliance) |
| Customer Support | Member assistance | view, initiate (limited) |
| Data & Integrations | Feeds, integrations, exports | view, export (gated) |
| Read-only Auditor | Oversight | view, export (read-only) |
| Demonstrator Presenter | Run rehearsed simulated scenarios (demo/staging only) | operate-demo; no config, no production |

### Governed actions & segregation of duties
- **Maker-checker approval required** for: money movement; pricing/rule publication; exposure-limit
  changes; customer-restriction removal; bulk actions/exports.
- **No self-approval** — a user can never approve their own governed action.
- **Explicit SoD conflict matrix:** the same person cannot hold `initiate` and `approve` for money
  movement in the same entity; Treasury execution is separate from Finance/Reconciliation. Enforced,
  not advisory.
- **Step-up MFA** on high-value governed actions (approving money movement, publishing pricing/rules);
  short session lifetimes and idle timeout.
- **AI may recommend or prepare** an action but **cannot approve itself or bypass the same controls**
  (human-in-the-loop; consistent with the "no admin override on invalid pricing" rule).

### Elevation, break-glass & audit
- **Just-in-time elevation:** time-limited privilege elevation with a reason, an expiry and a complete
  audit trail.
- **Break-glass:** emergency access with MFA, an explicit reason and **immediate alerting**; use
  **auto-opens an incident**, credentials **rotate after use**, and it is **reviewed within a fixed
  SLA**. It still **cannot override invalid pricing or fabricate a quote**.
- **Audit everything:** every access decision, attempted denial, approval step and resulting state
  change is recorded — one system of record shared with customer-action lineage.

### Identity provider (decision)

- **Preferred: WorkOS AuthKit**, subject to a short technical + commercial **proof of concept**
  before production commitment. It provides OIDC/SAML enterprise SSO, MFA + step-up authentication,
  **Directory Sync (SCIM)** provisioning/deprovisioning, per-environment application isolation, and
  a natural path for enterprise fleets to connect their own IdPs.
- **Scope:** WorkOS covers `apps/admin` and future **enterprise-fleet SSO**. The **consumer app keeps
  its existing Supabase auth** — two separate identity planes.
- **Boundary (critical):** WorkOS authenticates the principal and supplies current identity assurance
  (`acr` / `amr` / `auth_time`). **`packages/authz` remains authoritative** for roles, SoD, contextual
  permissions and governed actions — the IdP never makes authorisation decisions.
- **Fallback: Auth0** — a validated alternative (also supports step-up auth and inbound SCIM), used
  only if the PoC finds a WorkOS commercial or implementation limitation.
- **Commercial note:** AuthKit is free to ~1M MAU; enterprise **SSO + Directory Sync are billed per
  connection** (≈$125/mo each for the first ~15), so cost scales with the number of enterprise fleets
  connecting their own IdPs — model this at fleet scale in the PoC and price it into enterprise deals.
- **PoC checklist:** step-up returns a **readable assurance claim** `packages/authz` can gate on;
  Directory-Sync attributes map to authz claims (roles not baked into the IdP); per-environment
  app/credential/session isolation; per-connection cost at fleet scale; SOC 2 / data residency for the
  safeguarding posture.

---

## 12. Organisation & tenant boundaries

Logical multi-tenancy is built **now** — B2B fleets need strict separation from day one (the SME/fleet
persona), giving consistent policy scope and future enterprise readiness. Not speculative infrastructure.

### The tenant = the organisation
- Every customer account is an **organisation**. A **consumer is a single-member personal organisation**;
  a **fleet is a multi-user organisation** containing vehicles, drivers, policies and cost centres.
  Everything is an org → one code path.
- **FuelCap internal administration is not a customer tenant.**
- **`organisation_id` is required on every customer-owned record, event and ledger projection.**

### Separate dimensions (do not overload the tenant id)
- Keep `legal_entity`, `market`, `currency` and `environment` as **independent dimensions**; the tenant
  id carries **no** regulatory meaning — an org can operate across markets/entities.
- Fleet rules, spread groups, vehicle policies, limits, billing and reporting are **scoped to the
  organisation** (maps to the ABAC *customer group* dimension in §11).

### Isolation (defence in depth, server-side)
- Enforced in three layers: **`packages/authz`** (deny by default) + **database Row-Level Security** +
  **tenant-aware repository methods**.
- **RLS keyed off a request-scoped tenant claim** is the non-bypassable backstop: set the active-org
  context per request so isolation holds even if a repository forgets to filter. This is what defeats
  guessed/supplied identifiers (IDOR/BOLA) — a fleet admin can never reach another fleet.
- **Cross-organisation views** only for explicitly authorised FuelCap roles and **governed aggregate
  operations** (e.g. Risk & Treasury exposure across the book), ideally over aggregated/pseudonymised
  data, fully logged. **Every action records the acting principal and the affected organisation.**

### Membership & IdP mapping
- Membership is **many-to-many**: a principal may belong to several orgs (a personal consumer org *and*
  fleet-admin rights; an operator supporting many), with a **role per org**. The **active organisation**
  is part of the session/authz context.
- Map WorkOS **Organizations** (an SSO grouping) to our **tenant orgs** explicitly — do not conflate the
  IdP's org concept with our billing/tenant boundary.

### Data placement (shared now, movable later)
- **One shared database initially** — no per-customer database or schema.
- Design an **optional placement key** resolved in `packages/database`
  (`tenant_placement(org) → {connection, region}`, default "shared"). Domain **contracts take
  `organisation_id`, not a connection**, so later moving a regulated/very-large tenant to a dedicated
  DB/region is a **data migration + placement flip, not a contract change**.

### AI carries the tenant boundary
- AI **retrieval, prompts, caches, embeddings and generated recommendations** all carry the same
  `organisation_id`, enforced at the datastore: **tenant-scoped vector namespaces/collections**, cache
  keys prefixed with `organisation_id`, retrieval filters applied server-side (never trusted to the
  prompt), and no cross-tenant context in a single prompt — preventing leakage via the AI layer.

### Testing
- Automated **cross-tenant-access tests** (attempt guessed/supplied IDs, assert denial) are part of the
  §6 required checks.

---

## 13. Fuel-price observation & canonical-quote architecture

Every quote and every settlement resolves against an authoritative price. That resolution is a
**first-class, auditable subsystem** — `packages/pricing-data` — not an inline call to a vendor API.
Engines never talk to a source directly; they consume typed, eligibility-flagged outputs. This keeps
the honesty guarantees (no fabricated prices, no silently mixing an actual pump price with a regional
benchmark) enforceable **by construction** rather than by convention.

### Provider adapters (never couple engines to a source)
- Each source has an **adapter** behind one interface. Adapters **normalise into a single internal
  schema** — currency, per-litre vs per-gallon, grade, tax inclusion — so no engine ever sees a
  provider's raw shape. Adapters are swappable; adding or replacing a provider is an adapter change,
  not an engine change.

### Immutable observation store
Every incoming observation is written **append-only** and never mutated, capturing:
provider + source record ID · station, geography + fuel grade · observed price, currency + unit ·
source timestamp + ingestion timestamp · tax inclusion · provenance · **licence / use
classification** · raw-payload hash · validation + quality status.
**Conflicting observations are preserved and *selected* among — never overwritten.**

### Sources (launch + demonstrator)
| Market | Source | Nature | Highest eligibility |
|---|---|---|---|
| **UK (primary)** | GOV.UK **Fuel Finder** — time-stamped station + grade data; stations must report changes within **30 minutes** | Station-level, near-live | **Settlement** (confirmed actual) |
| **US (demonstrator benchmark)** | **EIA** weekly retail gasoline/diesel series | Regional, weekly — **not** a live pump observation | **Reference / display / simulation** only |
| **EU (demonstrator benchmark)** | European Commission **Weekly Oil Bulletin** | Country-level, weekly | **Reference / display / simulation** only |
| **Canada** | Authoritative federal/provincial benchmark + any licensed station-level provider — **selected during a dedicated provider PoC** | TBD | **No scraping of consumer sites without confirmed reuse rights** |

The US and EU weekly series are **authoritative but regional/weekly**, so they can anchor reference
pricing, display and simulation — they **cannot be represented as an actual pump observation**.

### Deterministic validation (rules decide; AI only flags)
Every observation is validated for **freshness, grade/unit/currency correctness, plausible movement,
duplicate/conflicting records and geographic coverage**. Validation is **deterministic and versioned**.
**AI may flag anomalies and recommend investigation, but deterministic validation rules decide quote
eligibility** — consistent with §11 (no admin override on invalid pricing).

### The versioned canonical-price decision
Selection produces an immutable, **versioned** decision record — never an overwrite — containing:
selected observation(s) · **selection algorithm + version** · normalisation + tax treatment ·
confidence + freshness · **rejected candidates + reasons** · market/grade/geographic scope · and the
**eligibility flag: quote / settlement / display-only / simulation-only**. Eligibility is **bounded by
the licence/use class of the inputs** — a benchmark-only feed can never yield a settlement-eligible
actual price; unconfirmed-reuse or scraped data is simulation-only or excluded.

### Three separate outputs (enforced by the type system)
These are **three distinct types in `packages/contracts`**, not one record with a mode flag — so
"never silently combine an actual price with a regional benchmark" is a **compile-time guarantee**:

1. **`ActualPumpObservation`** — an eligible, confirmed station price.
2. **`ReferencePrice`** — the anchor used to build protection pricing (strike + Spread-Engine charge).
3. **`SimulatedPumpObservation`** — a deterministic demonstrator value carrying a visible
   **"Demonstrator data" provenance** badge (ties to the §10 provenance enum + demo guardrails).

### Engine boundaries
- The **Rules Engine may create a quote only from an eligible canonical `ReferencePrice`.**
- **Settlement may use only an eligible confirmed `ActualPumpObservation`, or an explicitly labelled
  demonstrator `SimulatedPumpObservation`** — never a benchmark dressed up as a pump price.
- **Stale, conflicted or insufficient data activates DEC-021** (the no-valid-quote fail-safe,
  Customer Rules Rule 18 / §5.1): protection expires normally, the full reserved value returns to
  unprotected balance, **no charge is levied, no retroactive debit** occurs when pricing resumes, and
  **administrators cannot force a bad price valid**. This reuses the existing fail-safe rather than
  inventing a new path.

---

## 14. Authoritative ledger & balance management

Money and protected volume are held in an **immutable, append-only, double-entry ledger** —
`packages/ledger`. **No balance is ever a directly-mutated number**; every balance a customer, fleet
or operator sees is a **projection** of the journal. This is what makes funds, protection reserves and
FuelCap economics reconcilable, auditable and tamper-evident, and it is the natural counterpart to the
safeguarding posture and the audit/lineage discipline already required elsewhere.

### Double-entry core
- Every economic event posts a **balanced journal entry** (Σ debits = Σ credits) with full lineage:
  the linked transaction(s), reference price, protection charge and Rules Engine version.
- The journal is **append-only**. **Corrections are new compensating entries, never edits or
  deletes** — the history is permanent.

### Typed chart of accounts + the safeguarding invariant
- A **typed chart of accounts** (customer-owed balances, reserved-for-protection, protection-charge
  revenue split into cost/margin/buffer per DEC-014, pool/hedge, FX gain/loss, breakage, fees).
- **Safeguarding invariant (asserted continuously):** the sum of customer-owed accounts **reconciles
  to the safeguarded bank balance**. A break here is a hard stop, not a warning.

### Money vs quantity, and FX
- **Money is stored in integer minor units** (cents/pence) — never floats. **Protected quantity is a
  4-dp position ledger** (gallons/litres). Both tie to the existing rounding rules (money rounds
  half-up customer-favourable; volume rounds **down**; sub-unit residual → unprotected balance, never
  profit).
- Cross-currency positions post through an explicit **FX gain/loss account** — never by silently
  restating a balance.

### Exactly-once, atomic posting
- Every post carries an **idempotency key with a unique constraint**, so a retried event posts **once**.
- Posting is **all-legs-or-none** (atomic transaction): a partial entry can never exist.

### Tamper-evidence & deterministic projections
- Entries are **hash-chained** (each references the prior) so any retroactive tampering is detectable.
- Balance projections are a **deterministic fold of the journal**: `projection == Σ(journal)`, and can be
  **rebuilt from zero** and must match. Money and quantity projections **cross-reconcile**.

### Governed reconciliation (breaks block, humans clear)
- Reconciliation runs continuously (internal projections vs journal; customer-owed vs safeguarded bank;
  pool/hedge vs positions).
- A **break enters a governed break queue that blocks affected downstream actions**; clearing requires
  **maker-checker** (per §11). **Break-glass cannot override a break or fabricate a balance** — it can
  only widen who investigates.

### Home
- Lives in **`packages/ledger`**, consumed by `rules-engine` (posts protection/settlement events),
  `database` (persistence) and `admin` (reconciliation + finance views).

---

## 15. Spread Engine architecture

The Spread Engine sets the protection charge. It produces a **versioned `SpreadDecision`, never merely
a percentage** — a decision object that is simulated, approved, published, pinned to quotes and
auditable, exactly as pricing that moves real money must be. It sits in `packages/rules-engine`
(alongside the strike/allocation/rollover logic it is part of) and is fed by `packages/ai`.

### The three components (DEC-014, independently auditable)
- Every decision preserves the **three separately-auditable components**: **modelled protection cost**,
  **FuelCap margin**, **reserve/pool buffer**. The **demonstrator default composition stays
  1.30% + 0.70% + 0.30% = 2.30%** of reference; **cost and buffer may respond to volatility and
  exposure**, the margin does not move mechanically with them.
- These map one-to-one onto the ledger's protection-charge revenue split (§14), so a `SpreadDecision`
  and its ledger posting are the same three numbers.

### Policy forms & normalisation
- Supports **percentage-of-reference** *and* **fixed-cents-per-unit** policies.
- **Fixed amounts are normalised by currency and fuel unit** — **never apply cents-per-gallon to
  pence-per-litre** (ties to the §13 single internal schema).

### Precedence hierarchy (applied in order)
1. **Regulatory / product prohibition**
2. **Market & legal-entity limits**
3. **Exposure / volatility adjustment**
4. **Customer or fleet group policy**
5. **Subscription component reductions**
6. **Promotion**
7. **Approved floors, caps & rounding**

- **FuelCap+ removes the 0.70% margin component only** — it never erases modelled protection cost.
  **Promotions may reduce only explicitly authorised components.** (Both sit below limits/exposure in
  the hierarchy, so a discount can never breach a floor or an exposure cap.)

### What each decision records
Inputs · per-component calculations · policy versions · overrides · reason codes · effective period ·
resulting all-in charge. (One source of truth with the demo-data goldens, §10, and the ledger split, §14.)

### Controlled lifecycle
`draft → simulate → maker-checker approval → scheduled/published → superseded/withdrawn`.
- **Published decisions are immutable.** A correction is a **new version**; **existing accepted
  protection keeps its original decision** — repricing is never retroactive (consistent with §14
  immutability and the Customer Rules "no retroactive debit").
- **Quotes pin the exact `SpreadDecision` version, `ReferencePrice` and Rules Engine version** — a quote
  is fully reproducible from the pinned triple.

### Pre-approval simulation & guardrails
- **Impact simulation before approval**, across customers, fleets and markets — expected claims, margin,
  and reserve adequacy.
- Enforce **absolute and relative change limits, minimum protection-cost recovery, and exposure caps**.
- **AI may recommend component changes and explain drivers; deterministic policy validates them and
  authorised humans publish them** (same boundary as §11 / §13 — no AI self-approval, no admin override
  of a floor or an exposure cap).

### Emergency behaviour
- **Emergency withdrawal can stop new quotes** but **cannot rewrite existing customer transactions**.
- **Demonstrator scenarios must reproduce the approved component figures and P&L treatment exactly**
  (goldens computed by the real engine, §10).

---

## 16. FX Engine architecture

Cross-currency conversion is a **first-class, auditable subsystem** — `packages/fx-engine` — built on
the same discipline as pricing (§13/§15) and the ledger (§14): typed inputs, deterministic validation,
a versioned governed decision, immutable history and pinned versions. It is **not** an inline call to a
rates API multiplied into a number.

### Four distinct contract types (enforced by the type system)
Modelled as **four separate types in `packages/contracts`** (same compile-time-separation principle as
the §13 price types), so a raw reference rate can never be silently used as a customer settlement rate:

1. **`FXReferenceObservation`** — a raw rate as received from a provider.
2. **`CanonicalFXRate`** — the selected, validated, versioned rate for a pair.
3. **`FXAdjustmentDecision`** — the governed, versioned customer-rate decision (below).
4. **`AppliedFXConversion`** — a specific conversion actually applied to a transaction/ledger posting.

### Reference adapters & the observation record
- **Frankfurter is the initial demonstrator/reference adapter.** Its rates are **reference inputs, not
  guaranteed executable bank or card settlement rates** — the licence/use class marks them accordingly
  (ties to DEC-033; a reference feed can never be dressed up as an executable rate).
- Every observation records: **currency pair, rate, provider, source timestamp, ingestion timestamp,
  provenance, licence class and raw-payload hash** — append-only, never mutated.
- **Pair direction is normalised explicitly** — the store never infers whether a rate means USD/GBP or
  GBP/USD.

### Functional currency & triangulation
- **One functional currency per FuelCap legal entity**, while **preserving the customer transaction
  currency** (the `legal_entity`/`currency` dimensions from DEC-031, not the tenant id).
- **Triangulation only through an approved pivot currency**, deterministically, with the **complete
  calculation recorded** on the canonical rate.

### Deterministic validation (rules decide; AI only flags)
- **Reject stale, missing, inconsistent or unsupported rates; administrators cannot force them valid.**
- **AI may flag abnormal movements or recommend an adjustment; deterministic rules establish rate
  validity and authorised humans publish policy** (same boundary as §11/§13/§15).
- When FX can't resolve a valid rate for a quote, the quote can't be priced → the **DEC-021 no-valid-quote
  fail-safe** applies; no fabricated rate, no admin override.

### The versioned `FXAdjustmentDecision` (components mirror DEC-014)
Independently auditable components: **reference FX rate · modelled conversion/hedging cost · FuelCap FX
margin · FX reserve/buffer · final customer rate.** These map onto the ledger's typed accounts (§14) the
same way the Spread Engine's cost/margin/buffer do.

### Governed lifecycle (identical to the Spread Engine, §15)
`draft → simulate → maker-checker approval → publish → supersede/withdraw`.
- **Simulate the effect on customers, margins, reserves and legal entities before publishing** a changed
  FX policy.
- **Pin the canonical rate, adjustment-decision and algorithm versions to every affected quote and ledger
  conversion** — fully reproducible.
- **Never recalculate a historical customer transaction using a later rate** (consistent with §14/§15
  immutability). Corrections are new versions; applied conversions are permanent.

### Ledger integration
- Each conversion executes as **balanced source- and destination-currency ledger transactions**, through
  the **bridge and FX gain/loss accounts** already defined in §14 — never by silently restating a balance.

### Demonstrator & go-live gate
- **Fixed manifest rates for deterministic demonstrations and tests** (ties to the §10 provenance +
  goldens discipline).
- ⚠️ **Live cross-currency money movement stays disabled** until **licensed payment/treasury partners,
  accounting treatment and reconciliation controls are approved** (tracked in DECISIONS.md open items).

---

## 17. Phase 1 mocked Hedging Engine

The Hedging Engine models how FuelCap's protection book would be hedged — `packages/hedging` — with
**production-intent contracts but every Phase 1 position and execution explicitly simulated**. It is the
risk-management counterpart to the pricing/FX engines and follows the same discipline: exposure from real
positions, a versioned governed recommendation, deterministic models, human decision, immutable pinned
history — and a hard demonstrator boundary.

### Exposure from positions, not estimates
- Exposure is built from **accepted protection transactions and remaining quantities in the ledger (§14)**
  — never from dashboard estimates or rounded summaries.
- **Aggregated by:** fuel market & grade · geography & legal entity · currency · strike & maximum
  boundary · expiry / time bucket · customer/fleet concentration · basis-risk category.

### Demonstrator protection strategy (four explicit layers)
Represented as: **retained risk pool · simulated call / call-spread protection · cash/reserve allocation ·
explicit unhedged residual exposure.** The residual is always shown, never hidden.

### The versioned `HedgeRecommendation`
Contains: exposure snapshot · proposed instrument · notional · strike · expiry · estimated premium ·
counterparty · effectiveness · residual exposure · rationale.
- **Black-76 for modelled option cost initially**, with **versioned volatility, curve, rate and basis
  assumptions** (the same pricing basis as Cost of Protection / DEC-005).
- **Calm-state protection cost reconciles to the approved 1.30% Spread Engine component (DEC-014)** — the
  hedge model and the charge model must agree in the base case.

### Deterministic stress cases
Run **price rise within boundary · boundary breach · volatility shock · basis divergence · correlation
breakdown · counterparty failure**, each showing **before/after exposure, expected claim cost, hedge
payoff, residual risk, reserve use and capital impact.**

### Governed lifecycle
`observed exposure → recommendation → simulation → maker-checker approval/rejection → simulated execution
→ monitored position → expiry/close/reconciliation` (the §11 maker-checker + SoD applies; Risk & Treasury
are the deciding roles).
- **AI may detect exposure patterns, explain changes and draft recommendations; deterministic models
  calculate exposure/payoff and authorised Risk/Treasury users decide** (same boundary as §11/§13/§15/§16).

### Hard demonstrator boundary
- A Phase 1 approval creates **only a `SimulatedHedgeExecution`** — it **cannot contact a broker, move
  money or create a real financial instrument.**
- **All positions, counterparties, premiums and executions are labelled demonstrator data** (§10/§23
  provenance + badge).
- **Every recommendation and simulated execution is pinned** to the exposure snapshot, model versions,
  market observations, approvals and scenario version — fully reproducible.

### Future integration & reconciliation
- **Design broker, treasury and hedge-counterparty adapter boundaries now; select/connect none.**
- **Reconcile simulated hedge premium, reserve allocation, payoff and residual exposure into the
  demonstrator ledger (§14) and the unit-economics dashboard** — the hedge P&L ties to the same books.

---

## 18. Cross-platform Rules Engine

`packages/rules-engine` is the **deterministic, domain-owned** decision spine every other engine calls.
It is deliberately **not** a generic low-code engine capable of arbitrary code execution: rules are
versioned configuration in a **restricted expression vocabulary**, never executable JavaScript or
administrator-supplied SQL. It generalises the 18 Customer Rules and Spread-Engine logic into one
governed, replayable evaluator.

### Typed rule domains
Quote eligibility · customer & vehicle eligibility · pricing-data validity · spread & FX limits ·
protection volume & duration · allocation & settlement · rollover & cancellation · fraud & transaction
limits · exposure & hedging controls · billing, refunds & collections · communications & escalation ·
admin authorisation & SoD. Each domain is typed; a rule cannot reach outside its domain's facts.

### Evaluation contract → immutable `RuleDecision`
Every evaluation takes a **versioned facts contract** and returns an immutable **`RuleDecision`**:
outcome · rule-set + rule versions · matched **and** failed conditions · reason codes · calculated
values · required follow-up actions · human-readable explanation · evidence references · effective
timestamp. (Reason codes feed the DEC-021 taxonomy and the customer-facing templates below.)

### Deterministic precedence
`prohibition/invalidity → regulatory/legal entity → risk/fraud → product → organisation/group →
promotion/customer choice → defaults`. (Consistent with the Spread Engine's §15 hierarchy — a promotion
or customer choice can never override a prohibition, a legal-entity limit or a fraud control.)

### Effective dating & immutability
- Supports **effective dating and scheduled activation**, but **never retrospectively changes an accepted
  quote or a posted transaction** (consistent with §14/§15/§16).

### Governed lifecycle (same as pricing)
`draft → validate → simulate against golden scenarios → maker-checker approve → schedule/publish →
supersede/withdraw`.
- **Full regression against all twelve demo scenarios (§10) is required before publication.**
- **Impact comparison** of proposed vs current rules across customers, transactions, exposure, margin and
  operational workload.
- **Emergency rules may stop new activity** but **cannot fabricate validity, rewrite history or bypass
  ledger/reconciliation controls** (§14).

### Publication-time validation
Rule definitions are validated for **types, permitted operators, ranges, conflicts, unreachable branches
and missing fallbacks** at publication time — a rule that can't be reasoned about doesn't publish.

### Pinning & AI boundary
- **Every quote, transaction, governed action and AI recommendation is pinned to the exact rule version
  used** — the reproducible triple extends to rules.
- **AI may draft a proposed rule, explain impacts and identify conflicts. It cannot publish rules or serve
  as the runtime evaluator** (same boundary as §11/§13/§15/§16/§17 — deterministic evaluation, human
  publication).

### Replay & explanations
- **Decision-replay tool:** an operator or auditor can reproduce **exactly why a historical outcome
  occurred**, from the pinned facts + rule versions.
- **Customer-facing explanations use approved plain-language reason templates**, while the full technical
  evidence remains available internally.

---

## 19. Fraud, abuse & transaction-risk management

A dedicated **risk-decision and case-management domain** — `packages/risk` — with **runtime controls
expressed through the DEC-037 Rules Engine** (risk is a rule domain, not a parallel engine). It follows
the same discipline as the rest of the platform: deterministic scoring, a graduated typed outcome, an
immutable recorded decision, human review for material actions, and a hard demonstrator boundary.

### Graduated outcomes (never one vague "blocked")
**Allow · allow with monitoring · step-up verification · temporarily hold the affected action · decline
the transaction · restrict new protection · restrict withdrawal · refer to human review.** There is **no
single "account blocked" state** — each outcome names the exact capability affected and its scope.

### Signals
Identity/KYC status · device & session changes · payment failures · velocity · location impossibility ·
station/grade mismatch · repeated boundary exploitation · linked accounts · fleet-card misuse · unusual
withdrawals · promotion abuse. **Statistical anomaly scoring runs first; generative AI is used only to
summarise evidence or assist investigation** — never as the deciding authority (consistent with §11/§18).

### The recorded decision
Every decision records: signal values · rule/model versions · confidence · reason codes · action scope ·
duration · evidence · appeal/review route. (Reason codes align with the DEC-021 availability/eligibility
taxonomy and the §18 plain-language templates.)

### Proportionality & holds
- **Restrictions apply only to the minimum necessary capability.** A suspicious fuel transaction must
  **never silently confiscate or erase the customer's balance** — money integrity (§14) is preserved.
- **Temporary holds are explicit ledger states** with **defined expiry and release rules** (§14 governed
  states), not ambient flags.

### Human review & case workspace
- **Human review is required** for material or prolonged customer restrictions, withdrawal blocks and
  KYC/fraud ineligibility (§11 maker-checker).
- A **case workspace** provides an evidence timeline, linked entities, investigator notes, recommended
  action, maker-checker approval and complete audit history.
- **Free text and uploaded evidence are untrusted input** — isolated from system instructions and tool
  execution (no prompt-injection path from evidence into actions).

### Fairness & monitoring
- Monitor **false-positive rate, review time, loss avoided, customer impact, rule drift and model drift**
  by market and customer segment.
- **No protected-attribute use; test for discriminatory proxy effects.**
- Customers receive **approved plain-language explanations and a review route** where legally or
  contractually required.

### Demonstrator & adapter boundary
- **Phase 1 uses deterministic simulated signals and rehearsed cases** — no live KYC, device-intelligence
  or fraud providers (§10 provenance + badge).
- **Future provider adapters remain replaceable and cannot directly mutate accounts or ledger state** —
  they feed signals; the Rules Engine decides and the ledger records.
- **Emergency fraud controls may stop new activity** but **cannot fabricate price validity, rewrite
  transactions or bypass safeguarding reconciliation** (§14).

---

## 20. Customer, fleet, driver & vehicle lifecycle

The account model — `packages/identity` — completes the DEC-031 tenant primitives into the full entity
set, with **identity kept separate from business profile** and **explicit lifecycle states instead of
deletion**. Contracts live in `packages/contracts`; state transitions run through the DEC-037 Rules Engine
and are scoped by DEC-029 authorisation.

### Entities (identity ≠ profile)
`Principal` (authenticated human/service identity) · `CustomerProfile` (personal & contact details) ·
`Organisation` (personal or fleet tenant) · `Membership` (principal↔organisation) · `FleetAccount` ·
`Vehicle` · `DriverAssignment` · `BillingProfile` · `EligibilityProfile` · `ConsentRecord` ·
`CommunicationPreference`. A `Principal` maps to the appropriate identity plane (DEC-030: WorkOS for
workforce, Supabase for consumer) and is **never duplicated** across the personal org and one or more
fleets a person belongs to.

### Lifecycle states (never delete)
- **Customer/organisation:** prospect → onboarding → pending verification → active → restricted →
  suspended → closed.
- **Vehicle:** pending → active → restricted → retired.
- **Membership / driver assignment:** invited → active → suspended → ended.

### Temporal integrity
- Driver/vehicle assignments are **effective-dated with full history** — the system **never overwrites who
  controlled a vehicle at transaction time** (essential for settlement attribution and fleet lineage;
  same immutability principle as §14).

### B2C vs B2B
- **B2C identity/KYC** is separated from **B2B organisation/KYB**, authorised representatives and future
  beneficial-owner checks.
- **Fleet administrators** manage vehicles, drivers, cost centres, limits and group policies **only within
  their own organisation** (DEC-031 isolation). **Drivers** receive only the access to use assigned
  vehicles/cards and view permitted transactions.
- Country, state/province, currency, tax and regulatory applicability are **stored explicitly** (the
  independent dimensions from DEC-031, not overloaded onto the tenant id).

### Consent & versioning
- **Consents, terms acceptance, privacy choices and Auto-Rollover acceptance are versioned** with exact
  text/hash, channel and timestamp (ties DEC-022's disclosure requirement to an auditable record).

### Governed closure & data rights
- **Closure stops new activity but preserves ledger, protection, consent and audit history** for retention
  and reconciliation.
- An organisation **cannot close while safeguarded funds, unresolved breaks, active protection, open cases
  or statutory holds remain** — a **governed closure workflow** (ties to §14 breaks + §19 cases).
- **Data correction/deletion requests preserve legally required financial/audit records** while removing or
  anonymising data that no longer needs retention.

### AI boundary & demonstrator
- AI may **summarise customer history, identify missing onboarding evidence and propose next actions**. It
  **cannot change eligibility, merge identities, close accounts or reassign vehicles without governed
  approval**.
- **Phase 1 uses contract-shaped simulated customers and fleets** covering personal, multi-vehicle,
  multi-role and restricted-account scenarios (§10 provenance).

---

## 21. Billing, Stripe & Xero boundaries

`packages/billing` holds **provider-neutral contracts** with **separate Stripe and Xero adapters**. The
governing rule: **the FuelCap ledger (DEC-032) remains the financial source of truth** — **Stripe is the
payment processor, Xero the accounting/reporting destination, and neither provider determines the
customer's authoritative FuelCap balance.**

### What is modelled separately
Customer funding/deposits · FuelCap+ subscriptions · B2B invoices & credit terms · protection charges ·
refunds & withdrawals · failed payments & collections · taxes · processor fees · accounting exports. Each
is a distinct concept, not a single "payment" blob.

### Stripe boundary (processor)
- Stripe commands use **FuelCap idempotency keys** (DEC-032 exactly-once) and **persist the external
  object ID**.
- Webhooks: **verify signatures, store payloads immutably, deduplicate events, process asynchronously.**
- A **Stripe success event creates/reconciles the appropriate ledger posting — it never directly mutates a
  balance.**
- **Missing, duplicated, delayed and out-of-order webhooks are normal recoverable states**, not errors.
- **Reconcile Stripe objects and payouts against the processor-clearing ledger accounts.**
- **Phase 1 uses Stripe test mode only**, with contract-shaped simulated payments where a test-mode flow is
  unavailable.
- **FuelCap+ subscription discounts are modelled by component**, preserving **DEC-014**: zero spread
  removes the margin, **not** the protection cost.

### Xero boundary (downstream accounting projection)
- Export approved **invoices, payments, fees, journals and credit notes**; store **Xero IDs and export
  status**.
- **Xero never overwrites transaction or ledger history.** **Corrections originate as FuelCap
  reversals/replacements** (DEC-032) and then sync outward.
- A **mapping table** links FuelCap's typed chart of accounts (DEC-032) to Xero's chart. **Maker-checker
  (DEC-029)** is required for mapping changes, bulk exports, write-offs, manual credits and sensitive
  refunds.

### Reconciliation, tax, AI & go-live
- Failed or mismatched Stripe/Xero records go to the **DEC-032 reconciliation-break queue**; affected
  downstream actions are **blocked until cleared**, and **break-glass cannot manufacture reconciliation**.
- **Tax calculation is separated** from payment processing and accounting; store **jurisdiction, tax basis,
  rate, source and decision version**.
- **AI may categorise breaks, identify likely matches and draft collection communications; it cannot post,
  write off, refund or clear a break.**
- **Live Stripe or Xero connections are enabled only in Phase 6; Phase 1 remains demonstrator/test-mode
  only** (DEC-001).

---

## 22. Notifications, consent & customer communications

`packages/communications` holds **provider-neutral email, push, SMS and in-app adapters**. The governing
rule: **required notices are never gated by marketing consent** — communication is organised by class, and
consent controls only marketing.

### Communication classes
Legally/operationally required · transactional · security/fraud · service advisory · marketing.
**Marketing consent must never control delivery of required balance, protection, rollover, security or
account-status notices.**

### Templates & records
- **Every template is versioned by market, language, channel and purpose.**
- Each send stores: the **exact rendered message or immutable content hash**, template version, data inputs,
  recipient, channel, timestamp and governing event (audit parity with §14/§18).

### Delivery integrity
- **Transactional outbox:** ledger/rule state and required-notification intent **commit atomically**
  (DEC-032) — a settlement or rollover can't post without its required notice being enqueued, and vice versa.
- **Idempotency key on every communication** prevents duplicate rollover, settlement or failure notices.
- **Track** queued · sent · delivered · bounced · failed · opened (where legally permitted) · acknowledged
  (where required).
- **Retry transient failures with bounded backoff;** exhausted failures move to an **operational queue**.
- **Approved fallback channels** are attempted for critical notices, respecting channel availability and
  legal consent.

### Safety, localisation & timing
- **No sensitive balances, identity evidence or fraud detail** in lock-screen push text, SMS, or email
  subject lines.
- **Localise** for US, Canada and UK terminology, currency, fuel units, dates and legal wording.
- **Quiet hours** apply to non-urgent communications; **security, imminent expiry and legally-timed notices
  follow approved exceptions** (the DEC-022 48–72h expiry notices are timed, not quiet-hour-suppressed).

### Preferences, AI & demonstrator
- **Customer preferences are effective-dated and tenant-aware** (DEC-039). **Fleet administrators may
  configure operational channels but cannot suppress legally required driver/member notices** (DEC-031
  isolation).
- **AI may draft/improve template variants and summarise communication history. It cannot send messages,
  alter consent, invent transaction facts or bypass template approval.**
- **Inbound replies and free text are untrusted input** — isolated from tools, policies and automated
  actions (same posture as §19).
- **Maker-checker (DEC-029)** for required-notice templates, adverse-action wording and bulk campaigns.
- **Phase 1 uses a delivery simulator** showing channel, message, timing and outcome **without contacting
  real customers** (§10 provenance).

---

## 23. Data retention, privacy rights & records management

`packages/privacy` holds a **versioned retention-policy matrix** keyed by **data class × jurisdiction ×
legal entity × processing purpose**, plus the privacy-rights case workflows and disposal orchestration.
**No single universal retention period is hard-coded** — final periods require **legal/accounting approval
for the US, Canadian provinces and UK** (deferred to the jurisdictional legal-retention matrix).

### Data classes
Identity/KYC/KYB evidence · customer & fleet profiles · ledger & safeguarding records · quotes, protection
& settlement records · pricing observations & provenance · fraud cases & restrictions · communications &
consent · admin audit/security logs · AI prompts, retrieval context & outputs · provider webhook payloads ·
analytics & telemetry. Each record carries **lawful/contractual purpose, retention trigger, review date,
disposal method and legal-hold status.**

### Minimisation & protection
- **Minimise collection;** separate **highly sensitive identity evidence** from routine operational data.
- **Encrypt in transit and at rest**, with **managed key rotation** and tightly controlled access.
- **Field-level protection / tokenisation** for especially sensitive identifiers.

### Privacy-rights workflows (governed cases)
- Support **access, correction, portability, objection/restriction and deletion** through a **governed
  privacy case** (case discipline as in §19).
- **Exports come from authoritative records** with **tenant isolation (DEC-031)** and **maker-checker
  (DEC-029)** for sensitive or bulk disclosures.

### Deletion, preservation & holds
- Where deletion is permitted, **delete or irreversibly anonymise across primary storage, search, vectors,
  caches and downstream processors** — not just the primary row.
- **Preserve ledger/audit evidence** where law or safeguarding (§14) prevents deletion, while **removing
  unnecessary identifying attributes** where possible (consistent with DEC-039).
- **Legal holds suspend disposal for the precise records and purpose involved** — never an unlimited blanket
  retention.
- **Backups have documented expiry and eventual purge;** deleted data **must not silently re-enter
  production during restoration**.

### AI, audit & demonstrator
- **AI training is opt-out by default:** FuelCap customer/admin data **must not train external foundation
  models**. **AI prompts and vector records inherit the underlying tenant, sensitivity and retention
  classification** (DEC-031 AI isolation).
- **Every privacy search, export, correction, restriction and deletion decision is recorded** in the audit
  trail.
- **Phase 1 uses synthetic data only**, but the **production-intent retention metadata and workflows are
  still demonstrated** (§10 provenance).

---

## 24. Observability, incident response & operational resilience

`packages/observability` instruments **applications, engines, adapters and workers** with consistent
**traces, metrics and structured logs**, and owns incident response, kill switches and recovery. It makes
every guarantee elsewhere in the platform observable and operable.

### Correlation & safe context
- **Correlation IDs carry across** quote → protection → ledger → settlement → communication →
  accounting/hedging projections — one thread through the whole money pipeline.
- Attach **organisation, environment, legal entity, rule/model version and scenario identifiers** where safe.
- **Never log** secrets, authentication tokens, full payment data, KYC documents or unrestricted customer
  text (DEC-042).

### Service-level indicators
Quote availability & latency · pricing-data freshness & coverage · ledger posting/reconciliation integrity ·
rollover completion · payment/webhook processing · communications delivery · governed-action completion ·
AI recommendation availability & quality.

### Severity & incidents
- **Separate severity dimensions:** technical outage · customer-money risk · data/privacy risk · pricing
  integrity · regulatory impact (a small outage with money risk outranks a large cosmetic one).
- **Auto-open incidents** for: multi-customer quote failure · safeguarding mismatch · ledger-invariant
  failure · cross-tenant denial anomaly (DEC-031) · reconciliation backlog · suspicious bulk export
  (DEC-042) · AI control breach.
- **Executable runbooks** with owner, evidence queries, permitted containment, rollback, communication and
  recovery verification.

### Kill switches (integrity-preserving)
- Scoped by **market, product, provider, organisation or capability**.
- **May stop new activity but cannot rewrite transactions, bypass reconciliation or fabricate prices** — the
  same emergency-control boundary as §13–§22.
- Live **system health, dependencies, incidents, queues and affected customers** surface on the **Living
  Operations Map** (DEC-025).

### Evidence, recovery & resilience
- **Audit/security evidence is kept separate from ordinary diagnostic logs**, with stricter access and
  retention (DEC-029/DEC-042).
- **Define and test** backups, point-in-time recovery, regional recovery and restoration procedures.
- **Formal RTO/RPO per capability before production;** safeguarding ledger and identity get the strictest
  classifications.
- **Scheduled recovery exercises** prove **ledger projections rebuild deterministically after restoration**
  (the operational proof of §14).
- **Synthetic monitoring + controlled fault injection** for provider outages, delayed webhooks, stale prices
  and worker failures.

### AI & demonstrator
- **AI may correlate alerts, summarise incidents, recommend runbooks and draft communications. It cannot
  close incidents, clear reconciliation breaks or execute recovery without governed approval.**
- **Phase 1 demonstrates rehearsed incidents and recovery timelines without claiming production-grade
  availability** (§10 honesty guardrails).

---

## 25. Admin Control Room & Living Operations Map UX

`apps/admin` is a **Control Room**, not a conventional static KPI dashboard — it is the default admin home
and the front-end expression of the whole platform. It follows the DEC-008 build route (coded shell + Map
vertical slice first, visual-review gate before the rest) and the DEC-025 demonstrator narrative.

### The Living Operations Map (centrepiece)
- Shows the active chain: **market data → canonical price → Spread/FX decisions → customer protection →
  exposure/hedge → pump settlement → ledger → Stripe/Xero → communications** (the DEC-011 price concepts
  and the DEC-032 money pipeline).
- **Each node** shows health, volume, value, freshness, open breaks, alerts and current rule/model version.
- **Selecting a node** opens an **evidence drawer**: inputs, decisions, lineage, affected customers and
  permitted actions.
- During the investor demo a **selected transaction animates through the map**, with a **static, accessible
  alternative** always retained.

### Twelve linked workspaces
1. Control Room · 2. Customers · 3. Fleets & vehicles · 4. Pricing data · 5. Spread & FX ·
6. Risk & hedging · 7. Transactions & ledger · 8. Billing & reconciliation · 9. Fraud & cases ·
10. Rules & automation · 11. Communications · 12. Platform, integrations & audit. (These map onto the
domain packages §13–§24.)

### Widgets, search & copilot
- **Widget system** with role-specific defaults and governed personal layouts. **Widgets expose provenance,
  timestamp, scope and drill-through — not decorative totals without evidence.**
- **Global command/search** across customers, organisations, vehicles, transactions, quotes, incidents and
  policies.
- An **evidence-aware copilot** that can explain what changed, trace a customer outcome, summarise exposure
  or incidents, build a governed-action draft, compare current vs proposed rules, and rehearse a
  demonstrator scenario. **Answers cite internal evidence, show confidence and separate observation from
  inference** — and, per the platform-wide boundary, the copilot drafts but never approves or executes.

### Governed actions (consistent interaction)
- **Recommendation → evidence → impact simulation → step-up authentication → approval → execution →
  verification** (the DEC-029 maker-checker + step-up flow, surfaced consistently).
- **Destructive or financial actions never hide behind generic buttons** — show exact scope, amount,
  affected entities, reversibility and approval state.
- A dedicated **operations queue** combines incidents, reconciliation breaks, cases, pending approvals and
  failed integrations, **prioritised by customer-money and integrity risk** (feeds from §19/§21/§24).

### Demonstrator, accessibility & links
- **Demonstrator mode:** visible data badge, scenario selector, controllable clock, guided eight-beat script
  and reset to golden state (DEC-025/DEC-028). **The presenter role cannot escape the approved scenario
  environment** (DEC-029 Demonstrator Presenter).
- **Accessible:** keyboard navigable, screen-reader structured, usable **without colour or animation**.
- **State in the URL where safe:** every filter, widget and drill-down is preserved for rehearsed links and
  incident handoffs.
- **Build order:** coded shell + Living Operations Map first, then a **visual review gate** before expanding
  the remaining workspaces (DEC-008).

---

## 26. KPI & metric governance

`packages/analytics` holds a **versioned metric registry**: KPIs are defined once, governed, and consumed
by dashboards — **dashboards never independently recreate calculations.** This is what makes every
workspace tell the same numerical story and keeps the investor demo honest.

### Every KPI defines
Business name & plain-language meaning · formula & version · authoritative source records · owner &
approver · grain & aggregation rules · currency/unit treatment · market/organisation/time filters ·
freshness target · reconciliation status · known exclusions & limitations.

### Presentation & classification
- **Every widget exposes "How calculated," source lineage, timestamp, scope and metric version** (extends
  the §25 provenance rule).
- **Distinguish** authoritative financial metrics · operational metrics · risk/model estimates · forecasts ·
  demonstrator/simulated metrics. **Never combine actual and simulated values without an explicit visible
  split** (DEC-033/DEC-028).
- **A metric cannot show "healthy" if its source is stale, unreconciled or incomplete** — the quality state
  is surfaced beside the value.

### Financial & fuel economics
- **Financial KPIs reconcile to the ledger (DEC-032) and the approved financial model.**
- **Fuel economics show separately:** protection-charge cost component · FuelCap margin component ·
  reserve/buffer component · claims/protection payouts · hedge/pool contribution & payoff · net unit
  economics (the DEC-014 components, end to end).
- **Forecasts and model-derived metrics carry confidence intervals and assumption versions.**

### Currency, time & snapshots
- **Canonical reporting currency** with **source-currency drill-down and FX lineage** (DEC-035).
- **Event-time and processing-time fields** so delayed data doesn't silently distort period reporting
  (parallels §24).
- **Investor-demo KPI snapshots are frozen by scenario version** (DEC-028) so every workspace agrees.

### Governance, CI, AI & access
- Changes follow **draft → impact comparison → owner approval → publish → supersede.**
- **CI compares scenario KPI outputs with golden ledger/rules-engine results and approved financial-model
  figures** (DEC-028).
- **AI may explain movements, anomalies and likely drivers, but must cite governed metrics and label
  inference.**
- **Role and tenant controls apply to metric rows, aggregates, exports and AI context — not just dashboard
  pages** (DEC-031/DEC-029/DEC-042).

---

## 27. Cross-workspace AI platform & governance

`packages/ai` is a **provider-neutral orchestration and governance layer** — **applications never call
model providers directly.** It formalises into one place the "AI recommends, deterministic engines decide,
humans approve" boundary asserted throughout §13–§26 (and DEC-004).

### Task-specific capabilities (not one unrestricted chatbot)
Operational summarisation · customer/transaction explanation · anomaly interpretation · case-evidence
summary · rule & pricing impact explanation · governed-action drafting · communications drafting · scenario
rehearsal · documentation & operator assistance. **Deterministic/statistical methods do calculations,
anomaly scores, eligibility, pricing and risk decisions; generative AI explains or recommends — it does not
replace the engines.** Each capability has a **structured input/output contract.**

### Grounding, citation & confidence
- **Ground only in authorised tenant-scoped retrieval, governed metrics (DEC-045) and immutable evidence.**
- **Every factual answer cites internal records and separates facts, calculation, inference and
  recommendation.**
- **Confidence floors:** high → present with evidence; medium → present with uncertainty + verification
  request; **below threshold → abstain and route to deterministic search or human review.**

### Untrusted input & tool boundary
- **All customer text, case notes, uploads, web content and retrieved documents are untrusted input.**
- **Retrieved content cannot change system policy, call tools or expand permissions** (prompt-injection
  containment).
- **Tool access uses narrow typed actions, server-side authorisation and an explicit action envelope.**
- **AI cannot approve, execute, clear breaks, publish rules/pricing, move money, alter eligibility or access
  another tenant.** Governed actions always return to the **DEC-044 evidence → simulation → step-up →
  approval** workflow.

### Isolation, privacy & registry
- **Tenant isolation** applies to vector namespaces, caches, prompts, traces and evaluation data (DEC-031).
- **Redact/minimise sensitive data before provider calls; prohibit external model training on FuelCap data**
  (DEC-042).
- **Model registry:** allowed tasks, regions, data classifications, cost limits, latency expectations and
  fallback models.
- **Capability-level kill switches, token/cost budgets, rate limits and circuit breakers** (parallels §24).

### Versioning, evaluation & audit
- **Version** prompts, system instructions, tools, retrieval configuration, model, output schema and
  evaluation set.
- **Evaluate** factuality, citation correctness, abstention, prompt-injection resistance, cross-tenant
  leakage, harmful-action attempts, bias, latency and cost. **Evaluation gates are required before any
  prompt, model or retrieval change reaches the demonstrator.**
- **Record each AI interaction** with tenant, actor, purpose, evidence IDs, configuration versions, output,
  confidence, policy decision and subsequent human action.

### Demonstrator & SDLC
- **The Phase 1 copilot is visibly a demonstrator**, with **rehearsed golden responses** available if the
  external model is unavailable (DEC-028).
- **Use AI in the SDLC** for contract stubs, test generation, synthetic scenario creation and review
  assistance — but **generated changes never bypass PR, tests or human approval** (DEC-027).

---

## 28. API, event & integration contracts

All shared schemas live in `packages/contracts` with **runtime validation as well as TypeScript types**.
**OpenAPI** specifications describe synchronous HTTP interfaces; **AsyncAPI / an event catalogue** describe
domain events. Contracts are the composition layer that lets §13–§27 interoperate safely.

### Four message kinds (separated)
**Commands** request state change · **Queries** read projections · **Events** report completed past facts ·
**External webhook observations** are provider inputs.
- **Commands carry:** actor, active organisation, correlation ID, causation ID, idempotency key, contract
  version and requested effective time.
- **Events are immutable past-tense facts:** event ID, aggregate/entity ID, organisation, sequence,
  occurred/recorded times, schema version, correlation/causation lineage and provenance.

### Delivery semantics
- **Transactional outbox** so database state and event intent commit atomically (DEC-032/DEC-041).
- **Consumers maintain inbox/deduplication records** and safely handle retries, duplication and
  out-of-order delivery.
- **Ordering only where required**, via **per-aggregate sequence** — never a false promise of global
  ordering.

### Versioning & compatibility
- **Version additively where possible.** Breaking changes require a **new major version and a measured
  dual-read/dual-write migration**.
- **CI validates backward compatibility** and **fails builds when an application outruns a scenario or
  consumer contract** (DEC-027/DEC-028).

### State model (deliberate restraint)
- **Do not event-source the whole platform by default.** Domain databases retain appropriate current state;
  the **immutable ledger (§14), audit records and published events** provide history where required.

### External adapters & webhooks
- **External adapters translate provider payloads into typed observations** (DEC-033). **Raw payloads
  remain evidence but never flow directly into domain engines.**
- **Webhooks require** signature/authentication verification, replay protection, immutable receipt storage
  and asynchronous processing (DEC-040).
- **Failed events enter a visible retry/dead-letter queue** with owner, reason and safe replay controls.
- **Replaying an event cannot duplicate financial postings** — ledger and command idempotency remain
  authoritative (§14).

### Security, demonstrator & Phase 1
- **RLS, server-side authz and tenant context apply to APIs, event consumers, exports and operational
  replay tools** (DEC-031) — not just page routes.
- **Contract-first mocks and test fixtures** for the demonstrator (DEC-028).
- **Phase 1 may use an in-process or database-backed event transport**, but it **implements the same
  envelopes, retries, dead-letter states and observability** intended for later infrastructure.
- **No Phase 1 interface may imply a live partner is connected** when it is a mock or test adapter
  (DEC-001).

---

## 29. Database topology, migrations & operational data management

PostgreSQL via **separate Supabase projects for development/preview, staging and production**. Start with
**one shared production database**, with **DEC-031's placement resolver** preserving the future dedicated
tenant/region path. **All access goes through `packages/database`** — applications and adapters never create
ad-hoc database clients.

### Ownership & roles
- **Domain schemas / clearly-prefixed modules:** identity & organisations · product/protection · pricing &
  rules · ledger & positions · billing & integrations · risk/cases · communications · audit/observability ·
  analytics projections.
- **Purpose-specific DB roles:** migration owner · runtime read/write · worker · read-only analytics ·
  reconciliation · emergency investigation. **Supabase service-role credentials are never exposed to a
  browser.**

### Tenancy & integrity
- **Request-scoped organisation context and RLS on all tenant-owned tables**; privileged cross-tenant
  operations live in **explicit server-side functions/paths with authz and audit** (DEC-031/DEC-029).
- Every table carries appropriate **tenant, legal-entity, time, version, provenance and lineage** fields.
- **Database constraints enforce financial and lifecycle invariants** — not application validation alone
  (backs §14).

### Migrations (DEC-027 expand/contract)
1. Add compatible schema → 2. backfill idempotently → 3. deploy dual-compatible code → 4. verify metrics &
reconciliation → 5. switch reads/writes → 6. remove the old shape in a later approved release.
- **Forward-tested, rollback-runbook-backed, applied once through CI/CD** — never automatically by every
  application instance.
- **No destructive production migration** without manual approval, a **verified backup/recovery point** and
  contract-phase evidence.

### Storage layout & recovery
- **Append-only** financial, pricing, rules, audit and event evidence is stored **separately from mutable
  projections** (DEC-032).
- **Partition/archive** high-volume events, observations and telemetry by time, preserving tenant and
  legal-hold controls (DEC-042).
- **Connection pooling with transaction-scoped RLS claims;** pooled connections **cannot leak tenant
  context**.
- **PITR enabled and restoration regularly tested into an isolated project.** Recovery acceptance verifies
  **restored ledger projections, RLS policies, sequences, outbox/inbox state and deletion tombstones**
  (backs §24).

### Data quality, access & demonstrator
- **Data-quality checks:** referential integrity, orphan records, duplicated external IDs, stale
  projections, unresolved breaks and tenant-placement correctness.
- **Admin applications access business data through governed APIs, never direct browser database queries**
  (DEC-044/§28).
- **Phase 1 uses the non-production Supabase project and seeded scenarios only** (DEC-027/DEC-028).

---

## 30. Testing strategy & Definition of Done

Testing is **cross-cutting** — enforced through CI (DEC-027) and `packages/config`, spanning every package
and app. It is the executable proof that the invariants asserted across §13–§29 actually hold. **No
checklist item is complete because code exists; its evidence link must be recorded in the implementation
tracker.**

### Mandatory test layers
- **Static:** formatting, linting, typechecking, dependency-policy checks.
- **Unit:** deterministic calculations and state transitions.
- **Property-based invariants:** ledger **debits = credits** · **customer value never disappears** ·
  **protected volume never exceeds funded volume** · **boundary contribution never exceeds its cap** ·
  **no cross-currency imbalance** · **no self-approval** · **no unauthorised cross-tenant access**. (These
  are DEC-032, DEC-019, DEC-016, DEC-035, DEC-029 and DEC-031 made testable.)
- **Contract:** OpenAPI, events, provider adapters and scenario compatibility (DEC-047).
- **Database:** constraints, RLS, migrations, idempotency, tenant-context pooling (DEC-048).
- **Integration:** outbox/inbox, Stripe webhooks, Xero projection, communications, reconciliation breaks.
- **End-to-end:** the **twelve canonical scenarios** across customer and admin surfaces (DEC-028).
- **Security:** IDOR/BOLA, role/SoD bypass, injection, secrets, webhook replay, bulk exports, break-glass.
- **AI evaluations:** factuality, citations, abstention, prompt injection, tenant leakage, prohibited-action
  attempts, bias, latency, cost (DEC-046).
- **Accessibility:** automated checks + manual keyboard and screen-reader review.
- **Visual regression:** Control Room, Living Operations Map and all critical financial states.
- **Performance/load:** against defined quote, ledger, dashboard and queue targets.
- **Recovery/resilience:** stale feeds, provider failure, delayed events, projection rebuild, database
  restore (§24/§29).

### Definition of Done (every work package)
Acceptance criteria pass with **recorded evidence** · contracts & migrations versioned and
backward-compatible · required automated tests pass **with no ignored failures** · relevant **golden
scenarios and financial reconciliations** pass · security/tenant/privacy controls verified · observability,
alerts & runbooks exist · user-facing states cover **loading, empty, error, stale, denied and partial** ·
accessibility & responsive behaviour pass · documentation, **decision references** and operational ownership
current · **deployment and rollback proven** · no unresolved severity-1/2 defects or unexplained
reconciliation differences · AI features meet confidence/citation/abstention/kill-switch gates · demonstrator
features visibly labelled and working **without live partners** · a **reviewer other than the implementer**
— or an explicitly recorded solo-maintainer review procedure — signs off.

**Evidence rule:** no checklist item may be marked complete solely because code exists; the **evidence link
is recorded in the implementation tracker**.

---

## 31. Delivery backlog & crash-recovery controls

The operating structure that carries DEC-001…DEC-049 into implementation safely, and lets any session
resume after a crash or context loss without losing state. It governs the `Implementation/` tracker.

### Work breakdown
`Phase → Epic → Work package → Story → Task → Acceptance check → Evidence.`

**Every work package carries:** a **stable ID that never changes** · objective & demonstrable outcome ·
priority & phase · dependencies & blockers · owner & reviewer · contract/database/UI surfaces affected ·
security/privacy/AI/reconciliation implications · acceptance checklist · required tests · deployment &
rollback steps · evidence links · status & last-verified timestamp · **exact restart action**.

**Status values:** not started · ready · in progress · blocked · in review · verified · released ·
superseded.

### Operational controls
- **`STATUS.md`** — single current-state index. **`MASTER_IMPLEMENTATION_PLAN.md`** — dependency-aware
  roadmap. **`Implementation/DECISIONS.md`** — immutable decision register. **`SESSION_HANDOFF.md`** —
  precise safe restart point.
- Each **approved requirement keeps a dated checkpoint**; each **active work package has its own checklist
  file under `Implementation/work-packages/`**.
- **Record progress after every meaningful green gate** — not only at session end.
- **Only one active migration/deployment step at a time** (DEC-027).
- **A task is complete only with DEC-049 evidence.** **"Blocked" must name the exact dependency, owner and
  next unblock action.**
- **Before risky work, record current commit/tag, environment, database migration state and rollback
  command** (DEC-027).

### Crash / context-loss recovery — resume in order
1. `STATUS.md` → 2. `SESSION_HANDOFF.md` → 3. active work-package checklist → 4. latest dated checkpoint →
5. relevant decisions.

### Automation & drift control
- **CI generates a machine-readable progress artifact:** commit, contract versions, scenario versions,
  migrations, checks and deployment status.
- **Weekly reviews reconcile the tracker against repository and deployment evidence** so documentation
  cannot drift ahead of reality.
- **Investor-demo readiness has a separate rehearsal checklist:** reset, golden data, eight-beat script,
  fallback AI responses, links, timing and **zero live-partner dependency** (DEC-025).

---

## 32. Phase 0 exit gate & first executable package

The transition from decision-making (DEC-001…DEC-050) to build. Phase 0 exits only when the plan is
reconciled and a tagged baseline is frozen; the first code change is deliberately **non-breaking**.

### Phase 0 exit gate
- **Reconcile** the master plan's remaining unchecked items against **DEC-005–DEC-050**.
- **Add the outstanding worked cancellation example** (DEC-010) to the Customer Rules.
- **Add explicit "illustrative demonstrator — not an offer or live service" language** (DEC-025 honesty).
- **Convert the approved investor narrative into the formal scorecard and timed walkthrough** (DEC-025).
- **Produce the initial OpenAPI / domain / event contract index** (DEC-047).
- **Produce the monorepo migration inventory and exact Render rollback records** (DEC-026/DEC-027).
- **Create active work-package checklists with owners/reviewers** (DEC-050).
- **Run one simulated crash-recovery exercise using only the repository documentation** (DEC-050).
- **Freeze and tag the Phase 0 baseline** after all evidence is linked.

### First executable package — `P0-003A` (non-breaking pnpm/Turborepo scaffold)
This is **DEC-026 Step 0** (scaffold only, no moves). Scope:
- **Read and follow the repository's `AGENTS.md`.**
- **Capture current customer and marketing builds as baseline evidence.**
- **Record current Render roots and rollback configuration** (DEC-027).
- **Add pnpm workspace + Turborepo root configuration.**
- **Add shared base TypeScript configuration and initial path-alias conventions.**
- **Do not move either application yet.**
- **Keep current npm builds functioning** during this scaffold step.
- **Add changed-path planning without changing production deployment.**
- **Run customer and marketing lint, typecheck, build and smoke baselines.**
- **Create the `monorepo-scaffold-green` checkpoint/tag** only when both applications remain green.

**Next package (after this gate):** physically move the customer application to `apps/customer`, exactly as
DEC-026 requires — one migration step at a time (DEC-027), preserving originals until parity is verified.

---

## 33. Demonstrator / non-offer language

A single canonical demonstrator notice, applied everywhere, operationalising the DEC-025 honesty guardrails
and the DEC-028 provenance discipline. The authoritative string lives in
`Implementation/DEMONSTRATOR_NOTICE.md`; app, exports and walkthrough reference that one source.

### Canonical wording
> **FuelCap Demonstrator — Illustrative Only**
> This environment demonstrates proposed FuelCap workflows using synthetic, historically derived or fixed
> illustrative data. It is not a live service. No real customer funds, fuel purchases, price protection,
> payments, hedges or partner transactions are created. Displayed prices, savings, forecasts, returns and
> unit economics are examples, not guarantees. Nothing shown constitutes an offer, contract, financial
> promotion, investment advice, insurance advice or commitment to provide a regulated product or service.
> Features, pricing and availability remain subject to commercial, legal, regulatory, accounting,
> data-provider and partner validation.

### UI treatment
- **Persistent "Demonstrator data" badge** in the header.
- **Short banner:** "Simulated environment — no live money or partner connections."
- **Provenance badge beside every simulated or historically derived value** (DEC-028 enum).
- **Full wording** accessible from the banner and displayed at the **start and end of the investor
  walkthrough** (DEC-025 bookend).
- **Exports and screenshots include a demonstrator watermark/footer** (DEC-045 exports).
- **AI answers state when they rely on simulated evidence** (DEC-046).
- **No interface uses "live," "executed," or "approved" without a visible "simulated" qualifier** where
  applicable.

---

## 34. Timed investor walkthrough & scorecard

The formal, rehearsable conversion of the DEC-025 narrative: a **20-minute timed script**, the **five claims
the demo must prove**, a **prohibited-claims** list, and an objective **rehearsal scorecard**. The canonical
copy lives in `Implementation/INVESTOR_WALKTHROUGH.md`; it runs entirely on golden demonstrator data
(DEC-028) under the DEC-053 notice with **zero live-partner dependency**.

### 20-minute script (10 segments, 8 core beats)
Disclosure & OS message (0–1) → transparent protect with the three charge components (1–3) → transaction
into the Living Operations Map (3–5) → pump settlement rise/breach/fall reconciles (5–8) → exposure +
simulated hedge/pool (8–10:30) → AI detects multi-customer exposure (10:30–13) → human approves a governed
response with SoD/step-up/audit (13–15:30) → fair Auto-Rollover + failure branch (15:30–17:30) → executive
unit economics on governed metrics (17:30–19) → proof-backed close → Q&A (19–20).

### Five claims to prove
Transparent/fair customer outcome · everything explainable & auditable · spread + risk + hedge/pool + unit
economics are one coherent system · AI reduces operator workload while controlled and evidence-based ·
production-intent contracts/controls **without pretending live integrations exist**.

### Prohibited claims
No "live" AI/hedging/payments/settlement/partner integrations · no guaranteed savings/returns/protection
performance · no "final" regulatory/accounting/insurance classification · no unqualified
"real-time/fully-autonomous/risk-free/production-ready" · **no EIA/EU benchmark described as a station-level
actual pump price** (DEC-033).

### Rehearsal scorecard
Within 20 minutes · all eight core beats without navigation failure · golden figures reconcile across
customer/admin/ledger/dashboard · demonstrator/provenance labels visible · AI cites evidence or uses the
approved fallback · governed action completes its simulated approval/audit round-trip · golden reset
succeeds · no live-partner dependency · investor can restate value/model/moat · questions captured and
prioritised for the next iteration.

---

## 35. Initial API / domain / event contract index

The first catalogue of shared contracts and domain events — the concrete instantiation of §28 (DEC-047).
Canonical copy in `Implementation/CONTRACT_INDEX.md`; it moves into `packages/contracts` once scaffolded.

### Catalogue (17 domains)
Identity & tenancy · customer & fleet · pricing data · spread · FX · rules · protection · rollover · fuel
settlement · ledger · billing · risk & fraud · hedging · communications · admin governance · AI · metrics &
operations — each with its core contracts and initial commands/events (full table in the canonical file).
The domains map one-to-one onto the packages of §13–§29.

### First vertical slice (build first)
`ReferencePrice → SpreadDecision → Quote → ProtectionTransaction → ProtectedPosition → Actual/Simulated
PumpObservation → SettlementDecision → JournalTransaction → ExposureSnapshot → AIRecommendation →
GovernedAction → AuditRecord` — the one-transaction-end-to-end path, matching the §25 Living Operations Map
and the §34 walkthrough.

### Contract rules
Runtime-validated TS schemas · stable IDs + semantic versions · integer-minor money + 4-dp quantities
(§14) · organisation/environment/provenance/correlation lineage (§12/§10) · effective/recorded timestamps
from the injected clock (§10) · no provider-native types outside adapters (§13) · OpenAPI for
commands/queries + AsyncAPI for events (§28) · golden example payloads from the canonical scenarios (§10) ·
**compatibility and forbidden-type-substitution tests in CI** (a benchmark/simulation can never satisfy an
`ActualPumpObservation` parameter).

---

## 36. Monorepo migration baseline & rollback records

The verified inventory and exact rollback anchors for the DEC-026 migration, captured before any code moves.
Canonical copy in `Implementation/MIGRATION_BASELINE.md`. **No move begins until actual Render dashboard
values, environment names and service IDs are captured and verified.**

### Baseline
- Repo root `fuel-cap-app`, branch `main`, commit `166b8cd…`, remote `github.com/francis-nzi/fuel-cap`.
- **`ARCHITECTURE.md` is untracked user work — preserve it** through migration.
- Customer `fuelcap-app`: root `.` → `apps/customer`. Marketing `fuelcap-web`: root `landing-page` →
  `apps/marketing`. Stale sibling: archive **only after parity approval**.

### Findings feeding P0-003A
- Nested marketing copy and stale sibling share identical `package.json`/`render.yaml` hashes; **full
  file-by-file parity still needs verification** before cleanup.
- **Node mismatch — customer 22.22.0 vs marketing 20.18.0 — P0-003A must resolve at the workspace layer.**
- Both apps use **npm lockfiles**; **pnpm is added at the workspace layer without deleting those rollback
  anchors**.
- Marketing `render.yaml` leaves `rootDir` commented (Root Directory set manually in Render) — **confirm
  from the dashboard before migration**.

### Rollback anchors (per DEC-027)
- **Customer:** revert move commit → reset Render root `apps/customer` → `.` → restore build/start + env →
  redeploy → verify `/api/health` + a market page → re-tag green.
- **Marketing:** revert move commit → reset Render root `apps/marketing` → `landing-page` → restore
  build/start + env → redeploy → verify `/uk` + a staging signup write → re-tag green.
- **Preservation:** no lockfile, source location or Render config is removed until the **new location is
  green** (DEC-026 Step 5 cleanup separately approved).

---

_This document is the plan of record. Execute the steps only under approval, one at a time._
