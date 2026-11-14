-- Xtreme Sniper commercial schema. NOT applied automatically.
-- Run ONLY in a dedicated NEW Supabase project after review.
-- Backend uses service_role securely server-side; no service_role key in browsers.
create table if not exists public.profiles(
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role text not null default 'customer' check(role in ('customer','admin')),
  created_at timestamptz not null default now()
);
create table if not exists public.subscriptions(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check(status in ('pending','active','expired','canceled')),
  starts_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  check(expires_at is null or starts_at is null or expires_at>starts_at)
);
create index if not exists subscriptions_user_idx on public.subscriptions(user_id,status,expires_at);

create table if not exists public.signals(
  id uuid primary key default gen_random_uuid(),
  signal_key text not null unique,
  asset text not null,
  direction text not null check(direction in ('CALL','PUT')),
  strategy text not null,
  timeframe text not null default 'M1',
  entry_at timestamptz not null,
  expires_at timestamptz not null,
  source text not null default 'BULLEX_PRACTICE',
  source_observed_at timestamptz not null,
  verification_status text not null default 'unverified' check(verification_status in ('unverified','verified','rejected')),
  created_at timestamptz not null default now(),
  check(expires_at>entry_at)
);
create index if not exists signals_entry_idx on public.signals(entry_at desc);

create table if not exists public.signal_results(
  signal_id uuid primary key references public.signals(id) on delete cascade,
  result text not null check(result in ('WIN','LOSS','DRAW','PENDING')),
  entry_price numeric,
  exit_price numeric,
  verified_at timestamptz,
  verification_status text not null default 'unverified' check(verification_status in ('unverified','verified','rejected')),
  created_at timestamptz not null default now()
);
create table if not exists public.user_settings(
  user_id uuid primary key references auth.users(id) on delete cascade,
  selected_asset text not null default 'all',
  expiration_seconds integer not null default 60 check(expiration_seconds in (60,120,300)),
  sound_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);
create table if not exists public.signal_views(
  user_id uuid not null references auth.users(id) on delete cascade,
  signal_id uuid not null references public.signals(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key(user_id,signal_id)
);
create table if not exists public.market_feed_status(
  id smallint primary key default 1 check(id=1),
  source text not null,
  last_verified_candle_at timestamptz,
  last_feed_received_at timestamptz,
  connected boolean not null default false,
  diagnostics text,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.subscriptions enable row level security;
alter table public.signals enable row level security;
alter table public.signal_results enable row level security;
alter table public.user_settings enable row level security;
alter table public.signal_views enable row level security;
alter table public.market_feed_status enable row level security;

revoke all on public.profiles,public.subscriptions,public.signals,public.signal_results,
 public.user_settings,public.signal_views,public.market_feed_status from anon,authenticated;

grant select on public.profiles,public.subscriptions,public.signals,public.signal_results,
 public.user_settings,public.signal_views to authenticated;
grant insert,update on public.user_settings to authenticated;
grant insert on public.signal_views to authenticated;

drop policy if exists "view_self_profile" on public.profiles;
create policy "view_self_profile" on public.profiles for select to authenticated
 using (user_id=(select auth.uid()));
drop policy if exists "view_self_subscription" on public.subscriptions;
create policy "view_self_subscription" on public.subscriptions for select to authenticated
 using (user_id=(select auth.uid()));

-- Access to a shared market signal requires the customer's active license.
drop policy if exists "licensed_read_signals" on public.signals;
create policy "licensed_read_signals" on public.signals for select to authenticated using(
  verification_status='verified'
  and exists(select 1 from public.subscriptions sub
    where sub.user_id=(select auth.uid())
      and sub.status='active' and sub.starts_at<=now()
      and (sub.expires_at is null or sub.expires_at>now()))
);
drop policy if exists "licensed_read_signal_results" on public.signal_results;
create policy "licensed_read_signal_results" on public.signal_results for select to authenticated using(
  verification_status='verified'
  and exists(select 1 from public.subscriptions sub
    where sub.user_id=(select auth.uid())
      and sub.status='active' and sub.starts_at<=now()
      and (sub.expires_at is null or sub.expires_at>now()))
);
drop policy if exists "read_own_settings" on public.user_settings;
create policy "read_own_settings" on public.user_settings for select to authenticated
 using(user_id=(select auth.uid()));
drop policy if exists "insert_own_settings" on public.user_settings;
create policy "insert_own_settings" on public.user_settings for insert to authenticated
 with check(user_id=(select auth.uid()));
drop policy if exists "update_own_settings" on public.user_settings;
create policy "update_own_settings" on public.user_settings for update to authenticated
 using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
drop policy if exists "read_own_views" on public.signal_views;
create policy "read_own_views" on public.signal_views for select to authenticated
 using(user_id=(select auth.uid()));
drop policy if exists "insert_own_views" on public.signal_views;
create policy "insert_own_views" on public.signal_views for insert to authenticated
 with check(user_id=(select auth.uid()));
-- market_feed_status has NO browser-access policy. Backend-only.
