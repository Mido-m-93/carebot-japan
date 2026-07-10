-- migrations/add_stripe_billing.sql
--
-- Adds Stripe billing columns to the clinics table.
-- Safe to run multiple times (IF NOT EXISTS guards each column).
--
-- New columns
-- -----------
-- stripe_customer_id      TEXT UNIQUE  — Stripe Customer ID (cus_...)
-- stripe_subscription_id  TEXT UNIQUE  — Stripe Subscription ID (sub_...)
-- subscription_status     TEXT         — 'inactive' | 'active' | 'past_due' | 'cancelled'
--
-- Run against your Supabase project:
--   psql $DATABASE_URL -f migrations/add_stripe_billing.sql
-- or paste into the Supabase SQL editor.

ALTER TABLE clinics
    ADD COLUMN IF NOT EXISTS stripe_customer_id     TEXT UNIQUE,
    ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT UNIQUE,
    ADD COLUMN IF NOT EXISTS tier                   TEXT NOT NULL DEFAULT 'starter',
    ADD COLUMN IF NOT EXISTS subscription_status    TEXT NOT NULL DEFAULT 'inactive';

ALTER TABLE clinics
    DROP CONSTRAINT IF EXISTS clinics_tier_check;

ALTER TABLE clinics
    ADD CONSTRAINT clinics_tier_check
    CHECK (tier IN ('starter', 'pro', 'enterprise'));

-- Optional: add a check constraint so only valid values can be stored
-- (comment out if you want to allow future statuses without a migration)
ALTER TABLE clinics
    DROP CONSTRAINT IF EXISTS clinics_subscription_status_check;

ALTER TABLE clinics
    ADD CONSTRAINT clinics_subscription_status_check
    CHECK (subscription_status IN ('inactive', 'active', 'past_due', 'cancelled'));

-- Index for fast look-ups by Stripe customer ID (used in webhook handlers)
CREATE INDEX IF NOT EXISTS clinics_stripe_customer_id_idx
    ON clinics (stripe_customer_id);
