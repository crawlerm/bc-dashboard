-- BC Dashboard — Sea Conditions schema
-- Run this in the bc-dashboard Supabase SQL editor

create table if not exists sea_snapshots (
  id                 bigserial    primary key,
  captured_at        timestamptz  not null default now(),
  label              text         not null,   -- '0700' | '1200' | '1800' (UTC)

  -- Fort Massac weather station (via wbtide Supabase, snapshotted at capture time)
  ftm_wind_speed     numeric(5,1),            -- knots
  ftm_wind_dir       numeric(5,1),            -- degrees
  ftm_gust_speed     numeric(5,1),            -- knots
  ftm_gust_dir       numeric(5,1),            -- degrees
  ftm_pressure       numeric(7,1),            -- mb
  ftm_temp           numeric(5,1),            -- °C
  ftm_humidity       numeric(5,1),            -- %

  -- Waldringfield SC weather page (scraped at capture time)
  wsc_wind_speed     numeric(5,1),            -- mph
  wsc_wind_dir       text,                    -- compass e.g. "WNW"

  -- CEFAS Felixstowe WaveNet buoy (API, snapshotted at capture time)
  cefas_wave_height  numeric(4,2),            -- m  (Hm0, significant wave height)
  cefas_sea_temp     numeric(5,2),            -- °C
  cefas_wave_dir     numeric(5,1),            -- degrees (peak wave direction)

  -- Met Office inshore waters forecast — Gibraltar Point to North Foreland
  metoffice_forecast text
);

create index if not exists sea_snapshots_time_idx
  on sea_snapshots (captured_at desc);

alter table sea_snapshots enable row level security;

create policy "Public read sea snapshots"
  on sea_snapshots for select using (true);
