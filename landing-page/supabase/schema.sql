-- FuelCap waitlist / marketing site — Supabase schema
-- Run once in the Supabase SQL editor (or via `psql`) for your project.
-- The app talks to these tables via PostgREST using the service_role key,
-- so Row Level Security stays ON with no public policies (server-only access).

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Waitlist funnel submissions (one row per session, upserted as the funnel
-- progresses).
-- ---------------------------------------------------------------------------
create table if not exists public.submissions (
  session_id     text primary key,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  completed      boolean     not null default false,
  completed_at   timestamptz,
  furthest_step  text        not null,
  landing_market text,
  answers        jsonb       not null default '{}'::jsonb,
  utm            jsonb       not null default '{}'::jsonb,
  referrer       text,
  user_agent     text
);

create index if not exists submissions_created_at_idx on public.submissions (created_at desc);
create index if not exists submissions_completed_idx on public.submissions (completed);

-- ---------------------------------------------------------------------------
-- Page views (marketing attribution).
-- ---------------------------------------------------------------------------
create table if not exists public.pageviews (
  id         uuid primary key default gen_random_uuid(),
  timestamp  timestamptz not null default now(),
  utm        jsonb       not null default '{}'::jsonb,
  referrer   text,
  user_agent text,
  path       text        not null,
  market     text
);

create index if not exists pageviews_timestamp_idx on public.pageviews (timestamp desc);

-- ---------------------------------------------------------------------------
-- Contact-form messages.
-- ---------------------------------------------------------------------------
create table if not exists public.contacts (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name       text        not null,
  email      text        not null,
  message    text        not null,
  market     text
);

create index if not exists contacts_created_at_idx on public.contacts (created_at desc);

-- Lock the tables down: RLS on, no anon/authenticated policies. The server
-- uses the service_role key, which bypasses RLS. This keeps the data private.
alter table public.submissions enable row level security;
alter table public.pageviews  enable row level security;
alter table public.contacts   enable row level security;
