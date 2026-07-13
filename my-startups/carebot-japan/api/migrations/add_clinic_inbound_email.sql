-- migrations/add_clinic_inbound_email.sql
--
-- Adds a per-clinic inbound email address so the /webhooks/email handler
-- can resolve the correct clinic from the Mailgun recipient address instead
-- of hardcoding the demo clinic. NULL means the clinic hasn't been given an
-- inbound address yet -- email webhook events for it will be skipped (see
-- api/routers/webhooks.py's _resolve_clinic_by_inbound_email).
--
-- Note: adding this column only lets the webhook resolve the clinic. It
-- does NOT provision the actual address in Mailgun -- that route/mailbox
-- must still be configured per clinic in the Mailgun dashboard so mail is
-- actually delivered to this webhook with the matching recipient.
--
-- Run against your Supabase project:
--   psql $DATABASE_URL -f migrations/add_clinic_inbound_email.sql
-- or paste into the Supabase SQL editor.

ALTER TABLE clinics ADD COLUMN IF NOT EXISTS inbound_email TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS clinics_inbound_email_idx ON clinics(inbound_email);
