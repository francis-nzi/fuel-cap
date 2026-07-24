create extension if not exists pgcrypto;

create type public.market_code as enum ('US', 'CA', 'GB');
create type public.fuel_grade as enum ('regular', 'midgrade', 'premium', 'diesel');
create type public.lock_status as enum ('active', 'partially_redeemed', 'redeemed', 'expired', 'cancelled');
create type public.transaction_type as enum ('lock', 'redemption', 'price_adjustment', 'refund');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  market public.market_code not null default 'US',
  postcode text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.price_snapshots (
  id uuid primary key default gen_random_uuid(),
  market public.market_code not null,
  station_reference text not null,
  station_name text not null,
  fuel_grade public.fuel_grade not null,
  currency char(3) not null check (currency in ('USD', 'CAD', 'GBP')),
  unit text not null check (unit in ('gal', 'L')),
  unit_price numeric(8, 4) not null check (unit_price > 0),
  observed_at timestamptz not null,
  source_name text not null,
  source_record_id text not null,
  created_at timestamptz not null default now(),
  unique (market, source_name, source_record_id, fuel_grade, observed_at)
);

create table public.price_locks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  market public.market_code not null,
  fuel_grade public.fuel_grade not null,
  currency char(3) not null check (currency in ('USD', 'CAD', 'GBP')),
  unit text not null check (unit in ('gal', 'L')),
  volume numeric(10, 3) not null check (volume > 0),
  remaining_volume numeric(10, 3) not null check (remaining_volume >= 0),
  locked_unit_price numeric(8, 4) not null check (locked_unit_price > 0),
  spread_per_unit numeric(8, 4) not null default 0 check (spread_per_unit >= 0),
  snapshot_id uuid references public.price_snapshots(id),
  status public.lock_status not null default 'active',
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (remaining_volume <= volume)
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lock_id uuid references public.price_locks(id),
  type public.transaction_type not null,
  currency char(3) not null check (currency in ('USD', 'CAD', 'GBP')),
  amount numeric(12, 2) not null,
  volume numeric(10, 3),
  unit_price numeric(8, 4),
  description text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index price_snapshots_market_observed_idx on public.price_snapshots (market, observed_at desc);
create index price_locks_user_status_idx on public.price_locks (user_id, status);
create index transactions_user_created_idx on public.transactions (user_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.price_snapshots enable row level security;
alter table public.price_locks enable row level security;
alter table public.transactions enable row level security;

create policy "profiles_select_own" on public.profiles for select using ((select auth.uid()) = id);
create policy "profiles_update_own" on public.profiles for update using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy "prices_authenticated_read" on public.price_snapshots for select to authenticated using (true);
create policy "locks_select_own" on public.price_locks for select using ((select auth.uid()) = user_id);
create policy "transactions_select_own" on public.transactions for select using ((select auth.uid()) = user_id);

create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

comment on table public.price_locks is 'Prototype data model. Creation and settlement will be performed by validated server-side functions.';
