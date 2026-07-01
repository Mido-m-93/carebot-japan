# StartupRobos

AI team that builds and runs businesses for you. You just talk.

## 3 Steps

1. **[Use this template](https://github.com/Robo-Co-op/StartupRobos/generate)** to create your own repo
2. **Open it in [Claude Code](https://claude.ai/download)**
3. **Say:** _"I want to startup. https://github.com/YourUserName/StartupRobos/"_

Done. The AI picks businesses, sets up infra, and starts building.

> ⚠️ **Don't work directly in the upstream `Robo-Co-op/StartupRobos` repo.**
> That's the framework. Your businesses live in *your* template instance. See [Why?](#why-use-this-template-not-fork-or-clone) below.

📘 For the latest Small Digital Business Playbooks and operator guides, see [Co-op Lab on Notion](https://robocoop.notion.site/cooplab).

---

## What happens next

Claude Code opens and asks what languages you speak. The CEO (Opus) picks 3 starter businesses. CxO agents (Sonnet) build and run them. You check in when you want.

### Default businesses (all $0 to start)

| Type | What | Revenue |
|------|------|---------|
| Affiliate/SEO | Multi-language review sites | Affiliate commissions |
| Digital Products | Templates, ebooks on Gumroad | Direct sales |
| Games + Ads | HTML5 games with AdSense | Ad revenue |

New business types can be added by the CEO agent or proposed by you. They live under `businesses/` in your instance.

---

## Requirements

- [Claude Code](https://claude.ai/download) (`npm i -g @anthropic-ai/claude-code`)
- Anthropic API key ([console.anthropic.com](https://console.anthropic.com/))
- GitHub account
- Free tier works for: Supabase, Vercel, Gumroad

---

## Setup: Supabase & Vercel (guided-manual)

The init script (`bash scripts/init-operator.sh`) walks you through these, or do them by hand:

### Supabase

1. Create a free project at [supabase.com](https://supabase.com)
2. **SQL Editor** → paste `supabase/schema.sql` → **Run**
3. **SQL Editor** → paste `supabase/migrations/001_spend_budget_rpc.sql` → **Run**
4. **Settings > API** → copy Project URL, anon key, service role key

### Environment

```bash
cp .env.example .env.local
# Fill in Supabase keys + Anthropic API key
# Generate secrets: openssl rand -hex 32
```

### Vercel

```bash
npx vercel          # Link to your Vercel project
npx vercel env add  # Add each key from .env.local
npx vercel --prod   # Deploy
```

Daily heartbeats (Vercel Cron) keep agents running even when you're offline. Reports go to the operator by email. Mission Control dashboard at `/dashboard` shows everything live.

---

## Budget

Costs depend on usage and model mix. A typical 3-business setup runs on a modest monthly API budget.

| Role | Model | Notes |
|------|-------|-------|
| Coordinator (main) | Sonnet | Always-on, low cost |
| CEO (strategy) | Opus | Called sparingly |
| CXOs (execution) | Sonnet | Bulk of token usage |
| Research | Haiku | Cheapest model |

With prompt caching enabled (configured in `.claude/` + `src/lib/agent/`), expect ~40% lower effective cost.

---

## Architecture & Design Decisions

### Why "Use this template" (not fork or clone)?

**StartupRobos is a framework, not a single-business template.**

- One StartupRobos instance = one operator = N businesses run by the shared CxO team.
- Your businesses live under `businesses/<slug>/` inside *your* instance.
- **Do NOT copy `.claude/agents/`, `AGENTS.md`, or `src/lib/agent/` into a standalone repo.** You'll waste weeks and lose upstream improvements.

```
❌ Wrong:   robo-match-standalone-repo (re-implements CxO prompts)
✅ Right:   my-startuprobos/businesses/robo-match/  (uses shared CxOs)
```

| | Template clone | Fork |
|--|---------------|------|
| Setup scripts run cleanly | ✅ | ⚠️ references remain |
| History is yours | ✅ | ❌ (carries upstream history) |
| Can pull upstream fixes later | ✅ `git remote add upstream …` | ✅ |

The OpenFisca project (our design inspiration) learned this the hard way and [explicitly warns against forking](https://github.com/openfisca/country-template).

### Staying up to date with upstream

```bash
git remote add upstream https://github.com/Robo-Co-op/StartupRobos.git
git fetch upstream
git merge upstream/main
```

---

## Adding a new business (for contributors)

1. Copy `businesses/_template/` to `businesses/<your-business-slug>/`
2. Fill in `businesses/<your-business-slug>/README.md` following the template
3. Use the existing CxO pattern from `src/lib/agent/` — do **not** duplicate it
4. Register the business type in `src/lib/dashboard/queries.ts` if new agent task types are introduced
5. Update `memory/MEMORY.md` with the business context

**Do not create a standalone repo for a single business.** A business is not a framework.

## License

MIT — template freely. Upstream improvements welcome.
