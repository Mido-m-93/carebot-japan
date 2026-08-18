# CareBot Japan — Incident Runbook

Single-operator project (Mido). No on-call rotation — if something breaks, it's you.
This doc exists so a 3am fix doesn't depend on remembering how everything's wired.

## Architecture at a glance

| Layer | Where | Notes |
|---|---|---|
| Frontend | Vercel — https://carebot-japan.robo-lab.io | Next.js. Auto-deploys on push to `main`. Custom domain on Hostinger DNS (nameservers `ns1/ns2.dns-parking.com`); `carebot-japan-web.vercel.app` still resolves but isn't canonical. |
| Backend API | Railway — https://carebot-japan-production.up.railway.app | FastAPI. Auto-deploys on push to `main`. No staging environment (a `sandbox` Railway environment can be spun up ad hoc for testing, e.g. via `railway environment new sandbox --duplicate production`, then torn down). |
| Database + Auth | Supabase | Postgres + Supabase Auth. RLS enabled on all tables. Auth uses Custom SMTP (Resend) — see below. |
| Payments | Stripe — **`STRIPE_SECRET_KEY` in Railway production is `rk_live_...`, live mode.** Checkout, billing portal, webhook at `/billing/webhook`. A separate Stripe Sandbox exists for test-mode work — grab a fresh `sk_test_...` key + test Price IDs from there, never test against the live key. |
| Patient channels | LINE (primary), web booking form, email (Resend, real domain `mail.robo-lab.io`, fully wired to real patient addresses as of 2026-08-18) | |
| AI | Groq (intent classification, extraction), Anthropic (claims review) | |
<!-- last-synced: 2026-08-18 by blueprint-sync -->

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
- **A real Stripe webhook delivery is a `StripeObject`, not a plain dict — `.get()` doesn't exist
  on it.** Unit tests that mock `stripe.Webhook.construct_event()`'s return as a plain dict will
  never catch this; it only shows up against a real delivery. `billing.py`'s webhook handler now
  calls `.to_dict()` on `event["data"]["object"]` before touching it — don't remove that.
- **Resend's sandbox domain (`onboarding@resend.dev`) can only send to the account owner's own
  email.** This silently broke every patient confirmation email until `mail.robo-lab.io` was
  verified (2026-08-18). If patient emails go quiet again, check `EMAIL_FROM` is still on the
  verified domain, not the sandbox one.
- **Supabase's default email service has a very low send-rate limit** — a burst of
  signups/password-resets will hit "email rate limit exceeded." Custom SMTP (Authentication →
  Settings → SMTP Settings, routed through the same Resend domain) fixes this; if it's ever
  disabled or misconfigured, this comes back.
- **`supabase.auth.signUp()` needs an explicit `emailRedirectTo`, or the confirmation link falls
  back to Supabase's Site URL config and skips `/auth/callback` entirely** — the code is never
  exchanged for a session, and the user lands on a dead page. Same applies to any new Supabase
  Auth email flow added later; copy the pattern from `LoginClient.tsx`'s password-reset call.

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
- Resend dashboard (`roboco-op` team): domain `mail.robo-lab.io`, region Tokyo (ap-northeast-1).
  Used both for the app's own patient emails (`api/services/email.py`) and Supabase Auth's
  Custom SMTP.
- DNS for `robo-lab.io`: Hostinger's DNS zone editor (Domains → robo-lab.io → DNS Records). The
  root domain also carries unrelated Microsoft 365 MX/SPF records — don't touch those; anything
  new (like Resend's DKIM/SPF/MX) goes on a dedicated subdomain (`mail.robo-lab.io` / its
  `send.mail` sub-subdomain) so it can't conflict.
<!-- last-synced: 2026-08-18 by blueprint-sync -->

## Escalation

There's no one else. If you're stuck, the fastest path back to a working state is usually the
rollback steps above, not debugging forward under pressure.
