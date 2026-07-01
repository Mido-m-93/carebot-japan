-- Launchpad Database Schema
-- Execute in Supabase SQL Editor

-- User Profiles
create table profiles (
  id uuid references auth.users primary key,
  full_name text,
  country_of_origin text,
  current_country text,
  refugee_status text check (refugee_status in ('refugee', 'asylum_seeker', 'stateless', 'other')),
  cohort_id uuid,
  onboarding_complete boolean default false,
  languages text[],
  region text,
  monthly_budget_usd numeric default 500,
  created_at timestamptz default now()
);

-- Startups (Max 3 per user)
create table startups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  name text not null,
  description text,
  status text default 'active' check (status in ('active', 'pivoted', 'paused', 'graduated')),
  pivot_count int default 0, -- Legacy: kept for backwards compatibility
  business_type text,
  experiment_count int default 0,
  max_experiments int default 10,
  created_at timestamptz default now()
);

-- Pivot Log (Append-only)
create table pivot_log (
  id uuid primary key default gen_random_uuid(),
  startup_id uuid references startups(id) on delete cascade,
  pivot_from text not null,
  pivot_to text not null,
  reason text,
  agent_suggestion text,
  created_at timestamptz default now()
);

-- Agent Run Log
create table agent_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id),
  startup_id uuid references startups(id),
  model text not null,
  tokens_input int,
  tokens_output int,
  cost_usd numeric(10,6),
  task_type text,
  result text,
  created_at timestamptz default now()
);

-- Experiments
create table experiments (
  id uuid primary key default gen_random_uuid(),
  startup_id uuid references startups(id) on delete cascade,
  hypothesis text not null,
  metric text not null,
  target_value text,
  status text default 'pending' check (status in ('pending','running','success','failed','pivoted')),
  result text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz default now()
);

-- Token Budget
create table token_budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) unique,
  total_usd numeric(10,2) default 500.00,
  spent_usd numeric(10,6) default 0,
  reset_at timestamptz,
  updated_at timestamptz default now()
);

-- Stripe Subscriptions
-- Legacy: kept for future web app
create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id),
  stripe_customer_id text unique,
  stripe_subscription_id text,
  plan text check (plan in ('bootcamp', 'accelerator', 'loan')),
  status text,
  current_period_end timestamptz,
  created_at timestamptz default now()
);

-- Enable RLS
alter table profiles enable row level security;
alter table startups enable row level security;
alter table pivot_log enable row level security;
alter table agent_runs enable row level security;
alter table token_budgets enable row level security;
alter table subscriptions enable row level security;
alter table experiments enable row level security;

-- RLS Policies
create policy "Users own their profile" on profiles
  for all using (auth.uid() = id);

create policy "Users own their startups" on startups
  for all using (auth.uid() = user_id);

create policy "Users see their pivot logs" on pivot_log
  for select using (
    auth.uid() = (select user_id from startups where id = startup_id)
  );

create policy "Pivot log is append-only" on pivot_log
  for insert with check (
    auth.uid() = (select user_id from startups where id = startup_id)
  );

create policy "Users see their agent runs" on agent_runs
  for all using (auth.uid() = user_id);

create policy "Users see their budget" on token_budgets
  for all using (auth.uid() = user_id);

create policy "Users see their subscription" on subscriptions
  for all using (auth.uid() = user_id);

create policy "Users see own experiments" on experiments
  for all using (auth.uid() = (select user_id from startups where id = startup_id));

-- Indexes
create index idx_startups_user_id on startups(user_id);
create index idx_agent_runs_user_id on agent_runs(user_id);
create index idx_experiments_startup_id on experiments(startup_id);
