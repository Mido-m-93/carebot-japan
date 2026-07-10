-- Add parent_clinic_id so one Enterprise clinic can manage multiple locations.
-- NULL = primary/standalone clinic (all existing rows, unchanged behavior).
-- Non-null = a location belonging to a parent Enterprise clinic; its own
-- tier/subscription_status/stripe_* columns are unused -- billing always
-- lives on the parent (see api/routers/billing.py's parent-redirect logic).
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS parent_clinic_id UUID REFERENCES clinics(id);

ALTER TABLE clinics
    DROP CONSTRAINT IF EXISTS clinics_no_self_parent;

ALTER TABLE clinics
    ADD CONSTRAINT clinics_no_self_parent
    CHECK (id != parent_clinic_id);

CREATE INDEX IF NOT EXISTS clinics_parent_clinic_id_idx ON clinics(parent_clinic_id);
