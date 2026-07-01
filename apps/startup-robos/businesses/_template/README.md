# `<business-slug>` — business template

> Copy this whole directory to `businesses/<your-slug>/` and fill in below.
> **Do NOT** duplicate the CxO prompts, agent harness, or Mission Control UI.
> A business is a **project** that uses the shared framework — not a new framework.

## What this business does

1-3 sentences. What does this business sell/do? Who pays? Why does it exist?

## Business type

One of:
- `affiliate_seo` — multi-language review/comparison sites, revenue via affiliate commissions
- `digital_product` — downloadable products on Gumroad/Lemonsqueezy/etc
- `game_ads` — HTML5 games with AdSense revenue
- `custom:<short-label>` — custom type. Register the task types in `src/lib/dashboard/queries.ts::TASK_TYPE_LABELS`.

## Monetization stack

| Channel | Account | Status |
|---------|---------|--------|
| (e.g. Amazon Associates) | (tag) | pending / live |
| (e.g. Gumroad) | (username) | — |
| (e.g. AdSense) | (publisher ID) | — |

## Current experiments

Tracked in the `experiments` Supabase table under `startup_id = <this business's id>`.

See Mission Control → Projects → this project for the live view.

## Files in this directory

| File | Purpose |
|------|---------|
| `README.md` | This file — what + why |
| `index.html` (optional) | If deploying to GitHub Pages as the landing page |
| `articles/` (optional) | SEO articles for affiliate_seo type |
| `products/` (optional) | Product definitions for digital_product type |
| `games/` (optional) | HTML5 games for game_ads type |
| `keyword-research.md` (optional) | CMO's keyword strategy |
| `monetization.md` (optional) | CFO's revenue plan and tracking |

## What NOT to put here

- ❌ CxO system prompts (they live in `.claude/agents/` and `src/lib/agent/cxo.ts`)
- ❌ Agent harness code (lives in `src/lib/agent/`)
- ❌ Dashboard components (live in `src/app/dashboard/`)
- ❌ Supabase schema (lives in `supabase/`)

If you catch yourself duplicating any of the above, stop and use the shared version instead.

## Checklist when adding a new business

- [ ] Copied `businesses/_template/` to `businesses/<slug>/`
- [ ] Filled in this README
- [ ] Inserted a row in the Supabase `startups` table with the correct `business_type`
- [ ] Added any new task types to `TASK_TYPE_LABELS` in `src/lib/dashboard/queries.ts` if needed
- [ ] Added a line to `memory/MEMORY.md` under "Current N Businesses"
- [ ] Confirmed the business appears in Mission Control → Projects
