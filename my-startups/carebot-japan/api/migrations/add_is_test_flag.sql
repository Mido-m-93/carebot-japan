-- Distinguishes rows created by the dashboard's Test Message tool from real
-- patient activity. Until now, a "confirmed" test message inserted a real
-- appointments row indistinguishable from a genuine booking, polluting the
-- clinic's actual stats/dashboard. Both appointments and review_queue get
-- this column since either table can receive a test-generated row (see
-- services/scheduling.py's _is_test_message).
--
-- Existing rows all default to false (real activity), which is correct --
-- nothing before this migration came from the test tool.
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;
ALTER TABLE review_queue ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;
