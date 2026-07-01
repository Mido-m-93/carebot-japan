-- V2: モデル設定と選定履歴テーブル
-- 週次オプティマイザが model_config を更新し、選定過程を model_selection_history に記録する

create table model_config (
  tier text primary key check (tier in ('high', 'low')),
  model text not null,
  updated_by text not null default 'manual' check (updated_by in ('manual', 'optimizer')),
  updated_at timestamptz not null default now()
);

insert into model_config (tier, model) values
  ('high', 'moonshotai/kimi-k2.6'),
  ('low', 'deepseek/deepseek-v4-flash');

create table model_selection_history (
  id uuid primary key default gen_random_uuid(),
  tier text not null,
  selected_model text not null,
  quality_score numeric,
  schema_pass_rate numeric,
  price_in_per_mtok numeric,
  price_out_per_mtok numeric,
  candidates jsonb,
  status text not null check (status in ('selected', 'kept_current', 'failed')),
  created_at timestamptz not null default now()
);

-- RLS: authenticated は select のみ、書き込みは service role
alter table model_config enable row level security;
alter table model_selection_history enable row level security;

create policy "model_config_read" on model_config
  for select to authenticated using (true);

create policy "model_selection_history_read" on model_selection_history
  for select to authenticated using (true);
