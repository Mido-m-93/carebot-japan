# CareBot Japan — AI CXO Team Brief

> Paste this into your Launchpad Claude Code session after onboarding.
> Say: "One of my businesses is CareBot Japan. Here's the brief:"

---

## What is CareBot?

CareBot Japan is an AI-powered scheduling assistant for Japanese medical clinics.
Patients send appointment requests via LINE (Japan's dominant messaging app), web, or SMS — in natural Japanese.
CareBot reads the message, classifies the intent, extracts the date/time/name, and either auto-confirms the appointment or flags it for a human to review.

**The core problem it solves:** Japanese clinics still manage most scheduling by phone and fax. Staff waste hours transcribing messages, making mistakes, and playing phone tag. CareBot turns a 10-minute manual process into a 3-second automated one.

---

## Current Status (as of May 2026)

**What's built (MVP is complete):**
- FastAPI backend with Claude AI (Haiku for intent, Sonnet for extraction)
- LINE webhook + web webhook intake
- Appointment auto-confirm or human-review queue based on confidence score
- Next.js dashboard: appointments list, review queue, test console
- Supabase database: clinics, appointments, review queue, audit log (APPI-compliant)
- Fax intake service (`document_ai.py`) — stub, ready to activate
- Claims automation router — stub, ready to activate
- Twilio SMS confirmations (Japanese language, formatted dates)

**What's NOT built yet:**
- Login/auth UI (Supabase Auth is wired, no frontend yet)
- Redis async job queue (currently synchronous — fine for MVP scale)
- Real LINE channel connection (needs LINE Developers Console setup)
- FaxBot document parsing (next sprint)
- EMR write integration (ORCA, Medicom)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (TypeScript) |
| Backend API | FastAPI (Python 3.11) |
| AI | Claude API — Haiku (intent) + Sonnet (extraction) |
| Database | Supabase (PostgreSQL, Tokyo region) |
| Messaging | LINE Messaging API + Twilio JP |
| Monorepo | Turborepo + pnpm |
| Hosting | Not deployed yet (running locally) |

---

## Business Model (needs CXO input)

**Target customer:** Japanese medical clinics (内科、整形外科、皮膚科, etc.)
- Japan has ~100,000 clinics
- Most are 1–3 doctor practices with 1–2 admin staff
- Admin staff are overwhelmed; scheduling is their #1 pain point

**Pricing tiers in schema (not final):**
- `starter` — basic scheduling
- `pro` — scheduling + fax intake
- `enterprise` — full automation + EMR integration

**Revenue model:** Monthly SaaS subscription per clinic.
Rough estimate: ¥30,000–¥100,000/month per clinic depending on tier and volume.

---

## What I need from the CXO team

### CEO — Strategy
- What's the fastest path to first paying customer in Japan?
- Should I target clinic owners directly or go through EMR vendors (ORCA, Medicom)?
- What's the right beachhead segment? (specialty, geography, clinic size)

### CMO — Marketing & Sales
- How do I reach Japanese clinic owners? (LINE Business, medical associations, direct sales?)
- What's the messaging? (Cost savings? Staff relief? APPI compliance?)
- What does a Japanese clinic owner need to see to say yes in a demo?

### CFO — Pricing & Revenue
- Validate the pricing tiers. Is ¥30,000–¥100,000/month realistic?
- What's the ROI story for a clinic? (hours saved × staff hourly rate)
- What's the right pilot offer to get the first 5 clinics? (Free trial? Money-back?)

### COO — Operations
- What does onboarding a new clinic actually look like step by step?
- What support do clinics need in the first 30 days?
- What are the compliance requirements (APPI — Japan's privacy law) I need to satisfy?

### CTO — Technical roadmap
- What's the highest-value next feature after auth login? (FaxBot? EMR integration? Analytics?)
- Should I deploy on Vercel + Railway, or go full AWS Japan region for APPI?
- What's the right Redis/queue setup once I need async processing at scale?

---

## Key Numbers

- AI cost per appointment processed: ~¥3–5 (Haiku + Sonnet combined)
- Confidence threshold for auto-confirm: 80%
- Confidence threshold for human review: 75%
- Average appointment booking message length: 30–80 Japanese characters

---

## Repo Structure (for CTO)

```
carebot/
├── apps/
│   ├── api/          # FastAPI — main backend
│   │   ├── routers/  # webhooks, appointments, queue, fax, claims
│   │   └── services/ # ai.py, scheduling.py, sms.py, db.py, document_ai.py
│   └── web/          # Next.js dashboard
│       └── src/app/dashboard/
│           ├── appointments/
│           ├── review/      ← human review queue (key UI)
│           └── test/        ← test message sender
└── packages/
    ├── db/schema.sql  # full Supabase schema + seed data
    └── ai/src/        # TypeScript Claude wrappers
```

---

## One-line pitch

> "CareBot Japan turns patient LINE messages into confirmed clinic appointments in 3 seconds — no phone calls, no fax, no manual entry."
