-- Enables auto-resolving LINE cancellations without human review: store which
-- LINE user made each booking so a later "cancel" message can be matched back
-- to their specific appointment instead of relying on the patient re-typing
-- their name/phone (which almost never happens in a one-line cancel request).
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS line_user_id TEXT;
CREATE INDEX IF NOT EXISTS appointments_line_user_id_idx ON appointments(clinic_id, line_user_id);

-- Tracks a pending clarifying question sent back to a LINE patient (e.g.
-- "which of your 2 appointments?" or "that time's taken, pick an alternative")
-- so their NEXT message can be matched to it instead of running through
-- normal intent classification.
ALTER TABLE review_queue ADD COLUMN IF NOT EXISTS line_user_id TEXT;
CREATE INDEX IF NOT EXISTS review_queue_awaiting_reply_idx ON review_queue(clinic_id, line_user_id, status);
