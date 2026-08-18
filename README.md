# CareBot Japan — AI Clinic Scheduling SaaS

AI-powered appointment scheduling for Japanese clinics via LINE and web. Live in production with real clinics.

**Stack:** Next.js · FastAPI · Supabase · Groq (AI) · Stripe (billing) · LINE Messaging API · Resend (email)

**Code lives at:** `my-startups/carebot-japan/` (`api/` = FastAPI backend, `web/` = Next.js frontend) — not at the repo root, and not under `apps/`. This repo also contains `apps/startup-robos`, the AI CxO framework that originally managed CareBot Japan alongside JapanUnlocked and Kanso Templates; those two were shut down (not a good niche fit) and the framework now focuses on CareBot Japan; see `apps/startup-robos/CLAUDE.md` for how that's wired.

**Deployed at:**
- Frontend (Vercel): https://carebot-japan.robo-lab.io (custom domain; `carebot-japan-web.vercel.app` and per-deploy hash URLs still resolve but aren't the canonical link)
- Backend API (Railway): https://carebot-japan-production.up.railway.app
<!-- last-synced: 2026-08-18 by blueprint-sync -->

---

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | 20+ |
| Python | 3.11+ |
| pnpm | 9+ |

Accounts needed: Supabase (Tokyo region), Groq, Stripe, LINE Developers Console, Resend.

---

## 1. Install

```bash
cd my-startups/carebot-japan
pnpm install                       # installs web/

cd api
python -m venv .venv
.venv\Scripts\activate             # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
```

## 2. Configure environment

`web/.env.local` needs (see `services/db.py`, `services/ai.py`, `routers/billing.py` for the full list each service reads):

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
GROQ_API_KEY=gsk_...
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID=price_...            # Pro plan, ¥7,500/month (JPY is zero-decimal — no /100)
STRIPE_ENTERPRISE_PRICE_ID=price_... # Enterprise plan, ¥15,000/month
LINE_CHANNEL_SECRET=...
LINE_CHANNEL_ACCESS_TOKEN=...
RESEND_API_KEY=re_...
EMAIL_FROM=noreply@mail.robo-lab.io  # must be on a domain verified in Resend — their sandbox
                                      # domain (onboarding@resend.dev) only sends to the
                                      # account owner's own address, not real patients
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:8000
```

In production these are set directly in Vercel/Railway, not from a local file.
<!-- last-synced: 2026-08-18 by blueprint-sync -->

Supabase Auth also needs Custom SMTP configured (Authentication → Settings → SMTP Settings) pointed at
the same Resend domain — its default email service has a very low send-rate limit that will surface as
"email rate limit exceeded" on signup/password-reset otherwise.

## 3. Database

Migrations live in `api/migrations/*.sql` — paste each into the Supabase project's SQL Editor (no automated migration runner is wired up yet). All are additive/idempotent.

## 4. Run locally

```bash
# Terminal 1 — API
cd my-startups/carebot-japan/api
.venv\Scripts\activate
uvicorn main:app --reload --port 8000

# Terminal 2 — web
cd my-startups/carebot-japan/web
pnpm dev
```

Visit http://localhost:3000. API docs at http://localhost:8000/docs.

---

## API reference

Routers mounted in `api/main.py`:

| Prefix | Router | Purpose |
|---|---|---|
| `/webhooks` | webhooks.py | LINE + web message intake |
| `/appointments` | appointments.py | Appointment CRUD, booking flow |
| `/queue` | queue.py | Human review queue for low-confidence extractions |
| `/claims` | claims.py | Insurance claims workflow + AI review |
| `/billing` | billing.py | Stripe checkout, webhook, billing portal |
| `/clinics` | clinics.py | Clinic settings |

## Frontend structure

```
web/src/app/
├── login / signup / reset-password / onboarding    # auth flow
├── pricing                                          # Starter (free) / Pro ($49/mo)
├── book                                              # public patient-facing booking form
└── dashboard/
    ├── page.tsx            # overview
    ├── appointments/
    ├── claims/
    ├── billing/            # Stripe checkout + portal
    ├── review/             # human review queue
    └── test/               # test message sender
```

---

## What's real vs. simulated

- ✅ Auth, billing (Stripe checkout/webhook/portal for **both Pro and Enterprise**), LINE + web booking intake, AI claims review, human review queue, patient email notifications (Resend) — all real and live.
- ✅ **Pricing:** Starter (free, 50 appointments/month) / Pro (¥7,500/month) / Enterprise (¥15,000/month) — all three are real, selectable plans in the dashboard (`web/src/app/dashboard/billing/page.tsx`), not just DB values. Prices are read live from Stripe via `GET /billing/plans`, not hardcoded — check there, not this doc, if pricing seems off.
- ⚠️ **Google Calendar sync is fully simulated** (`api/services/calendar.py`) — no OAuth wiring exists, so appointments are never actually pushed to a real calendar. The API correctly reports `calendar_synced: false`.
<!-- last-synced: 2026-08-18 by blueprint-sync -->

## Next steps

1. Real Google Calendar OAuth (per-clinic connect flow) — needs a Google Cloud Console project set up by the account owner
2. Automated migration runner (currently manual paste-into-SQL-Editor)
3. EMR write integration (ORCA, Medicom) — not started
