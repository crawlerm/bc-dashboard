-- BC Dashboard — Finance schema
-- Run this in Supabase SQL editor:
-- https://supabase.com/dashboard/project/YOUR_PROJECT/sql/new

-- ── Snapshots captured 3× daily by Vercel Cron ─────────────────────────────
create table if not exists finance_snapshots (
  id          bigserial    primary key,
  captured_at timestamptz  not null default now(),
  label       text         not null,   -- '0700' | '1200' | '1800' (UTC)
  gold_usd    numeric(10,2),           -- Gold price, USD per troy oz
  oil_usd     numeric(10,2),           -- WTI crude, USD per barrel
  gbp_usd     numeric(8,4),            -- GBP/USD exchange rate
  bank_rate   numeric(5,2),            -- UK Bank base rate, %
  ftse        numeric(10,2)            -- FTSE 100 index points
);

create index if not exists finance_snapshots_time_idx
  on finance_snapshots (captured_at desc);

-- ── Manual config values (updated when rates change) ───────────────────────
create table if not exists finance_config (
  key        text         primary key,
  value      text         not null,
  updated_at timestamptz  not null default now()
);

-- Seed: set current UK Bank Rate here — update manually when BOE changes it
-- Current rate as of April 2026 — verify at https://www.bankofengland.co.uk/monetary-policy
insert into finance_config (key, value)
  values ('uk_bank_rate', '4.50')
  on conflict (key) do nothing;

-- ── Row Level Security — public read, no public write ──────────────────────
alter table finance_snapshots enable row level security;
alter table finance_config     enable row level security;

create policy "Public read snapshots"
  on finance_snapshots for select using (true);

create policy "Public read config"
  on finance_config for select using (true);
