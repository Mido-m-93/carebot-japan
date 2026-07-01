# Launchpad Long-term Memory

> This file is auto-updated by nightly_consolidation.
> Manual edits are also allowed.

## Project Overview
- Launchpad: AI CXO multi-agent startup platform
- Operator: Jin (Jintae Kim) / Robo Co-op
- Infra: Next.js + Vercel + Supabase (ap-northeast-1)
- Repository: Robo-Co-op/StartupRobos (formerly launchpad)

## Current 3 Businesses
1. **AI Tool Lab** (affiliate_seo) — Amazon Associates (tag=robocoop-ai-22)
2. **Prompt Pack** (digital_product) — Gumroad (robocoop.gumroad.com) 3 products
3. **Puzzle Games** (game_ads) — AdSense (ca-pub-1023108228973632, pending review)

## Agent Setup
- CEO: Opus (daily 9:00 JST heartbeat)
- CTO/CMO/COO/CFO: Sonnet (daily 21:00 JST heartbeat)
- Research: Haiku (on-demand)
- Coordinator: Sonnet (main session)

## Key Decision Log
- 2026-04-12: Monetization codes deployed for all 3 businesses (Amazon/Gumroad/AdSense)
- 2026-04-12: Vercel Cron heartbeat implemented
- 2026-04-12: Long-term memory system introduced

## Lessons Learned
- Supabase anon key + RLS = auth.uid() null → use service role key instead
- Next.js server component: no need for fetch('/api/...') → call Supabase directly
- export const dynamic = 'force-dynamic' prevents static pre-rendering
- Manus can't push to GitHub → use patch file workflow
