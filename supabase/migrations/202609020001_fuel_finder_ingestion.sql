create table if not exists public.pricing_ingestion_runs (
  id uuid primary key default gen_random_uuid(),
  source_name text not null,
  status text not null check (status in ('running', 'completed', 'failed')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  fetched_records integer not null default 0,
  accepted_records integer not null default 0,
  pending_records integer not null default 0,
  rejected_records integer not null default 0,
  price_batches integer not null default 0,
  forecourt_batches integer not null default 0,
  freshest_observed_at timestamptz,
  error_code text
);

create index if not exists pricing_ingestion_runs_source_started_idx on public.pricing_ingestion_runs (source_name, started_at desc);
alter table public.pricing_ingestion_runs enable row level security;
revoke all on public.pricing_ingestion_runs from anon, authenticated;

create or replace function public.get_pricing_feed_health()
returns table (source_name text, status text, started_at timestamptz, completed_at timestamptz, fetched_records integer, accepted_records integer, pending_records integer, rejected_records integer, freshest_observed_at timestamptz, price_batches integer, forecourt_batches integer)
language sql stable security invoker set search_path = '' as $$
  select r.source_name, r.status, r.started_at, r.completed_at, r.fetched_records, r.accepted_records, r.pending_records, r.rejected_records, r.freshest_observed_at, r.price_batches, r.forecourt_batches
  from public.pricing_ingestion_runs r where r.status in ('completed', 'failed') order by r.started_at desc limit 1;
$$;

revoke all on function public.get_pricing_feed_health() from public;
grant execute on function public.get_pricing_feed_health() to anon, authenticated;

create or replace function public.get_current_lock_options(
  p_market public.market_code,
  p_fuel_grade public.fuel_grade default 'regular'
)
returns table (scope_type public.lock_scope, scope_id uuid, label text, provider_name text, unit_price numeric, currency text, unit text, station_count bigint, observed_at timestamptz, source_observation_id uuid)
language sql stable security invoker set search_path = '' as $$
  with latest as (
    select distinct on (s.id) s.id station_id, s.provider_id, s.market, s.name, s.address, p.display_name provider_name, o.id observation_id, o.unit_price, o.currency::text currency, o.unit, o.observed_at
    from public.stations s join public.fuel_providers p on p.id=s.provider_id and p.status='active' join public.station_price_observations o on o.station_id=s.id
    where s.market=p_market and s.status='active' and o.fuel_grade=p_fuel_grade and o.quality_status='verified' and o.observed_at >= now()-interval '24 hours'
    order by s.id,o.observed_at desc
  ), station_options as (
    select 'station'::public.lock_scope,station_id,name||' - '||address,provider_name,unit_price,currency,unit,1::bigint,observed_at,observation_id from latest
  ), provider_options as (
    select 'provider'::public.lock_scope,provider_id,provider_name,provider_name,max(unit_price),min(currency),min(unit),count(*)::bigint,max(observed_at),null::uuid from latest group by provider_id,provider_name
  ), country_option as (
    select 'country'::public.lock_scope,null::uuid,case p_market when 'US' then 'Any eligible US station' when 'CA' then 'Any eligible Canadian station' else 'Any eligible UK station' end,null::text,max(unit_price),min(currency),min(unit),count(*)::bigint,max(observed_at),null::uuid from latest having count(*)>0
  ) select * from station_options union all select * from provider_options union all select * from country_option order by scope_type,label;
$$;

revoke all on function public.get_current_lock_options(public.market_code, public.fuel_grade) from public;
grant execute on function public.get_current_lock_options(public.market_code, public.fuel_grade) to anon, authenticated;
