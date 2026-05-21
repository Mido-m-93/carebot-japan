-- ============================================================
-- CareBot Japan — Module 2 & 3 Schema Additions
-- Run AFTER schema.sql in Supabase SQL editor
-- ============================================================

-- ── documents ────────────────────────────────────────────────
-- Stores fax/email/upload documents processed by Claude Vision
create table public.documents (
  id               uuid primary key default uuid_generate_v4(),
  clinic_id        uuid not null references public.clinics(id) on delete cascade,
  source           text not null,    -- 'fax' | 'email' | 'upload'
  file_type        text,             -- 'pdf' | 'image' | 'text'
  original_url     text,             -- URL to stored fax/document image
  raw_text         text,             -- OCR extracted text (from Claude Vision)
  extracted_data   jsonb,            -- structured extraction result
  document_type    text,             -- 'referral' | 'prescription' | 'insurance_form' | 'lab_result' | 'other'
  sender_fax       text,             -- sender fax number
  pages            int default 1,
  status           text not null default 'pending',
    -- 'pending' | 'processed' | 'error'
  review_queue_id  uuid references public.review_queue(id),
  created_at       timestamptz not null default now()
);

alter table public.documents enable row level security;

create policy "clinic staff see their documents" on public.documents
  for all using (
    clinic_id in (
      select clinic_id from public.clinic_users where user_id = auth.uid()
    )
  );

create policy "service role full access on documents" on public.documents
  using (auth.role() = 'service_role');

create index documents_clinic_status on public.documents(clinic_id, status, created_at desc);

-- ── claims ───────────────────────────────────────────────────
-- Insurance / reimbursement claims workflow
create table public.claims (
  id               uuid primary key default uuid_generate_v4(),
  clinic_id        uuid not null references public.clinics(id) on delete cascade,
  appointment_id   uuid references public.appointments(id),
  document_id      uuid references public.documents(id),
  patient_name     text,
  patient_dob      date,
  insurer_name     text,             -- 健康保険組合名
  insurer_id       text,
  policy_number    text,
  procedure_codes  text[],           -- e.g. ARRAY['A001', 'B002']
  diagnosis_codes  text[],           -- ICD-10 codes
  amount_claimed   integer,          -- in yen
  amount_approved  integer,
  status           text not null default 'draft',
    -- 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected' | 'resubmit'
  submitted_at     timestamptz,
  adjudicated_at   timestamptz,
  rejection_reason text,
  ai_flags         jsonb,            -- Claude-detected issues (missing codes, mismatches)
  notes            text,
  created_by       uuid references auth.users(id),
  created_at       timestamptz not null default now()
);

alter table public.claims enable row level security;

create policy "clinic staff see their claims" on public.claims
  for all using (
    clinic_id in (
      select clinic_id from public.clinic_users where user_id = auth.uid()
    )
  );

create policy "service role full access on claims" on public.claims
  using (auth.role() = 'service_role');

create index claims_clinic_status on public.claims(clinic_id, status, created_at desc);
