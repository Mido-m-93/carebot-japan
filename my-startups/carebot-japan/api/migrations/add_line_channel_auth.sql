-- Per-clinic LINE Messaging API credentials. Until now, `line_channel_id`
-- only let an inbound webhook be routed to the right clinic -- verifying
-- the webhook signature and sending replies both used a single global
-- LINE_CHANNEL_SECRET / LINE_CHANNEL_ACCESS_TOKEN env var, so only one real
-- LINE Official Account (whichever matched those env vars) ever actually
-- worked end-to-end. These columns let each clinic register its own LINE
-- channel's secret and access token so multiple clinics' LINE integrations
-- can work independently (see routers/webhooks.py, services/line.py).
--
-- NULL means the clinic hasn't configured its own LINE channel yet -- the
-- webhook/reply code falls back to the global env vars in that case, so the
-- existing single-tenant production clinic keeps working unchanged.
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS line_channel_secret TEXT;
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS line_channel_access_token TEXT;
