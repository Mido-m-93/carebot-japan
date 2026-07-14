# CareBot Japan — Incident Runbook

Single-operator project (Mido). No on-call rotation — if something breaks, it's you.
This doc exists so a 3am fix doesn't depend on remembering how everything's wired.

## Architecture at a glance

| Layer | Where | Notes |
|---|---|---|
| Frontend | Vercel — https://carebot-japan-web.vercel.app | Next.js. Auto-deploys on push to `main`. |
| Backend API | Railway — https://carebot-japan-production.up.railway.app | FastAPI. Auto-deploys on push to `main`. No staging environment. |
| Database + Auth | Supabase | Postgres + Supabase Auth. RLS enabled on all tables. |
| Payments | Stripe (live mode) | Checkout, billing portal, webhook at `/billing/webhook`. |
| Patient channels | LINE (primary), web booking form, email (Mailgun, not yet wired to real addresses) | |
| AI | Groq (intent classification, extraction), Anthropic (claims review) | |

Repos: code lives in this monorepo under `my-startups/carebot-japan/`. Pushed to
`personal` remote (`github.com/Mido-m-93/carebot-japan`) — PRs and CI run there,
not against the `origin` org remote.

## First things to check when something's broken

1. **Is the API up?** `curl https://carebot-japan-production.up.railway.app/health`
   → should return `{"status":"ok","service":"carebot-scheduling"}`.
2. **Is the frontend up?** `curl https://carebot-japan-web.vercel.app/pricing` → should return 200.
3. **Railway deploy status:** `railway status` (from `my-startups/carebot-japan/api/`, requires
   Railway CLI logged in) — check it's `Online`, not stuck `Building`/`Deploying`/crashed.
4. **Recent deploys:** Railway dashboard → Deployments tab, or `railway logs --deployment` for
   startup errors (import failures, missing env vars show up here immediately).
5. **CI status:** `gh pr checks <number> --repo Mido-m-93/carebot-japan` or check the
   Actions tab — the API test suite (`.github/workflows/carebot-japan-api-tests.yml`) runs on
   every push/PR touching `api/**`.

## Known gotchas (things that have actually bitten us)

- **Migrations are NOT automatic.** Files in `api/migrations/*.sql` must be manually pasted into
  Supabase's SQL Editor after merging. A missed migration has already caused a real outage
  (`clinics.parent_clinic_id` was merged in code but never applied to prod, breaking every
  clinic-scoped endpoint). **After merging any PR that adds a migration file, paste it in before
  telling anyone the feature is live.**
- **Railway env var edits require an explicit "Deploy" click.** Editing a variable in Railway's
  dashboard stages the change — it does NOT take effect until you click "Deploy" (or
  `railway up`). We've lost time twice assuming a saved variable was live when it wasn't.
- **Stripe test vs. live mode is a completely separate universe.** Test-mode Products, Prices,
  and webhook endpoints are invisible to a live-mode key and vice versa. If `/billing/plans`
  suddenly returns `null` for a plan, check `STRIPE_SECRET_KEY`'s mode first — a key that looks
  fine can just be the wrong mode's key.
- **`clinic_users` is the single point of failure for multi-tenancy.** If a user gets
  "No clinic found for this user" (404), check whether they have a row in `clinic_users` at all —
  this table being unexpectedly empty for a real signed-up user is the #1 thing that has broken
  onboarding before.

## Rollback

1. **Bad deploy just went out:** in Railway, Deployments tab → find the last known-good
   deployment → "Redeploy". For Vercel, the equivalent is the Deployments tab → "..." →
   "Promote to Production" on the last good build.
2. **Bad code merged to `main`:** `git revert <merge-commit-sha>`, push, let it auto-deploy. Don't
   force-push `main`.
3. **Bad migration:** migrations here are additive-only by convention (`ADD COLUMN IF NOT
   EXISTS`, etc.) — there is no automatic down-migration. Manually write and run the reverse SQL
   in Supabase's SQL Editor if a column/constraint genuinely needs to come out.

## Where things live

- Backend secrets (Stripe, Supabase service role, Groq, etc.): Railway → carebot-japan service →
  Variables tab.
- Frontend env vars (Supabase anon key, API URL): Vercel → project settings → Environment
  Variables.
- Stripe dashboard: make sure you're in the **live "CareBot Japan"** account, not the
  "CareBot Japan sandbox" — they're separate environments with separate keys/data.

## Escalation

There's no one else. If you're stuck, the fastest path back to a working state is usually the
rollback steps above, not debugging forward under pressure.
