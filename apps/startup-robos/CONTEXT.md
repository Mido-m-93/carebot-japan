# StartupRobos — Domain Context

## Co-op Lab

StartupRobos is the core tool of **Co-op Lab** — a learning program where refugees form 5-person co-ops and run this together.

**Structure:**
- 5 refugees form a co-op, matched by language/region
- Each runs StartupRobos to operate 3 digital businesses
- Co-op shares learnings, supports each other, contributes PRs back

**Two-wheel OSS model:**
- **StartupRobos** (this repo): AI-CXO team runs businesses autonomously
- **RoboBuilder** (github.com/Robo-Co-op/robobuilder): Claude Code protocol that makes CC 5x faster; 12-week curriculum for refugees to become independent developers
- Refugees run StartupRobos from day 1, learn RoboBuilder in parallel → graduate as self-sufficient developers

**Foundation model:**
- Both repos are OSS (MIT)
- Anthropic API costs covered by donations via StartupRobos Foundation
- Robo Operator (AI agent) continuously improves both repos as CC evolves

**Design principle for agents:**
- Refugee users may have limited technical background → keep UX simple, decisions minimal
- Language × region drives business personalization (not generic templates)
- One-way doors (irreversible actions) always require human confirmation
- Dignity, agency, long-term livelihood — not just income

## What this project is

StartupRobos (formerly Launchpad) is an AI CXO multi-agent startup platform. Entrepreneurs onboard once; a team of AI agents (CEO, CTO, CMO, COO, CFO) then runs 3 digital businesses autonomously.

## Glossary

| Term | Definition | Avoid saying |
|---|---|---|
| **Startup** | A digital business being operated by the AI CXO team | "project", "site" |
| **CXO** | Any of the five AI executive agents (CEO/CTO/CMO/COO/CFO) | "bot", "AI" alone |
| **Coordinator** | The main session agent (Sonnet) that talks to the user and dispatches CXOs | "orchestrator" |
| **CEO Agent** | Opus-based agent for strategic decisions (pivot, experiment evaluation, business selection) | — |
| **Council** | A CXO council run — all 5 CXOs execute in parallel for a given startup | "batch", "parallel agents" |
| **Heartbeat** | Scheduled autonomous run (cron-based) — CEO heartbeat daily, CXO heartbeat twice daily | "cron job" |
| **Experiment** | A hypothesis-driven test for a startup, with metric, goal, duration, and result | "task", "feature" |
| **Pivot** | A strategic decision to change a startup's direction, tracked in `pivot_log` | "change", "update" |
| **Token budget** | A per-user monthly USD spending cap on Anthropic API calls, tracked in `token_budgets` | "credit", "limit" |
| **Artifact** | A CXO-generated output (report, site, product) that lives in `agent_runs.result` | "output", "file" |
| **Handoff** | The inferred relationship when one CXO's run is followed by another on the same startup within 6h | "chain", "dependency" |
| **agent_run** | A single execution of one CXO on one startup — the core event record in the DB | — |
| **Business type** | One of: `affiliate_seo`, `digital_product`, `game_ads` | "category", "template" |

## Key architectural decisions

- **Next.js App Router** (server components by default) + **Supabase** (Postgres + Auth + RLS) + **Anthropic SDK**
- **Vercel** deployment with cron for heartbeats
- All agent costs tracked in USD in `agent_runs.cost_usd`
- RLS enabled on all tables; `createServiceClient()` (service_role) used only server-side
- Dashboard is internal-only; user authentication via Supabase Auth

## What's out of scope for agents

- Modifying `supabase/schema.sql` without a corresponding migration file
- Writing to `memory/` directly (managed by hooks)
- Creating new CXO roles beyond the 5 defined in `cxo.ts`
