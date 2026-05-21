-- ============================================================
-- CareBot Japan — MVP Schema
-- Run in Supabase SQL editor or via supabase db push
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ── clinics ─────────────────────────────────────────────────
create table public.clinics (
  id            uuid primary key default uuid_generate_v4(),
  name          text not null,
  name_jp       text,                        -- Japanese name
  emr_type      text,                        -- 'ORCA' | 'Medicom' | 'other'
  tier          text not null default 'pro', -- 'starter' | 'pro' | 'enterprise'
  line_channel_id text,                      -- Line channel linked to this clinic
  fax_number    text,
  sms_from      text,                        -- Twilio number for this clinic
  timezone      text not null default 'Asia/Tokyo',
  active        boolean not null default true,
  onboarded_at  timestamptz,
  created_at    timestamptz not null default now()
);

alter table public.clinics enable row level security;

-- Service role can do everything; anon gets nothing
create policy "service role full access" on public.clinics
  using (auth.role() = 'service_role');

-- ── clinic_users ─────────────────────────────────────────────
-- Links Supabase auth users to clinics
create table public.clinic_users (
  id         uuid primary key default uuid_generate_v4(),
  clinic_id  uuid not null references public.clinics(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null default 'staff', -- 'owner' | 'staff'
  created_at timestamptz not null default now(),
  unique(clinic_id, user_id)
);

alter table public.clinic_users enable row level security;

create policy "users see their own clinic memberships" on public.clinic_users
  for select using (auth.uid() = user_id);

-- ── appointments ─────────────────────────────────────────────
create table public.appointments (
  id               uuid primary key default uuid_generate_v4(),
  clinic_id        uuid not null references public.clinics(id) on delete cascade,
  patient_name     text,
  patient_phone    text,
  scheduled_at     timestamptz,
  duration_minutes int not null default 15,
  visit_reason     text,
  is_first_visit   boolean,
  status           text not null default 'confirmed',
    -- 'confirmed' | 'cancelled' | 'rescheduled' | 'completed'
  source           text not null,          -- 'line' | 'web' | 'email' | 'manual'
  raw_message      text,                   -- original patient message
  sms_sent_at      timestamptz,
  reminder_sent_at timestamptz,
  notes            text,
  created_at       timestamptz not null default now()
);

alter table public.appointments enable row level security;

create policy "clinic staff see their clinic appointments" on public.appointments
  for all using (
    clinic_id in (
      select clinic_id from public.clinic_users where user_id = auth.uid()
    )
  );

-- Index for calendar queries
create index appointments_clinic_scheduled on public.appointments(clinic_id, scheduled_at);

-- ── review_queue ──────────────────────────────────────────────
-- Low-confidence extractions that need human review
create table public.review_queue (
  id                  uuid primary key default uuid_generate_v4(),
  clinic_id           uuid not null references public.clinics(id) on delete cascade,
  source              text not null,   -- 'line' | 'fax' | 'email'
  raw_input           text not null,   -- original message / fax text
  intent              text,            -- Claude's classified intent
  intent_confidence   float,
  extracted_data      jsonb,           -- Claude's best extraction attempt
  field_confidences   jsonb,           -- { field_name: 0.0-1.0 }
  status              text not null default 'pending',
    -- 'pending' | 'resolved' | 'dismissed'
  resolved_by         uuid references auth.users(id),
  resolved_at         timestamptz,
  resolution          jsonb,           -- corrected data after human review
  created_at          timestamptz not null default now()
);

alter table public.review_queue enable row level security;

create policy "clinic staff see their review queue" on public.review_queue
  for all using (
    clinic_id in (
      select clinic_id from public.clinic_users where user_id = auth.uid()
    )
  );

create index review_queue_clinic_status on public.review_queue(clinic_id, status, created_at desc);

-- ── audit_logs ───────────────────────────────────────────────
-- APPI required — never delete rows from this table
create table public.audit_logs (
  id          uuid primary key default uuid_generate_v4(),
  clinic_id   uuid references public.clinics(id),
  action      text not null,
    -- 'appointment_created' | 'appointment_cancelled' | 'sms_sent'
    -- | 'review_item_created' | 'review_item_resolved'
    -- | 'line_webhook_received' | 'claude_extraction_run'
  actor       text not null,              -- 'scheduling_service' | 'user:[uuid]'
  record_type text,                       -- 'appointment' | 'review_queue_item'
  record_id   uuid,
  metadata    jsonb,                      -- extra context, never PHI
  created_at  timestamptz not null default now()
);

alter table public.audit_logs enable row level security;

-- Audit logs: clinic staff can read, service role can write
create policy "clinic staff can read audit logs" on public.audit_logs
  for select using (
    clinic_id in (
      select clinic_id from public.clinic_users where user_id = auth.uid()
    )
  );

create policy "service role can insert audit logs" on public.audit_logs
  for insert with check (auth.role() = 'service_role');

-- ── clinic_schedules ─────────────────────────────────────────
-- When the clinic is open (used by scheduling service)
create table public.clinic_schedules (
  id          uuid primary key default uuid_generate_v4(),
  clinic_id   uuid not null references public.clinics(id) on delete cascade,
  day_of_week int not null check (day_of_week between 0 and 6), -- 0=Sun
  open_time   time not null,
  close_time  time not null,
  slot_minutes int not null default 15,
  unique(clinic_id, day_of_week)
);

alter table public.clinic_schedules enable row level security;

create policy "clinic staff see their schedules" on public.clinic_schedules
  for all using (
    clinic_id in (
      select clinic_id from public.clinic_users where user_id = auth.uid()
    )
  );

-- ── Seed: one demo clinic for local development ───────────────
insert into public.clinics (id, name, name_jp, tier, timezone)
values (
  '00000000-0000-0000-0000-000000000001',
  'Demo Clinic Shinjuku',
  '新宿デモクリニック',
  'pro',
  'Asia/Tokyo'
);

insert into public.clinic_schedules (clinic_id, day_of_week, open_time, close_time)
values
  ('00000000-0000-0000-0000-000000000001', 1, '09:00', '18:00'), -- Mon
  ('00000000-0000-0000-0000-000000000001', 2, '09:00', '18:00'), -- Tue
  ('00000000-0000-0000-0000-000000000001', 3, '09:00', '18:00'), -- Wed
  ('00000000-0000-0000-0000-000000000001', 4, '09:00', '18:00'), -- Thu
  ('00000000-0000-0000-0000-000000000001', 5, '09:00', '18:00'), -- Fri
  ('00000000-0000-0000-0000-000000000001', 6, '09:00', '13:00'); -- Sat
