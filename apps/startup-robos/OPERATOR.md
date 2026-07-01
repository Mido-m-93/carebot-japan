# startup-robos — operator notes

This is an instance of [StartupRobos](https://github.com/Robo-Co-op/StartupRobos-v2) owned by **Mohamad**.

- Reports delivered to: Mohamada@roboco-op.org
- Initialized: 2026-06-19

## Next steps
1. Fill in `.env.local` with your Supabase + Anthropic keys (see below)
2. Run Supabase schema: paste `supabase/schema.sql` into Supabase SQL Editor
3. Run migration: paste `supabase/migrations/001_spend_budget_rpc.sql` into SQL Editor
4. Deploy to Vercel: `npx vercel` then `npx vercel env add` for each var in `.env.local`
5. Open Claude Code: `claude` — the AI will pick your 3 businesses

## Staying up to date
```bash
git remote add upstream https://github.com/Robo-Co-op/StartupRobos-v2.git
git fetch upstream
git merge upstream/main
```
