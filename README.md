# CareBot Japan — Scheduling MVP

AI-powered clinic scheduling for Japanese clinics.
No Automation Anywhere. Full cloud-native stack.

**Stack**: Next.js 14 · FastAPI · Supabase · Claude API · Twilio JP

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 20+ | https://nodejs.org |
| Python | 3.11+ | https://python.org |
| pnpm | 9+ | `npm i -g pnpm` |
| Supabase CLI | latest | `brew install supabase/tap/supabase` |

You also need accounts for:
- [Anthropic](https://console.anthropic.com) — for the Claude API key
- [Supabase](https://supabase.com) — create a free project, pick **Tokyo (ap-northeast-1)**
- [Twilio](https://twilio.com) — optional for SMS in dev (prints to console if not set)

---

## 1. Clone and install

```bash
git clone <your-repo-url> carebot-japan
cd carebot-japan

# Install Node dependencies
pnpm install

# Set up Python venv for the API
cd apps/api
python -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cd ../..
```

---

## 2. Configure environment

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in:

```env
# Required — get from console.anthropic.com
ANTHROPIC_API_KEY=sk-ant-...

# Required — get from your Supabase project settings
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Optional — SMS will print to console in dev mode without these
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_FROM_NUMBER=+81...

# Leave these as-is for local dev
REDIS_URL=redis://localhost:6379
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:8000
API_URL=http://localhost:8000
```

---

## 3. Set up the database

Open your Supabase project → SQL Editor → paste and run the entire contents of:

```
packages/db/schema.sql
```

This creates all tables, RLS policies, indexes, and seeds the demo clinic.

Verify it worked:

```sql
select id, name, name_jp from clinics;
-- Should return: 00000000-0000-0000-0000-000000000001 | Demo Clinic Shinjuku
```

---

## 4. Run locally

You need **two terminals**.

**Terminal 1 — FastAPI (scheduling service)**

```bash
cd apps/api
source .venv/bin/activate
uvicorn main:app --reload --port 8000
```

You should see:
```
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
INFO:     Application startup complete.
```

Visit http://localhost:8000/docs to see the interactive API docs.

**Terminal 2 — Next.js (dashboard)**

```bash
cd apps/web
pnpm dev
```

Visit http://localhost:3000 — it redirects to `/dashboard`.

---

## 5. What to test first

### Test 1 — Health check (30 seconds)

```bash
curl http://localhost:8000/health
# Expected: {"status":"ok","service":"carebot-scheduling"}
```

### Test 2 — Send a clear appointment request (2 minutes)

Go to http://localhost:3000/dashboard/test

Click **"明確な予約依頼"** to fill the example message, then click **送信して処理**.

Expected result:
```json
{
  "status": "confirmed",
  "appointment_id": "uuid...",
  "scheduled_at": "2025-xx-xxT10:00:00+09:00",
  "patient_name": "田中花子",
  "sms_sent": false,
  "confidence": 0.94
}
```

Now go to http://localhost:3000/dashboard/appointments — you should see the appointment listed.

### Test 3 — Trigger the review queue (2 minutes)

Go back to Test Message, click **"曖昧な日時"** and send it.

Expected result:
```json
{
  "status": "queued_for_review",
  "intent": "appointment_request",
  "confidence": 0.61,
  "reason": "low_extraction_confidence"
}
```

Go to http://localhost:3000/dashboard/review — you should see the item with the raw message on
the left and Claude's best extraction attempt on the right, fields highlighted amber where
confidence is low. Fill in the missing date/time and click **予約として確定**.

### Test 4 — Direct API call (curl)

```bash
curl -X POST http://localhost:8000/webhooks/web \
  -H "Content-Type: application/json" \
  -d '{
    "clinic_id": "00000000-0000-0000-0000-000000000001",
    "message": "来週の金曜日の14時に予約をお願いします。佐藤です。",
    "patient_phone": null
  }'
```

### Test 5 — Check the audit log

In Supabase → Table Editor → audit_logs.
Every action (claude_extraction_run, appointment_created, review_item_created) should be logged.
This is your APPI compliance trail.

---

## API Reference

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| `POST` | `/webhooks/web` | Submit a message (from web/dashboard) |
| `POST` | `/webhooks/line` | Line Messaging API webhook |
| `GET` | `/appointments/{clinic_id}` | List appointments |
| `PATCH` | `/appointments/{id}/cancel` | Cancel appointment |
| `GET` | `/queue/{clinic_id}` | List review queue items |
| `POST` | `/queue/{id}/resolve` | Resolve queue item → create appointment |
| `POST` | `/queue/{id}/dismiss` | Dismiss queue item |

Interactive docs: http://localhost:8000/docs

---

## Project structure

```
carebot-japan/
├── apps/
│   ├── web/                        # Next.js 14 clinic dashboard
│   │   └── src/app/dashboard/
│   │       ├── page.tsx            # Overview / stats
│   │       ├── appointments/       # Appointment list
│   │       ├── review/             # Human review queue ← key UI
│   │       └── test/               # Test message sender
│   └── api/                        # FastAPI scheduling service
│       ├── main.py                 # App entrypoint
│       ├── routers/
│       │   ├── webhooks.py         # /webhooks/line + /webhooks/web
│       │   ├── appointments.py     # CRUD
│       │   └── queue.py            # Review queue actions
│       └── services/
│           ├── ai.py               # Claude API — classify + extract
│           ├── scheduling.py       # Full pipeline logic
│           ├── sms.py              # Twilio wrapper
│           └── db.py               # Supabase client
├── packages/
│   ├── db/schema.sql               # Full Supabase schema + seed
│   └── ai/src/                     # TypeScript Claude wrappers (for web API routes)
└── .env.example
```

---

## Confidence thresholds

| Threshold | Value | Behaviour |
|-----------|-------|-----------|
| Intent confidence | 0.75 | Below → review queue |
| Extraction confidence | 0.80 | Below → review queue |
| Field confidence | 0.80 | Below → field highlighted amber in review UI |

Change these in `apps/api/services/scheduling.py`:
```python
INTENT_CONFIDENCE_THRESHOLD = 0.75
EXTRACTION_CONFIDENCE_THRESHOLD = 0.80
```

---

## What's NOT in this MVP

- Line webhook signature verification in prod (enabled, skip-able in dev)
- Redis/Bull background job queue (processing is synchronous in MVP — fast enough for dev)
- SMS in dev mode (prints to console — add Twilio credentials to enable)
- Authentication on the dashboard (Supabase Auth wired but no login UI yet)
- FaxBot / Document AI service (next sprint)
- ClaimsBot / Temporal workflows (next sprint)
- EMR write integration (appointments stored in CareBot DB only for now)

---

## Next steps after MVP is working

1. Add Supabase Auth login page to the dashboard
2. Connect a real Line channel (Line Developers Console → Messaging API)
3. Add Twilio credentials to enable real SMS
4. Build FaxBot service (`apps/api/services/document_ai.py`)
5. Add Redis + Bull for proper async job queue
6. Write Temporal claims workflow
