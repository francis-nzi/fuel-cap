do $$ begin
  create type public.lock_scope as enum ('station', 'provider', 'country');
exception when duplicate_object then null;
end $$;

create table public.fuel_providers (
  id uuid primary key default gen_random_uuid(),
  market public.market_code not null,
  display_name text not null,
  status text not null default 'active' check (status in ('active', 'suspended', 'retired')),
  created_at timestamptz not null default now(),
  unique (market, display_name)
);

create table public.stations (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.fuel_providers(id),
  market public.market_code not null,
  external_reference text not null,
  name text not null,
  address text not null,
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  status text not null default 'active' check (status in ('active', 'suspended', 'closed')),
  created_at timestamptz not null default now(),
  unique (market, external_reference)
);

create table public.station_price_observations (
  id uuid primary key default gen_random_uuid(),
  station_id uuid not null references public.stations(id),
  fuel_grade public.fuel_grade not null,
  currency char(3) not null check (currency in ('USD', 'CAD', 'GBP')),
  unit text not null check (unit in ('gal', 'L')),
  unit_price numeric(8, 4) not null check (unit_price > 0),
  observed_at timestamptz not null,
  received_at timestamptz not null default now(),
  source_name text not null,
  source_record_id text not null,
  quality_status text not null default 'verified' check (quality_status in ('pending', 'verified', 'rejected')),
  unique (source_name, source_record_id, observed_at)
);

create table public.cap_quotes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scope_type public.lock_scope not null,
  market public.market_code not null,
  station_id uuid references public.stations(id),
  provider_id uuid references public.fuel_providers(id),
  fuel_grade public.fuel_grade not null,
  volume numeric(10, 3) not null check (volume > 0),
  currency char(3) not null check (currency in ('USD', 'CAD', 'GBP')),
  unit text not null check (unit in ('gal', 'L')),
  reference_unit_price numeric(8, 4) not null check (reference_unit_price > 0),
  cap_unit_price numeric(8, 4) not null check (cap_unit_price > 0),
  reference_label text not null,
  station_count integer not null check (station_count > 0),
  source_observation_id uuid references public.station_price_observations(id),
  source_details jsonb not null default '{}'::jsonb,
  status text not null default 'accepted' check (status in ('offered', 'accepted', 'expired', 'withdrawn')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  check (
    (scope_type = 'station' and station_id is not null and provider_id is null)
    or (scope_type = 'provider' and station_id is null and provider_id is not null)
    or (scope_type = 'country' and station_id is null and provider_id is null)
  )
);

alter table public.price_locks
  add column if not exists quote_id uuid references public.cap_quotes(id),
  add column if not exists scope_type public.lock_scope not null default 'country',
  add column if not exists station_id uuid references public.stations(id),
  add column if not exists provider_id uuid references public.fuel_providers(id),
  add column if not exists reference_unit_price numeric(8, 4),
  add column if not exists reference_label text;

create index stations_market_provider_idx on public.stations (market, provider_id) where status = 'active';
create index station_prices_latest_idx on public.station_price_observations (station_id, fuel_grade, observed_at desc) where quality_status = 'verified';
create index cap_quotes_user_created_idx on public.cap_quotes (user_id, created_at desc);
create index price_locks_scope_idx on public.price_locks (scope_type, station_id, provider_id);

alter table public.fuel_providers enable row level security;
alter table public.stations enable row level security;
alter table public.station_price_observations enable row level security;
alter table public.cap_quotes enable row level security;

create policy "providers_public_read" on public.fuel_providers for select to anon, authenticated using (status = 'active');
create policy "stations_public_read" on public.stations for select to anon, authenticated using (status = 'active');
create policy "station_prices_public_read" on public.station_price_observations for select to anon, authenticated using (quality_status = 'verified');
create policy "quotes_select_own" on public.cap_quotes for select to authenticated using ((select auth.uid()) = user_id);

grant select on public.fuel_providers, public.stations, public.station_price_observations to anon, authenticated;
grant select on public.cap_quotes to authenticated;

create or replace function public.get_current_lock_options(
  p_market public.market_code,
  p_fuel_grade public.fuel_grade default 'regular'
)
returns table (
  scope_type public.lock_scope,
  scope_id uuid,
  label text,
  provider_name text,
  unit_price numeric,
  currency text,
  unit text,
  station_count bigint,
  observed_at timestamptz,
  source_observation_id uuid
)
language sql
stable
security invoker
set search_path = ''
as $$
  with latest as (
    select distinct on (s.id)
      s.id as station_id,
      s.provider_id,
      s.market,
      s.name,
      s.address,
      p.display_name as provider_name,
      o.id as observation_id,
      o.unit_price,
      o.currency::text as currency,
      o.unit,
      o.observed_at
    from public.stations s
    join public.fuel_providers p on p.id = s.provider_id and p.status = 'active'
    join public.station_price_observations o on o.station_id = s.id
    where s.market = p_market
      and s.status = 'active'
      and o.fuel_grade = p_fuel_grade
      and o.quality_status = 'verified'
    order by s.id, o.observed_at desc
  ),
  station_options as (
    select
      'station'::public.lock_scope as scope_type,
      station_id as scope_id,
      name || ' - ' || address as label,
      provider_name,
      unit_price,
      currency,
      unit,
      1::bigint as station_count,
      observed_at,
      observation_id
    from latest
  ),
  provider_options as (
    select
      'provider'::public.lock_scope,
      provider_id,
      provider_name,
      provider_name,
      max(unit_price),
      min(currency),
      min(unit),
      count(*)::bigint,
      max(observed_at),
      null::uuid
    from latest
    group by provider_id, provider_name
  ),
  country_option as (
    select
      'country'::public.lock_scope,
      null::uuid,
      case p_market when 'US' then 'Any eligible US station'
                    when 'CA' then 'Any eligible Canadian station'
                    else 'Any eligible UK station' end,
      null::text,
      max(unit_price),
      min(currency),
      min(unit),
      count(*)::bigint,
      max(observed_at),
      null::uuid
    from latest
    having count(*) > 0
  )
  select * from station_options
  union all select * from provider_options
  union all select * from country_option
  order by scope_type, label;
$$;

create or replace function public.create_scoped_demo_lock(
  p_market public.market_code,
  p_fuel_grade public.fuel_grade,
  p_volume numeric,
  p_scope_type public.lock_scope,
  p_scope_id uuid default null
)
returns public.price_locks
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_option record;
  v_quote public.cap_quotes;
  v_lock public.price_locks;
  v_max_volume numeric;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  v_max_volume := case when p_market = 'US' then 80 else 300 end;
  if p_volume <= 0 or p_volume > v_max_volume then
    raise exception 'Volume must be between 1 and %', v_max_volume;
  end if;
  if p_scope_type = 'country' and p_scope_id is not null then
    raise exception 'Country scope cannot include a scope id';
  end if;
  if p_scope_type <> 'country' and p_scope_id is null then
    raise exception 'Station and provider scopes require a scope id';
  end if;

  select *
  into v_option
  from public.get_current_lock_options(p_market, p_fuel_grade)
  where scope_type = p_scope_type
    and (p_scope_type = 'country' or scope_id = p_scope_id)
  limit 1;

  if v_option.unit_price is null then
    raise exception 'No verified current price is available for this selection';
  end if;

  insert into public.cap_quotes (
    user_id, scope_type, market, station_id, provider_id, fuel_grade,
    volume, currency, unit, reference_unit_price, cap_unit_price,
    reference_label, station_count, source_observation_id, source_details,
    status, expires_at, accepted_at
  )
  values (
    v_user_id, p_scope_type, p_market,
    case when p_scope_type = 'station' then p_scope_id end,
    case when p_scope_type = 'provider' then p_scope_id end,
    p_fuel_grade, p_volume, v_option.currency, v_option.unit,
    v_option.unit_price, v_option.unit_price, v_option.label,
    v_option.station_count, v_option.source_observation_id,
    jsonb_build_object('observed_at', v_option.observed_at, 'method',
      case when p_scope_type = 'station' then 'latest_station_price'
           else 'current_verified_maximum' end),
    'accepted', now() + interval '60 seconds', now()
  )
  returning * into v_quote;

  insert into public.price_locks (
    user_id, market, fuel_grade, currency, unit, volume, remaining_volume,
    locked_unit_price, spread_per_unit, status, expires_at, quote_id,
    scope_type, station_id, provider_id, reference_unit_price, reference_label
  )
  values (
    v_user_id, p_market, p_fuel_grade, v_quote.currency, v_quote.unit,
    p_volume, p_volume, v_quote.cap_unit_price, 0, 'active',
    now() + interval '30 days', v_quote.id, p_scope_type,
    v_quote.station_id, v_quote.provider_id, v_quote.reference_unit_price,
    v_quote.reference_label
  )
  returning * into v_lock;

  insert into public.transactions (
    user_id, lock_id, type, currency, amount, volume, unit_price,
    description, metadata
  )
  values (
    v_user_id, v_lock.id, 'lock', v_lock.currency,
    round(v_lock.volume * v_lock.locked_unit_price, 2), v_lock.volume,
    v_lock.locked_unit_price, 'Scoped demo price lock created',
    jsonb_build_object('quote_id', v_quote.id, 'scope_type', p_scope_type,
      'reference_label', v_quote.reference_label)
  );

  return v_lock;
end;
$$;

revoke all on function public.get_current_lock_options(public.market_code, public.fuel_grade) from public;
revoke all on function public.create_scoped_demo_lock(public.market_code, public.fuel_grade, numeric, public.lock_scope, uuid) from public;
grant execute on function public.get_current_lock_options(public.market_code, public.fuel_grade) to anon, authenticated;
grant execute on function public.create_scoped_demo_lock(public.market_code, public.fuel_grade, numeric, public.lock_scope, uuid) to authenticated;

insert into public.fuel_providers (id, market, display_name) values
  ('10000000-0000-0000-0000-000000000001', 'US', 'Shell'),
  ('10000000-0000-0000-0000-000000000002', 'US', 'BP'),
  ('10000000-0000-0000-0000-000000000003', 'US', 'Chevron'),
  ('20000000-0000-0000-0000-000000000001', 'CA', 'Shell'),
  ('20000000-0000-0000-0000-000000000002', 'CA', 'Petro-Canada'),
  ('20000000-0000-0000-0000-000000000003', 'CA', 'Esso'),
  ('30000000-0000-0000-0000-000000000001', 'GB', 'Shell'),
  ('30000000-0000-0000-0000-000000000002', 'GB', 'BP'),
  ('30000000-0000-0000-0000-000000000003', 'GB', 'Texaco')
on conflict (market, display_name) do nothing;

insert into public.stations (id, provider_id, market, external_reference, name, address) values
  ('11000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'US', 'demo-us-shell-1', 'Shell Downtown', '101 Main St, Austin, TX'),
  ('11000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'US', 'demo-us-shell-2', 'Shell Riverside', '480 River Rd, Austin, TX'),
  ('11000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', 'US', 'demo-us-bp-1', 'BP Central', '220 Congress Ave, Austin, TX'),
  ('11000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000002', 'US', 'demo-us-bp-2', 'BP North', '8150 Burnet Rd, Austin, TX'),
  ('11000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000003', 'US', 'demo-us-chevron-1', 'Chevron Airport', '2901 Airport Blvd, Austin, TX'),
  ('11000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000003', 'US', 'demo-us-chevron-2', 'Chevron South', '7300 S Congress Ave, Austin, TX'),
  ('21000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'CA', 'demo-ca-shell-1', 'Shell King Street', '548 King St W, Toronto, ON'),
  ('21000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'CA', 'demo-ca-shell-2', 'Shell Lakeshore', '1250 Lake Shore Blvd, Toronto, ON'),
  ('21000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000002', 'CA', 'demo-ca-petro-1', 'Petro-Canada Bloor', '55 Bloor St E, Toronto, ON'),
  ('21000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000002', 'CA', 'demo-ca-petro-2', 'Petro-Canada Danforth', '1675 Danforth Ave, Toronto, ON'),
  ('21000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000003', 'CA', 'demo-ca-esso-1', 'Esso Front Street', '200 Front St W, Toronto, ON'),
  ('21000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000003', 'CA', 'demo-ca-esso-2', 'Esso North York', '5000 Yonge St, Toronto, ON'),
  ('31000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'GB', 'demo-gb-shell-1', 'Shell Fulham', '147 New Kings Rd, London'),
  ('31000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', 'GB', 'demo-gb-shell-2', 'Shell Islington', '108 Upper St, London'),
  ('31000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000002', 'GB', 'demo-gb-bp-1', 'BP Battersea', '9 York Rd, London'),
  ('31000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000002', 'GB', 'demo-gb-bp-2', 'BP Camden', '102 Camden Rd, London'),
  ('31000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000003', 'GB', 'demo-gb-texaco-1', 'Texaco Brixton', '234 Brixton Rd, London'),
  ('31000000-0000-0000-0000-000000000006', '30000000-0000-0000-0000-000000000003', 'GB', 'demo-gb-texaco-2', 'Texaco Hackney', '88 Mare St, London')
on conflict (market, external_reference) do nothing;

insert into public.station_price_observations
  (station_id, fuel_grade, currency, unit, unit_price, observed_at, source_name, source_record_id)
values
  ('11000000-0000-0000-0000-000000000001', 'regular', 'USD', 'gal', 3.4200, now(), 'FuelCap scoped demo', 'us-shell-1'),
  ('11000000-0000-0000-0000-000000000002', 'regular', 'USD', 'gal', 3.4900, now(), 'FuelCap scoped demo', 'us-shell-2'),
  ('11000000-0000-0000-0000-000000000003', 'regular', 'USD', 'gal', 3.3900, now(), 'FuelCap scoped demo', 'us-bp-1'),
  ('11000000-0000-0000-0000-000000000004', 'regular', 'USD', 'gal', 3.5300, now(), 'FuelCap scoped demo', 'us-bp-2'),
  ('11000000-0000-0000-0000-000000000005', 'regular', 'USD', 'gal', 3.4700, now(), 'FuelCap scoped demo', 'us-chevron-1'),
  ('11000000-0000-0000-0000-000000000006', 'regular', 'USD', 'gal', 3.5800, now(), 'FuelCap scoped demo', 'us-chevron-2'),
  ('21000000-0000-0000-0000-000000000001', 'regular', 'CAD', 'L', 1.5890, now(), 'FuelCap scoped demo', 'ca-shell-1'),
  ('21000000-0000-0000-0000-000000000002', 'regular', 'CAD', 'L', 1.6290, now(), 'FuelCap scoped demo', 'ca-shell-2'),
  ('21000000-0000-0000-0000-000000000003', 'regular', 'CAD', 'L', 1.6090, now(), 'FuelCap scoped demo', 'ca-petro-1'),
  ('21000000-0000-0000-0000-000000000004', 'regular', 'CAD', 'L', 1.6490, now(), 'FuelCap scoped demo', 'ca-petro-2'),
  ('21000000-0000-0000-0000-000000000005', 'regular', 'CAD', 'L', 1.6190, now(), 'FuelCap scoped demo', 'ca-esso-1'),
  ('21000000-0000-0000-0000-000000000006', 'regular', 'CAD', 'L', 1.6690, now(), 'FuelCap scoped demo', 'ca-esso-2'),
  ('31000000-0000-0000-0000-000000000001', 'regular', 'GBP', 'L', 1.4190, now(), 'FuelCap scoped demo', 'gb-shell-1'),
  ('31000000-0000-0000-0000-000000000002', 'regular', 'GBP', 'L', 1.4490, now(), 'FuelCap scoped demo', 'gb-shell-2'),
  ('31000000-0000-0000-0000-000000000003', 'regular', 'GBP', 'L', 1.4290, now(), 'FuelCap scoped demo', 'gb-bp-1'),
  ('31000000-0000-0000-0000-000000000004', 'regular', 'GBP', 'L', 1.4590, now(), 'FuelCap scoped demo', 'gb-bp-2'),
  ('31000000-0000-0000-0000-000000000005', 'regular', 'GBP', 'L', 1.4390, now(), 'FuelCap scoped demo', 'gb-texaco-1'),
  ('31000000-0000-0000-0000-000000000006', 'regular', 'GBP', 'L', 1.4790, now(), 'FuelCap scoped demo', 'gb-texaco-2')
on conflict (source_name, source_record_id, observed_at) do nothing;
