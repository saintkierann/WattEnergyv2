-- Watt Energy — energy-out storage (run once in Supabase → SQL Editor).
-- Keyed by user_id from day one so multi-user is a later flip, not a rewrite.
-- For the single-user MVP, one fixed user_id is used (see APP_USER_ID env var).

create table if not exists profile (
  user_id uuid primary key,
  sex text,
  weight_kg numeric,
  height_cm numeric,
  age int,
  measurement_pref text,
  bmr numeric,
  updated_at timestamptz default now()
);

create table if not exists strava_account (
  user_id uuid primary key,
  athlete_id bigint,
  athlete_name text,
  access_token text,
  refresh_token text,
  expires_at bigint,
  updated_at timestamptz default now()
);

create table if not exists daily_energy (
  user_id uuid not null,
  date date not null,
  base_kcal int default 0,
  activity_kcal int default 0,
  total_kcal int default 0,
  updated_at timestamptz default now(),
  primary key (user_id, date)
);

-- Per-day meals (energy in) with photos, rolling 7-day window (older auto-purged).
create table if not exists meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  date date not null,
  name text,
  kcal int default 0,
  p int default 0,
  c int default 0,
  f int default 0,
  photo_path text,            -- path in the 'meal-photos' storage bucket (nullable)
  created_at timestamptz default now()
);
create index if not exists meals_user_date on meals (user_id, date);

-- RLS on: the public (publishable) key can't read/write these. The server uses
-- the secret key, which bypasses RLS. Add policies later when adding real auth.
alter table profile enable row level security;
alter table strava_account enable row level security;
alter table daily_energy enable row level security;
alter table meals enable row level security;
-- Also create a PRIVATE Storage bucket named 'meal-photos' (Storage → New bucket).
