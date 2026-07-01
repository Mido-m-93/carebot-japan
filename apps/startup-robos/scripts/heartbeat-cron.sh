#!/bin/bash
# CEO heartbeat — called via VPS crontab for 2nd daily report
# Vercel Cron handles the 1st run (0:00 UTC), this handles the 2nd (9:00 UTC / 18:00 JST)

ENV_FILE="/home/admin/launchpad/.env.local"

if [ ! -f "$ENV_FILE" ]; then
  echo "$(date -u +%FT%TZ) ERROR: $ENV_FILE not found" >&2
  exit 1
fi

CRON_SECRET=$(grep '^CRON_SECRET=' "$ENV_FILE" | cut -d= -f2- | tr -d '"' | tr -d "'")

if [ -z "$CRON_SECRET" ]; then
  echo "$(date -u +%FT%TZ) ERROR: CRON_SECRET not set" >&2
  exit 1
fi

RESPONSE=$(curl -s -w "\n%{http_code}" \
  -H "Authorization: Bearer $CRON_SECRET" \
  "https://launchpad-kohl-three.vercel.app/api/heartbeat/ceo")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | head -n -1)

echo "$(date -u +%FT%TZ) HTTP $HTTP_CODE — $BODY"
