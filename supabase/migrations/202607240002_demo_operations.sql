create or replace function public.create_demo_lock(
  p_market public.market_code,
  p_fuel_grade public.fuel_grade,
  p_volume numeric
)
returns public.price_locks
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_snapshot public.price_snapshots;
  v_lock public.price_locks;
  v_max_volume numeric;
  v_discount numeric;
  v_locked_price numeric;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  v_max_volume := case when p_market = 'US' then 80 else 300 end;
  if p_volume <= 0 or p_volume > v_max_volume then
    raise exception 'Volume must be between 1 and %', v_max_volume;
  end if;

  select *
  into v_snapshot
  from public.price_snapshots
  where market = p_market and fuel_grade = p_fuel_grade
  order by observed_at desc
  limit 1;

  if v_snapshot.id is null then
    raise exception 'No current price is available for this market and grade';
  end if;

  v_discount := case p_market
    when 'US' then 0.4500
    when 'CA' then 0.0800
    when 'GB' then 0.0700
  end;
  v_locked_price := greatest(v_snapshot.unit_price - v_discount, 0.0001);

  insert into public.price_locks (
    user_id, market, fuel_grade, currency, unit, volume, remaining_volume,
    locked_unit_price, spread_per_unit, snapshot_id, expires_at
  )
  values (
    v_user_id, p_market, p_fuel_grade, v_snapshot.currency, v_snapshot.unit,
    p_volume, p_volume, v_locked_price, 0, v_snapshot.id, now() + interval '30 days'
  )
  returning * into v_lock;

  insert into public.transactions (
    user_id, lock_id, type, currency, amount, volume, unit_price, description,
    metadata
  )
  values (
    v_user_id, v_lock.id, 'lock', v_lock.currency,
    round(v_lock.volume * v_lock.locked_unit_price, 2), v_lock.volume,
    v_lock.locked_unit_price, 'Demo price lock created',
    jsonb_build_object('market', p_market, 'snapshot_id', v_snapshot.id)
  );

  return v_lock;
end;
$$;

create or replace function public.redeem_demo_fuel(
  p_lock_id uuid,
  p_volume numeric
)
returns public.price_locks
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_lock public.price_locks;
  v_remaining numeric;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  if p_volume <= 0 then
    raise exception 'Redemption volume must be positive';
  end if;

  select *
  into v_lock
  from public.price_locks
  where id = p_lock_id and user_id = v_user_id
  for update;

  if v_lock.id is null then
    raise exception 'Price lock not found';
  end if;
  if v_lock.status not in ('active', 'partially_redeemed') then
    raise exception 'Price lock is not redeemable';
  end if;
  if p_volume > v_lock.remaining_volume then
    raise exception 'Redemption exceeds remaining volume';
  end if;

  v_remaining := v_lock.remaining_volume - p_volume;
  update public.price_locks
  set remaining_volume = v_remaining,
      status = case when v_remaining = 0 then 'redeemed'::public.lock_status
                    else 'partially_redeemed'::public.lock_status end,
      updated_at = now()
  where id = v_lock.id
  returning * into v_lock;

  insert into public.transactions (
    user_id, lock_id, type, currency, amount, volume, unit_price, description
  )
  values (
    v_user_id, v_lock.id, 'redemption', v_lock.currency,
    -round(p_volume * v_lock.locked_unit_price, 2), p_volume,
    v_lock.locked_unit_price, 'Demo pump redemption'
  );

  return v_lock;
end;
$$;

revoke all on function public.create_demo_lock(public.market_code, public.fuel_grade, numeric) from public;
revoke all on function public.redeem_demo_fuel(uuid, numeric) from public;
grant execute on function public.create_demo_lock(public.market_code, public.fuel_grade, numeric) to authenticated;
grant execute on function public.redeem_demo_fuel(uuid, numeric) to authenticated;
