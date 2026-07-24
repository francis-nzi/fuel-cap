insert into public.price_snapshots
  (market, station_reference, station_name, fuel_grade, currency, unit, unit_price, observed_at, source_name, source_record_id)
values
  ('US', 'demo-us-001', 'FuelCap Demo Station', 'regular', 'USD', 'gal', 3.8700, now(), 'FuelCap demo feed', 'us-001'),
  ('CA', 'demo-ca-001', 'FuelCap Demo Station', 'regular', 'CAD', 'L', 1.7100, now(), 'FuelCap demo feed', 'ca-001'),
  ('GB', 'demo-gb-001', 'FuelCap Demo Station', 'regular', 'GBP', 'L', 1.4900, now(), 'FuelCap demo feed', 'gb-001')
on conflict do nothing;
